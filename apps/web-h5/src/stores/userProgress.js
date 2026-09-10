import { ref, computed } from 'vue'
import routes from '@/data/routes'
import { request } from '@/utils/request'
import { backendToPlaceId, placeIdToBackend } from '@/data/campusPlaces'

export const points = ref(0)
export const checkedPlaces = ref([])
export const completedRoutes = ref([])
export const checkinRecords = ref([])
export const pendingCheckins = ref([])
export const checkinReviewRecords = ref([])
export const nickName = ref('')
export const userRole = ref('visitor')

export const checkedSet = computed(() => {
  const s = new Set(checkedPlaces.value) // 前端 slug
  // 同时加入对应的后端 backendId，便于与路线中的 backendId 比对打卡进度
  for (const slug of checkedPlaces.value) {
    const bid = placeIdToBackend[slug]
    if (bid != null) s.add(bid)
  }
  return s
})
export const completedSet = computed(() => new Set(completedRoutes.value))
export const pendingSet = computed(() => new Set(pendingCheckins.value.map(item => item.placeId)))

/**
 * 将后端返回的 unlockedLocations（数字ID）转换为前端字符串ID数组
 */
function normalizeCheckedPlaces(backendIds = []) {
  return backendIds
    .map(id => backendToPlaceId[id])
    .filter(Boolean)
}

/**
 * 将后端打卡记录转换为前端格式
 */
function normalizeCheckinRecords(records = []) {
  return records.map(r => ({
    placeId: backendToPlaceId[r.locationId] || String(r.locationId),
    distance: r.distance,
    time: r.time,
    method: r.method,
  }))
}

function normalizePendingCheckins(records = []) {
  return records.map(record => ({
    ...record,
    locationId: Number(record.locationId),
    placeId: backendToPlaceId[record.locationId] || String(record.locationId),
  }))
}

function normalizeReviewRecords(records = []) {
  return records.map(record => ({
    ...record,
    locationId: Number(record.locationId),
    placeId: backendToPlaceId[record.locationId] || String(record.locationId),
  }))
}

/**
 * 清空前端状态（后端无数据或请求失败时调用）
 */
function clearProgress() {
  points.value = 0
  checkedPlaces.value = []
  completedRoutes.value = []
  checkinRecords.value = []
  pendingCheckins.value = []
  checkinReviewRecords.value = []
  nickName.value = ''
  userRole.value = 'visitor'
}

/**
 * 从后端 /auth/me 拉取用户完整进度
 * 后端是唯一数据源
 */
export async function fetchUserProgress() {
  const res = await request('/auth/me', 'GET', null, { cacheBust: true })
  if (!res.ok) {
    clearProgress()
    const err = new Error(res.data?.message || '获取用户进度失败')
    err.type = res.status === 401 ? 'unauthorized' : 'network'
    throw err
  }
  if (res.data?.code !== 0) {
    clearProgress()
    const err = new Error(res.data?.message || '获取用户进度失败')
    err.type = 'backend'
    throw err
  }

  const info = res.data.userInfo || {}
  const newPoints = Number.isFinite(info.points) ? info.points : 0
  const newCheckedPlaces = normalizeCheckedPlaces(info.unlockedLocations)
  const newCompletedRoutes = Array.isArray(info.completedRoutes) ? info.completedRoutes : []
  const newCheckinRecords = normalizeCheckinRecords(info.checkinRecords)
  const newPendingCheckins = normalizePendingCheckins(info.pendingCheckins)
  const newReviewRecords = normalizeReviewRecords(info.checkinReviewRecords)

  // 替换数组引用即可触发 Vue 更新；避免先清空造成地图中间态重绘。
  points.value = newPoints
  checkedPlaces.value = newCheckedPlaces
  completedRoutes.value = newCompletedRoutes
  checkinRecords.value = newCheckinRecords
  pendingCheckins.value = newPendingCheckins
  checkinReviewRecords.value = newReviewRecords
  nickName.value = info.nickName || ''
  userRole.value = info.role || 'visitor'

  return {
    points: points.value,
    checkedPlaces: checkedPlaces.value,
    completedRoutes: completedRoutes.value,
    checkinRecords: checkinRecords.value,
    pendingCheckins: pendingCheckins.value,
    checkinReviewRecords: checkinReviewRecords.value,
    role: userRole.value,
  }
}

/**
 * 地点是否已打卡
 */
export function isPlaceChecked(placeId) {
  return checkedSet.value.has(placeId)
}

export function isPlacePending(placeId) {
  if (pendingSet.value.has(placeId)) return true
  const place = typeof placeId === 'object' ? placeId : null
  if (place?.id && pendingSet.value.has(place.id)) return true
  if (place?.backendId != null) {
    const slug = backendToPlaceId[place.backendId]
    return pendingSet.value.has(slug || String(place.backendId))
  }
  const slug = backendToPlaceId[placeId]
  return Boolean(slug && pendingSet.value.has(slug))
}

export function getPlaceReviewState(placeId) {
  if (isPlaceChecked(placeId)) return { status: 'approved' }
  const pending = pendingCheckins.value.find(item => item.placeId === placeId)
  if (pending) {
    return {
      ...pending,
      status: pending.appealStatus === 'pending' ? 'appealed' : 'pending'
    }
  }
  return [...checkinReviewRecords.value]
    .reverse()
    .find(item => item.placeId === placeId) || { status: 'idle' }
}

/**
 * 地点探索状态：available 可前往 / waiting 审核中 / completed 已点亮 / retry 需重试
 */
export function getPlaceProgressState(placeId) {
  const place = typeof placeId === 'object' ? placeId : null
  const rawId = place?.id ?? placeId
  const backendId = place?.backendId ?? (typeof rawId === 'number' ? rawId : placeIdToBackend[rawId])
  const id = backendToPlaceId[backendId] || rawId
  if (isPlaceChecked(id) || (backendId != null && isPlaceChecked(backendId))) return 'completed'
  if (isPlacePending(place || id)) return 'waiting'
  const review = getPlaceReviewState(id)
  if (review.status === 'pending' || review.status === 'appealed') return 'waiting'
  if (review.status === 'rejected') return 'retry'
  return 'available'
}

export async function appealCheckin(placeId, reason) {
  const backendId = placeIdToBackend[placeId]
  if (!backendId) throw new Error(`未知地点ID: ${placeId}`)
  const response = await request('/checkin/appeal', 'POST', { locationId: backendId, reason })
  if (!response?.ok || response?.data?.code !== 0) {
    throw new Error(response?.data?.message || '申诉提交失败')
  }
  await fetchUserProgress()
  return response.data.data || {}
}

/**
 * 路线是否已完成
 */
export function isRouteCompleted(routeId) {
  return completedSet.value.has(routeId)
}

/**
 * 获取路线已打卡数量
 */
export function getRouteCheckedCount(routeId) {
  const route = routes.find(r => r.id === routeId)
  if (!route?.points?.length) return 0
  let count = 0
  for (const id of route.points) {
    if (checkedSet.value.has(id)) count++
  }
  return count
}

/**
 * 获取路线中正在审核的地点数量
 */
export function getRoutePendingCount(routeId) {
  const route = routes.find(r => r.id === routeId)
  if (!route?.points?.length) return 0
  return route.points.reduce((count, id) => (
    getPlaceProgressState(id) === 'waiting' ? count + 1 : count
  ), 0)
}

/**
 * 获取路线中当前需要重新打卡的驳回地点数量
 */
export function getRouteRejectedCount(routeId) {
  const route = routes.find(r => r.id === routeId)
  if (!route?.points?.length) return 0
  return route.points.reduce((count, id) => (
    getPlaceProgressState(id) === 'retry' ? count + 1 : count
  ), 0)
}

/**
 * 重置所有进度
 */
export function resetProgress() {
  points.value = 0
  checkedPlaces.value = []
  completedRoutes.value = []
  checkinRecords.value = []
  pendingCheckins.value = []
  checkinReviewRecords.value = []
  userRole.value = 'visitor'
}
