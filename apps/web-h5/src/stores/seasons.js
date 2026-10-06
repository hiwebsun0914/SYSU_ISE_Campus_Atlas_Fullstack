import { campusLocations, backendToPlaceId, placeIdToBackend } from '@/data/campusPlaces'
import { activityDeadline } from './activityDeadline'
import routes from '@/data/routes'
import { reactive } from 'vue'
import { request } from '@/utils/request'

export const seasons = reactive({ ready: false, selected: '', current: '', participantSeasonId: null, list: [], config: null, error: '' })
let loading
let loadedFor = ''
export function accountKey() {
  try {
    const token = localStorage.getItem('token') || ''
    const part = token.split('.')[1]
    const payload = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')))
    return String(payload.id ?? payload.sub ?? payload.userId ?? 'guest')
  } catch { return 'guest' }
}
export function activityCacheKey(name) { return `${name}:${accountKey()}:${seasons.selected}` }
export function requestScope() { return `${accountKey()}:${seasons.selected}` }
export function clearActivityCache() {
  localStorage.removeItem('checkinRecords')
  try {
    const user = JSON.parse(localStorage.getItem('userInfo') || '{}')
    for (const field of ['points', 'pointsUpdatedAt', 'unlockedLocations', 'lockingLocations', 'completedRoutes', 'checkinRecords', 'pendingCheckins', 'checkinReviewRecords']) delete user[field]
    localStorage.setItem('userInfo', JSON.stringify(user))
  } catch { localStorage.removeItem('userInfo') }
}
export async function ensureSeasons() {
  const owner = accountKey()
  if (seasons.ready && loadedFor === owner) return
  if (loadedFor !== owner) {
    seasons.ready = false
    seasons.participantSeasonId = null
  }
  if (loading) return loading
  loading = (async () => {
    const res = await request('/seasons', 'GET', null, { skipSeason: true })
    if (!res.ok || res.data?.code !== 0) throw new Error(res.data?.message || '无法读取活动期')
    seasons.list = res.data.list
    seasons.participantSeasonId = res.data.participantSeasonId || null
    seasons.current = res.data.currentSeasonId
    seasons.selected = seasons.current
    if (!seasons.selected || !seasons.list.some(x => x.seasonId === seasons.selected)) throw new Error('账号尚未绑定新生届次')
    const config = await request('/seasons/config', 'GET', null, { skipSeason: true, headers: { 'X-Season-Id': seasons.selected } })
    if (!config.ok || config.data?.code !== 0) throw new Error(config.data?.message || '无法读取活动配置')
    seasons.config = config.data.data
    routes.splice(0, routes.length, ...seasons.config.routes)
    const existing = new Map(campusLocations.map(x => [Number(x.backendId), x]))
    const snapshot = seasons.config.locations.filter(x => !x.retired).map(x => ({ ...existing.get(Number(x.backendId)), ...x, id: existing.get(Number(x.backendId))?.id || String(x.backendId) }))
    campusLocations.splice(0, campusLocations.length, ...snapshot)
    for (const x of snapshot) { backendToPlaceId[x.backendId] = x.id; placeIdToBackend[x.id] = x.backendId }
    activityDeadline.resetForSeason({ deadline: seasons.config.deadline, closed: seasons.config.readOnly, serverNow: seasons.config.serverNow })
    const stamp = requestScope()
    if (localStorage.getItem('activityScope') !== stamp) {
      clearActivityCache()
      localStorage.setItem('activityScope', stamp)
    }
    seasons.ready = true
    loadedFor = owner
    seasons.error = ''
  })().catch(error => { seasons.error = error.message; throw error }).finally(() => { loading = null })
  return loading
}
export function selectSeason(id) {
  if (!id || id === seasons.selected) return
  clearActivityCache()
  localStorage.setItem(`selectedSeason:${accountKey()}`, JSON.stringify({ id, current: seasons.current }))
  seasons.selected = id
  // A full remount also terminates old uploads and clears component-local caches.
  window.location.reload()
}
