import assert from 'node:assert/strict'
import test from 'node:test'
import { createActivityDeadlineState, isActivityMutation, startActivityDeadlineSync } from '../src/stores/activityDeadline.js'

const cutoff = Date.parse('2026-09-17T00:00:00+08:00')

test('open at the last millisecond, closed exactly at Beijing midnight and remains closed', () => {
  let elapsed = 0
  let callback
  const state = createActivityDeadlineState({
    wallNow: () => cutoff - 1 + elapsed,
    monotonicNow: () => elapsed,
    schedule: fn => { callback = fn; return 1 },
    cancel: () => {}
  })
  state.start()
  assert.equal(state.closed.value, false)
  elapsed = 1
  callback()
  assert.equal(state.closed.value, true)
  elapsed = 5000
  state.tick()
  assert.equal(state.closed.value, true)
  state.stop()
})

test('server time corrects a fast local clock and a late response cannot reopen a closed activity', () => {
  let elapsed = 100
  const state = createActivityDeadlineState({
    wallNow: () => cutoff + 60_000,
    monotonicNow: () => elapsed,
    schedule: () => 1,
    cancel: () => {}
  })
  assert.equal(state.tick(), true)
  state.syncMeta({ deadline: '2026-09-17T00:00:00+08:00', serverNow: cutoff - 2000, closed: false }, 100)
  assert.equal(state.closed.value, false)
  elapsed += 2000
  assert.equal(state.tick(), true)
  state.markClosed()
  state.syncMeta({ deadline: '2026-09-17T00:00:00+08:00', serverNow: cutoff - 1000, closed: false }, 100)
  assert.equal(state.closed.value, true)
})

test('foreground return refreshes server status, and only activity mutations are guarded', async () => {
  const listeners = new Map()
  const windowTarget = { addEventListener: (name, fn) => listeners.set('window:' + name, fn), removeEventListener: name => listeners.delete('window:' + name) }
  const documentTarget = { visibilityState: 'visible', addEventListener: (name, fn) => listeners.set('document:' + name, fn), removeEventListener: name => listeners.delete('document:' + name) }
  let refreshes = 0
  const state = createActivityDeadlineState({ wallNow: () => cutoff - 1000, monotonicNow: () => 0, schedule: () => 1, cancel: () => {} })
  const stop = startActivityDeadlineSync(() => { refreshes += 1 }, {
    windowTarget, documentTarget, state, schedule: () => 2, cancel: () => {}
  })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(refreshes, 1)
  listeners.get('window:focus')()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(refreshes, 2)
  assert.equal(isActivityMutation('/checkin/commit', 'POST'), true)
  assert.equal(isActivityMutation('/submissions/123/appeal', 'POST'), true)
  assert.equal(isActivityMutation('/submissions/123/vote', 'POST'), true)
  assert.equal(isActivityMutation('/avatar/presign', 'POST'), false)
  assert.equal(isActivityMutation('/feedback/upload', 'POST'), false)
  stop()
  assert.equal(listeners.size, 0)
})
