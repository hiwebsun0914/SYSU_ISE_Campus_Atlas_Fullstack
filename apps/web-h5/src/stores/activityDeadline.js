import { computed, ref } from 'vue'

export const ACTIVITY_DEADLINE = '2026-09-17T00:00:00+08:00'
export const ACTIVITY_CLOSED_MESSAGE = '活动已于北京时间 9 月 17 日 00:00 截止，打卡、投稿、投票和新申诉已关闭。已提交的记录仍会继续审核。'

function timestamp(value) {
  if (value == null || value === '') return NaN
  return typeof value === 'number' ? value : Date.parse(value)
}

// Inject clocks/timers so the exact boundary and a suspended page can be tested.
export function createActivityDeadlineState({
  wallNow = () => Date.now(),
  monotonicNow = () => performance.now(),
  schedule = (fn, delay) => setTimeout(fn, delay),
  cancel = timer => clearTimeout(timer)
} = {}) {
  const deadline = ref(ACTIVITY_DEADLINE)
  const now = ref(wallNow())
  const serverClosed = ref(false)
  const closed = computed(() => serverClosed.value || now.value >= timestamp(deadline.value))
  let serverAnchor = null
  let monotonicAnchor = 0
  let latestServerTime = -Infinity
  let timer = null
  let running = false

  function tick() {
    now.value = serverAnchor == null
      ? wallNow()
      : serverAnchor + Math.max(0, monotonicNow() - monotonicAnchor)
    return closed.value
  }

  function armTimer() {
    if (timer != null) cancel(timer)
    if (!running) return
    // Wake at the boundary itself, not on the next whole-second interval.
    const remaining = timestamp(deadline.value) - now.value
    timer = schedule(() => {
      tick()
      armTimer()
    }, remaining > 0 ? Math.min(1000, remaining) : 1000)
  }

  function syncMeta(meta, startedAt = monotonicNow()) {
    if (meta?.closed === true) serverClosed.value = true
    const receivedAt = monotonicNow()
    const serverTime = timestamp(meta?.serverNow)
    if (Number.isFinite(serverTime) && serverTime >= latestServerTime) {
      latestServerTime = serverTime
      // HTTP round-trip midpoint is an estimate; the backend makes the final decision.
      serverAnchor = serverTime + Math.max(0, receivedAt - startedAt) / 2
      monotonicAnchor = receivedAt
      if (Number.isFinite(timestamp(meta?.deadline))) deadline.value = meta.deadline
    }
    tick()
    armTimer()
  }

  function markClosed() {
    // An old in-flight "open" response must never reopen a server-closed activity.
    serverClosed.value = true
  }

  function start() {
    running = true
    tick()
    armTimer()
  }

  function stop() {
    running = false
    if (timer != null) cancel(timer)
    timer = null
  }

  return { deadline, now, closed, tick, syncMeta, markClosed, start, stop }
}

export const activityDeadline = createActivityDeadlineState()
export const activityClosed = activityDeadline.closed
export const isActivityClosed = () => activityDeadline.tick()

export function activityClosedError() {
  return Object.assign(new Error(ACTIVITY_CLOSED_MESSAGE), { errorCode: 'ACTIVITY_CLOSED' })
}

export function assertActivityOpen() {
  if (isActivityClosed()) throw activityClosedError()
}

export function isActivityMutation(url, method = 'GET') {
  const path = String(url).split('?')[0].replace(/\/+$/, '')
  if (String(method).toUpperCase() === 'POST') {
    return /^\/checkin\/(presign|init|commit|map|appeal|fallback\/(presign|process))$/.test(path)
      || /^\/submissions(?:\/(presign|commit|upload|[^/]+\/(vote|appeal)))?$/.test(path)
  }
  // Preserve the existing prohibition on withdrawing works after the deadline.
  return String(method).toUpperCase() === 'DELETE' && /^\/submissions\/[^/]+$/.test(path)
}

export function closedActivityResponse() {
  return {
    ok: false, status: 403, statusCode: 403,
    data: { code: 4, errorCode: 'ACTIVITY_CLOSED', message: ACTIVITY_CLOSED_MESSAGE }
  }
}

// A single app-lifetime subscription covers every route, including pages left open overnight.
export function startActivityDeadlineSync(fetchMeta, {
  windowTarget = window,
  documentTarget = document,
  schedule = (fn, delay) => setInterval(fn, delay),
  cancel = timer => clearInterval(timer),
  state = activityDeadline
} = {}) {
  let inFlight = null
  const refresh = () => {
    state.tick()
    if (inFlight) return inFlight
    inFlight = Promise.resolve().then(fetchMeta).catch(() => {}).finally(() => { inFlight = null })
    return inFlight
  }
  const onVisible = () => {
    state.tick()
    if (documentTarget.visibilityState === 'visible') refresh()
  }
  state.start()
  refresh()
  const timer = schedule(() => {
    if (documentTarget.visibilityState === 'visible' && !state.closed.value) refresh()
  }, 60000)
  windowTarget.addEventListener('focus', refresh)
  documentTarget.addEventListener('visibilitychange', onVisible)
  return () => {
    state.stop()
    cancel(timer)
    windowTarget.removeEventListener('focus', refresh)
    documentTarget.removeEventListener('visibilitychange', onVisible)
  }
}
