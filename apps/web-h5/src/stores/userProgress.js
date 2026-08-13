import { ref, computed, nextTick as vueNextTick } from 'vue'
import routes from '@/data/routes'
import { request } from '@/utils/request'
import { backendToPlaceId, placeIdToBackend } from '@/data/campusPlaces'

export const points = ref(0)
export const checkedPlaces = ref([])
export const completedRoutes = ref([])
export const checkinRecords = ref([])
export const nickName = ref('')

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

/**
 * 等待下一个微任务
 */
function nextTick() {
  return vueNextTick()
}

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

/**
 * 清空前端状态（后端无数据或请求失败时调用）
 */
function clearProgress() {
  points.value = 0
  checkedPlaces.value = []
  completedRoutes.value = []
  checkinRecords.value = []
  nickName.value = ''
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

  // 先清空再赋值，确保 Vue 能检测到数组引用变化，触发 CampusMap 的 watch
  checkedPlaces.value = []
  await nextTick()
  checkinRecords.value = []

  points.value = newPoints
  checkedPlaces.value = newCheckedPlaces
  completedRoutes.value = newCompletedRoutes
  checkinRecords.value = newCheckinRecords
  nickName.value = info.nickName || ''

  await nextTick()

  return {
    points: points.value,
    checkedPlaces: checkedPlaces.value,
    completedRoutes: completedRoutes.value,
    checkinRecords: checkinRecords.value,
  }
}

/**
 * 地点是否已打卡
 */
export function isPlaceChecked(placeId) {
  return checkedSet.value.has(placeId)
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
 * 打卡一个地点
 * @param {string} placeId - 前端字符串地点ID
 * @param {{ distance?: number, method?: string }} [record] - 打卡记录信息
 * @returns {Promise<{ success: boolean, newlyCompletedRoutes: string[], points: number }>}
 */
export async function checkinPlace(placeId, record = {}) {
  const backendId = placeIdToBackend[placeId]
  if (!backendId) {
    throw new Error(`未知地点ID: ${placeId}`)
  }

  const res = await request('/checkin/map', 'POST', {
    locationId: backendId,
    distance: record.distance,
    method: record.method || 'geo',
  })

  if (!res.ok) {
    throw new Error(res.data?.message || '打卡请求失败')
  }
  if (res.data?.code !== 0) {
    throw new Error(res.data?.message || '打卡失败')
  }

  const result = res.data.data || {}

  // 用响应数据直接更新本地状态（响应已包含完整进度信息）
  if (Array.isArray(result.unlockedLocations)) {
    checkedPlaces.value = normalizeCheckedPlaces(result.unlockedLocations)
  }
  if (Array.isArray(result.completedRoutes)) {
    completedRoutes.value = result.completedRoutes
  }
  if (Number.isFinite(result.points)) {
    points.value = result.points
  }
  if (Array.isArray(result.checkinRecords)) {
    checkinRecords.value = normalizeCheckinRecords(result.checkinRecords)
  }

  // 后台静默拉取一次完整进度，确保 nickName 等额外字段同步；失败不阻塞
  fetchUserProgress().catch(() => {})

  return {
    success: result.newlyUnlocked !== false,
    newlyUnlocked: result.newlyUnlocked !== false,
    newlyCompletedRoutes: Array.isArray(result.newlyCompletedRoutes) ? result.newlyCompletedRoutes : [],
    points: points.value,
  }
}

/**
 * 重置所有进度
 */
export function resetProgress() {
  points.value = 0
  checkedPlaces.value = []
  completedRoutes.value = []
  checkinRecords.value = []
}
