#!/usr/bin/env node
/**
 * 生成静态贴路步行路径数据：apps/web-h5/src/data/routePaths.js
 *
 * 读取三条推荐路线的相邻站点，逐段调用高德 Web 服务步行规划
 * （与后端 routes/routeWalking.js 同一上游、同一解析逻辑），
 * 把结果固化为前端静态数据。站点坐标变更后重跑本脚本即可。
 *
 * 用法：node scripts/generate-route-paths.mjs
 * 密钥：自动从 services/weapp-auth-server/.env 读取 AMAP_WEB_SERVICE_KEY，
 *       也可用环境变量覆盖。密钥不会被打印。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT_FILE = path.join(ROOT, 'apps/web-h5/src/data/routePaths.js')
const OPTIMIZATION_CACHE_FILE = path.join(ROOT, 'scripts/.route-optimization-cache.json')

const UPSTREAM_GAP_MS = 350
const UPSTREAM_TIMEOUT_MS = 8000
const MAX_RETRY = 3

// ---------- 密钥：仅从 .env/环境变量读取，绝不打印 ----------
function loadAmapKey() {
  if (process.env.AMAP_WEB_SERVICE_KEY) return process.env.AMAP_WEB_SERVICE_KEY
  const envFile = path.join(ROOT, 'services/weapp-auth-server/.env')
  if (!fs.existsSync(envFile)) return ''
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*AMAP_WEB_SERVICE_KEY\s*=\s*(.+?)\s*$/)
    if (m) return m[1].replace(/^["']|["']$/g, '')
  }
  return ''
}

// ---------- 与后端 routeWalking.js 一致的上游解析 ----------
function parsePolyline(route) {
  const steps = route?.paths?.[0]?.steps
  if (!Array.isArray(steps)) return null
  const pathArr = []
  for (const step of steps) {
    for (const pair of String(step?.polyline || '').split(';')) {
      const [lng, lat] = pair.split(',').map(Number)
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
      const last = pathArr[pathArr.length - 1]
      if (last && last[0] === lng && last[1] === lat) continue
      pathArr.push([lng, lat])
    }
  }
  return pathArr.length >= 2 ? pathArr : null
}

async function fetchWalking(key, from, to) {
  const url = `https://restapi.amap.com/v3/direction/walking?key=${key}`
    + `&origin=${from[0]},${from[1]}&destination=${to[0]},${to[1]}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  try {
    const resp = await fetch(url, { signal: controller.signal })
    const body = await resp.json()
    if (body?.status !== '1') throw new Error(`高德返回失败: ${body?.info || '未知'}`)
    const p = parsePolyline(body.route)
    if (!p) throw new Error('高德未返回可用路径')
    return p
  } finally {
    clearTimeout(timer)
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms))
const round6 = n => Number(n.toFixed(6))
const keyOf = (from, to) =>
  `${from[0].toFixed(6)},${from[1].toFixed(6)}->${to[0].toFixed(6)},${to[1].toFixed(6)}`

function loadOptimizationCache() {
  try {
    const parsed = JSON.parse(fs.readFileSync(OPTIMIZATION_CACHE_FILE, 'utf8'))
    return parsed?.entries || {}
  } catch {
    return {}
  }
}

async function main() {
  const key = loadAmapKey()
  if (!key) {
    console.error('未找到 AMAP_WEB_SERVICE_KEY（.env 与环境变量均无）')
    process.exit(1)
  }

  const { getPlaceById } = await import(path.join(ROOT, 'apps/web-h5/src/data/campusPlaces.js'))
  const { default: routes } = await import(path.join(ROOT, 'apps/web-h5/src/data/routes.js'))
  const { default: manualRoutePathOverrides } = await import(
    path.join(ROOT, 'apps/web-h5/src/data/routePathOverrides.js')
  )
  const optimizationCache = loadOptimizationCache()

  // 汇总所有路段（跨路线去重）
  const segments = new Map()
  for (const route of routes) {
    const places = route.points.map(id => getPlaceById(id)).filter(Boolean)
    for (let i = 0; i < places.length - 1; i++) {
      const from = places[i].lnglat
      const to = places[i + 1].lnglat
      const k = keyOf(from, to)
      if (!segments.has(k)) segments.set(k, { from, to, route: route.id, index: i })
    }
  }
  console.log(`共 ${segments.size} 个去重路段待规划（3 条路线）`)

  // 串行 + 最小间隔，避免触发高德限流（同后端策略）
  const results = {}
  const failures = []
  let done = 0
  let lastCallAt = 0
  for (const [k, seg] of segments) {
    let pathResult = Array.isArray(optimizationCache[k]?.path)
      ? optimizationCache[k].path
      : null
    if (pathResult) console.log(`  [cache] ${k}`)
    for (let attempt = 1; attempt <= MAX_RETRY && !pathResult; attempt++) {
      const wait = Math.max(0, UPSTREAM_GAP_MS - (Date.now() - lastCallAt))
      if (wait) await sleep(wait)
      lastCallAt = Date.now()
      try {
        pathResult = await fetchWalking(key, seg.from, seg.to)
      } catch (err) {
        console.warn(`  [${k}] 第 ${attempt} 次失败: ${err.message}`)
        if (attempt < MAX_RETRY) await sleep(1000 * attempt)
      }
    }
    done++
    if (pathResult) {
      results[k] = pathResult.map(([lng, lat]) => [round6(lng), round6(lat)])
      console.log(`(${done}/${segments.size}) OK  ${k}  ${pathResult.length} 点`)
    } else {
      failures.push(k)
      console.error(`(${done}/${segments.size}) FAIL ${k}`)
    }
  }

  if (failures.length) {
    console.error(`\n有 ${failures.length} 段规划失败，未写出文件：`)
    failures.forEach(f => console.error(`  ${f}`))
    process.exit(2)
  }

  // 人工体验路径覆盖高德直接最短路，并随生成结果一起固化到前端。
  for (const [key, overridePath] of Object.entries(manualRoutePathOverrides)) {
    if (!Array.isArray(overridePath) || overridePath.length < 2) {
      throw new Error(`人工路线覆盖无效: ${key}`)
    }
    results[key] = overridePath.map(([lng, lat]) => [round6(lng), round6(lat)])
    console.log(`[manual override] ${key}  ${overridePath.length} 点`)
  }

  const banner = `// 本文件由 scripts/generate-route-paths.mjs 自动生成，请勿手改
// 内容：三条推荐路线相邻站点间的高德步行贴路路径（静态数据）
// 站点坐标变更后请重跑：node scripts/generate-route-paths.mjs
// key 格式：\`fromLng,fromLat->toLng,toLat\`（6 位小数，与 routeManager.segmentKeyOf 一致）
// 生成时间：${new Date().toISOString()}，共 ${Object.keys(results).length} 段
`
  const body = JSON.stringify(results, null, 0)
  fs.writeFileSync(OUT_FILE, `${banner}export default ${body}\n`, 'utf8')
  const kb = (fs.statSync(OUT_FILE).size / 1024).toFixed(1)
  console.log(`\n已写出 ${OUT_FILE}（${kb} KB，${Object.keys(results).length} 段）`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
