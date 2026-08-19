#!/usr/bin/env node
/**
 * Optimize the three recommended routes against AMap's walking network.
 *
 * The first stop is fixed; all other stops and the final stop are free. Results
 * are deterministic for a given distance matrix. Pairwise responses are cached
 * outside git so interrupted runs can resume without spending quota again.
 *
 * Usage: node scripts/optimize-recommended-routes.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CACHE_FILE = path.join(ROOT, 'scripts/.route-optimization-cache.json')
const RESULT_FILE = path.join(ROOT, 'scripts/route-optimization-result.json')
const REPORT_FILE = path.join(ROOT, 'docs/route-optimization-report.md')
const GAP_MS = 350
const TIMEOUT_MS = 10_000
const RETRIES = 3

// 人工体验约束优先于纯最短路：中轴线从北门向南探索东半区，
// 到怀士堂后折返向北探索西半区。保留在工具中，避免后续重跑优化时被覆盖。
const MANUAL_ROUTE_OVERRIDES = Object.freeze({
  'central-axis-route': [
    71, 70, 69, 67, 76, 21, 19, 18, 12, 84, 16, 14, 54, 50,
    88, 81, 82, 83, 80, 87, 79, 78, 75, 73, 72,
  ],
})

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const keyOf = (from, to) => `${from[0].toFixed(6)},${from[1].toFixed(6)}->${to[0].toFixed(6)},${to[1].toFixed(6)}`

function loadAmapKey() {
  if (process.env.AMAP_WEB_SERVICE_KEY) return process.env.AMAP_WEB_SERVICE_KEY
  const envFile = path.join(ROOT, 'services/weapp-auth-server/.env')
  if (!fs.existsSync(envFile)) return ''
  const line = fs.readFileSync(envFile, 'utf8').split('\n')
    .find(value => /^\s*AMAP_WEB_SERVICE_KEY\s*=/.test(value))
  return line?.replace(/^\s*AMAP_WEB_SERVICE_KEY\s*=\s*/, '').trim().replace(/^["']|["']$/g, '') || ''
}

function loadCache() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))
    return parsed?.entries ? parsed : { version: 1, entries: {} }
  } catch {
    return { version: 1, entries: {} }
  }
}

function saveCache(cache) {
  const tmp = `${CACHE_FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(cache), 'utf8')
  fs.renameSync(tmp, CACHE_FILE)
}

function parsePath(route) {
  const result = []
  for (const step of route?.paths?.[0]?.steps || []) {
    for (const pair of String(step?.polyline || '').split(';')) {
      const point = pair.split(',').map(Number)
      if (point.length !== 2 || !point.every(Number.isFinite)) continue
      const last = result.at(-1)
      if (!last || last[0] !== point[0] || last[1] !== point[1]) result.push(point)
    }
  }
  return result.length >= 2 ? result : null
}

async function fetchWalking(apiKey, from, to) {
  const url = `https://restapi.amap.com/v3/direction/walking?key=${apiKey}`
    + `&origin=${from.join(',')}&destination=${to.join(',')}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal })
    const body = await response.json()
    if (body?.status !== '1') throw new Error(body?.info || 'AMap request failed')
    const pathResult = parsePath(body.route)
    const distance = Number(body.route?.paths?.[0]?.distance)
    const duration = Number(body.route?.paths?.[0]?.duration)
    if (!pathResult || !Number.isFinite(distance) || distance <= 0) throw new Error('AMap returned no usable route')
    return { distance, duration: Number.isFinite(duration) ? duration : 0, path: pathResult }
  } finally {
    clearTimeout(timer)
  }
}

async function buildMatrix(apiKey, places, cache) {
  const matrix = Array.from({ length: places.length }, () => Array(places.length).fill(null))
  let lastCallAt = 0
  for (let i = 0; i < places.length; i++) {
    matrix[i][i] = { distance: 0, duration: 0, path: [places[i].lnglat] }
    for (let j = 0; j < places.length; j++) {
      if (i === j) continue
      const key = keyOf(places[i].lnglat, places[j].lnglat)
      let entry = cache.entries[key]
      if (!entry) {
        for (let attempt = 1; attempt <= RETRIES && !entry; attempt++) {
          const wait = Math.max(0, GAP_MS - (Date.now() - lastCallAt))
          if (wait) await sleep(wait)
          lastCallAt = Date.now()
          try {
            entry = await fetchWalking(apiKey, places[i].lnglat, places[j].lnglat)
            cache.entries[key] = { ...entry, fetchedAt: new Date().toISOString() }
            saveCache(cache)
          } catch (error) {
            console.warn(`  ${places[i].backendId}->${places[j].backendId} attempt ${attempt}: ${error.message}`)
            if (attempt < RETRIES) await sleep(attempt * 1000)
          }
        }
      }
      matrix[i][j] = entry || null
    }
  }
  return matrix
}

function routeCost(order, matrix, field = 'distance') {
  let total = 0
  for (let i = 0; i < order.length - 1; i++) {
    const edge = matrix[order[i]][order[i + 1]]
    if (!edge || !Number.isFinite(edge[field])) return Infinity
    total += edge[field]
  }
  return total
}

function greedyOrder(matrix, forcedSecond = null) {
  const remaining = new Set(Array.from({ length: matrix.length - 1 }, (_, index) => index + 1))
  const order = [0]
  if (forcedSecond != null) {
    order.push(forcedSecond)
    remaining.delete(forcedSecond)
  }
  while (remaining.size) {
    const current = order.at(-1)
    const next = [...remaining]
      .filter(candidate => matrix[current][candidate])
      .sort((a, b) => matrix[current][a].distance - matrix[current][b].distance || a - b)[0]
    if (next == null) return null
    order.push(next)
    remaining.delete(next)
  }
  return order
}

function improve(initial, matrix) {
  let best = initial.slice()
  let bestCost = routeCost(best, matrix)
  let changed = true
  while (changed) {
    changed = false
    let candidateBest = best
    let candidateCost = bestCost
    const consider = candidate => {
      const cost = routeCost(candidate, matrix)
      if (cost < candidateCost - 0.01) {
        candidateBest = candidate
        candidateCost = cost
      }
    }
    // Swap any two non-start stops.
    for (let i = 1; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const candidate = best.slice()
        ;[candidate[i], candidate[j]] = [candidate[j], candidate[i]]
        consider(candidate)
      }
    }
    // Relocate one stop anywhere else (including the open endpoint).
    for (let from = 1; from < best.length; from++) {
      for (let to = 1; to < best.length; to++) {
        if (from === to) continue
        const candidate = best.slice()
        const [node] = candidate.splice(from, 1)
        candidate.splice(to, 0, node)
        consider(candidate)
      }
    }
    // Directed 2-opt: evaluate the complete reversed subsection, not a symmetric shortcut.
    for (let i = 1; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        consider([...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)])
      }
    }
    if (candidateCost < bestCost - 0.01) {
      best = candidateBest
      bestCost = candidateCost
      changed = true
    }
  }
  return best
}

function optimize(matrix) {
  const seeds = [greedyOrder(matrix)]
  for (let second = 1; second < matrix.length; second++) seeds.push(greedyOrder(matrix, second))
  return seeds.filter(Boolean).map(seed => improve(seed, matrix))
    .sort((a, b) => routeCost(a, matrix) - routeCost(b, matrix))[0]
}

const meters = value => `${Math.round(value).toLocaleString('zh-CN')} m`
const minutes = seconds => `${Math.max(1, Math.round(seconds / 60))} 分钟`

function reportSection(route, places, originalOrder, optimizedOrder, matrix, strategy) {
  const oldDistance = routeCost(originalOrder, matrix)
  const newDistance = routeCost(optimizedOrder, matrix)
  const oldDuration = routeCost(originalOrder, matrix, 'duration')
  const newDuration = routeCost(optimizedOrder, matrix, 'duration')
  const lines = [
    `## ${route.name}`,
    '',
    `- 原路线：${meters(oldDistance)}，约 ${minutes(oldDuration)}`,
    `- 候选路线：${meters(newDistance)}，约 ${minutes(newDuration)}`,
    `- 节省：${meters(oldDistance - newDistance)}（${((oldDistance - newDistance) / oldDistance * 100).toFixed(1)}%）`,
    `- 路线策略：${strategy}`,
    `- 固定首站：${places[0].name}；终点：${places[optimizedOrder.at(-1)].name}`,
    '',
    '| 顺序 | 地点 | 下一段距离 |',
    '| ---: | --- | ---: |',
  ]
  optimizedOrder.forEach((placeIndex, orderIndex) => {
    const nextIndex = optimizedOrder[orderIndex + 1]
    const distance = nextIndex == null ? '—' : meters(matrix[placeIndex][nextIndex].distance)
    lines.push(`| ${orderIndex + 1} | ${places[placeIndex].name}（${places[placeIndex].backendId}） | ${distance} |`)
  })
  return lines.join('\n')
}

async function main() {
  const apiKey = loadAmapKey()
  if (!apiKey) throw new Error('AMAP_WEB_SERVICE_KEY is missing')
  const { default: routes } = await import(path.join(ROOT, 'apps/web-h5/src/data/routes.js'))
  const { getPlaceById } = await import(path.join(ROOT, 'apps/web-h5/src/data/campusPlaces.js'))
  const cache = loadCache()
  const results = []
  const report = [
    '# 推荐路线步行路网优化报告', '',
    `生成时间：${new Date().toISOString()}`, '',
    '> 候选顺序固定原首站，末站开放；距离与时间来自高德步行规划。上线前需人工核验校内实际通行情况。', ''
  ]

  for (const route of routes) {
    const places = route.points.map(id => getPlaceById(id))
    if (places.some(place => !place)) throw new Error(`${route.id} contains an unknown place`)
    console.log(`Building ${route.name} matrix (${places.length} stops)...`)
    const matrix = await buildMatrix(apiKey, places, cache)
    const original = places.map((_, index) => index)
    const optimized = optimize(matrix)
    if (!optimized) throw new Error(`No complete route found for ${route.id}`)
    const oldDistance = routeCost(original, matrix)
    const newDistance = routeCost(optimized, matrix)
    const overrideIds = MANUAL_ROUTE_OVERRIDES[route.id]
    const placeIndexById = new Map(places.map((place, index) => [place.backendId, index]))
    const override = overrideIds?.map(id => placeIndexById.get(id))
    if (override && (override.some(index => index == null) || new Set(override).size !== places.length)) {
      throw new Error(`${route.id} manual override must contain the same unique place set`)
    }
    const accepted = newDistance < oldDistance
    const selected = override || (accepted ? optimized : original)
    const strategy = override
      ? '人工体验约束：先向南探索中轴线东半区，到怀士堂后折返向北探索西半区'
      : '固定首站的高德步行路网最短化'
    results.push({
      id: route.id,
      originalPoints: route.points,
      suggestedPoints: selected.map(index => places[index].backendId),
      originalDistance: oldDistance,
      suggestedDistance: routeCost(selected, matrix),
      savedDistance: oldDistance - routeCost(selected, matrix),
      savedPercent: (oldDistance - routeCost(selected, matrix)) / oldDistance * 100,
      strategy,
    })
    report.push(reportSection(route, places, original, selected, matrix, strategy), '')
  }

  fs.writeFileSync(RESULT_FILE, `${JSON.stringify({ generatedAt: new Date().toISOString(), routes: results }, null, 2)}\n`)
  fs.writeFileSync(REPORT_FILE, `${report.join('\n')}\n`)
  console.log(`Wrote ${path.relative(ROOT, RESULT_FILE)} and ${path.relative(ROOT, REPORT_FILE)}`)
  results.forEach(result => console.log(`${result.id}: ${meters(result.originalDistance)} -> ${meters(result.suggestedDistance)} (-${result.savedPercent.toFixed(1)}%)`))
}

main().catch(error => {
  console.error(error?.stack || error)
  process.exit(1)
})
