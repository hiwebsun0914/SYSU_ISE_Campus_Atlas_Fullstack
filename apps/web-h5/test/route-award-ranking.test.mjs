import assert from 'node:assert/strict'
import test from 'node:test'

import { buildRouteAwardRows } from '../src/utils/routeAwardRanking.js'

const routes = [
  { id: 'route-a', points: [1, 2] },
  { id: 'route-b', points: [3, 4] },
  { id: 'route-c', points: [5, 6] }
]

function checkins(userId, entries) {
  return entries.map(([locationId, uploadTime]) => ({ userId, locationId, uploadTime }))
}

test('ranks users by completed route count before completion time', () => {
  const users = [{ id: 1, username: 'one-route' }, { id: 2, username: 'two-routes' }]
  const approved = [
    ...checkins(1, [[1, 100], [2, 200]]),
    ...checkins(2, [[3, 500], [4, 600], [5, 700], [6, 800]])
  ]

  const rows = buildRouteAwardRows(users, approved, routes)

  assert.deepEqual(rows.map(user => user.id), [2, 1])
  assert.deepEqual(rows.map(user => user.rank), [1, 2])
})

test('same route count is ranked by when that count was reached, regardless of route identity', () => {
  const users = [{ id: 1, username: 'routes-a-b' }, { id: 2, username: 'routes-b-c' }]
  const approved = [
    ...checkins(1, [[1, 100], [2, 200], [3, 300], [4, 900]]),
    ...checkins(2, [[3, 100], [4, 300], [5, 400], [6, 700]])
  ]

  const rows = buildRouteAwardRows(users, approved, routes)

  assert.deepEqual(rows.map(user => user.id), [2, 1])
  assert.equal(rows[0].rankingCompletedAt, 700)
  assert.equal(rows[1].rankingCompletedAt, 900)
})

test('one-route users are compared by route completion time, not by which route they chose', () => {
  const users = [{ id: 1, username: 'route-a' }, { id: 2, username: 'route-c' }]
  const approved = [
    ...checkins(1, [[1, 100], [2, 500]]),
    ...checkins(2, [[5, 100], [6, 300]])
  ]

  const rows = buildRouteAwardRows(users, approved, routes)

  assert.deepEqual(rows.map(user => user.id), [2, 1])
})

