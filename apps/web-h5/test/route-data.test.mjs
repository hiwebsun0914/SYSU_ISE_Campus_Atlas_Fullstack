import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

import routes from '../src/data/routes.js'
import routePaths from '../src/data/routePaths.js'
import { getPlaceById } from '../src/data/campusPlaces.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const require = createRequire(import.meta.url)
const backendRoutes = require('../../../services/weapp-auth-server/data/routes.js')
const optimization = JSON.parse(fs.readFileSync(path.join(root, 'scripts/route-optimization-result.json'), 'utf8'))
const segmentKey = (from, to) => `${from[0].toFixed(6)},${from[1].toFixed(6)}->${to[0].toFixed(6)},${to[1].toFixed(6)}`

test('frontend and backend route orders stay synchronized', () => {
  assert.deepEqual(
    routes.map(({ id, points }) => ({ id, points })),
    backendRoutes.map(({ id, points }) => ({ id, points })),
  )
})

test('optimized routes preserve each place set and fixed first stop', () => {
  for (const result of optimization.routes) {
    const route = routes.find(item => item.id === result.id)
    assert.ok(route)
    assert.equal(route.points[0], result.originalPoints[0])
    assert.equal(new Set(route.points).size, route.points.length)
    assert.deepEqual([...route.points].sort((a, b) => a - b), [...result.originalPoints].sort((a, b) => a - b))
    assert.deepEqual(route.points, result.suggestedPoints)
    if (result.strategy.startsWith('人工体验约束')) {
      assert.ok(Number.isFinite(result.suggestedDistance) && result.suggestedDistance > 0)
    } else {
      assert.ok(result.suggestedDistance < result.originalDistance)
    }
  }
})

test('every optimized adjacent segment has a matching static walking path', () => {
  for (const route of routes) {
    const places = route.points.map(getPlaceById)
    for (let index = 0; index < places.length - 1; index++) {
      const from = places[index].lnglat
      const to = places[index + 1].lnglat
      const pathResult = routePaths[segmentKey(from, to)]
      assert.ok(Array.isArray(pathResult) && pathResult.length >= 2, `${route.id} segment ${index + 1}`)
      assert.ok(Math.hypot(pathResult[0][0] - from[0], pathResult[0][1] - from[1]) < 0.002)
      assert.ok(Math.hypot(pathResult.at(-1)[0] - to[0], pathResult.at(-1)[1] - to[1]) < 0.002)
    }
  }
})

test('Swasey Hall crosses to the west side on the north convex arc', () => {
  const pathResult = routePaths['113.298076,23.095542->113.297204,23.097465']
  const westCrossing = pathResult.find(point => point[0] <= 113.2975)
  assert.ok(westCrossing, 'the path must cross from the east side to the west side')
  assert.ok(westCrossing[1] < 23.0962, 'the crossing must use the arc immediately north of Swasey Hall')
  assert.ok(pathResult.length >= 30, 'the manual arc should retain its road-following geometry')
})
