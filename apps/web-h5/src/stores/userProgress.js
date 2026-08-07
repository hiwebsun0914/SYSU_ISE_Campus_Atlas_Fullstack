import { ref, computed, watch } from 'vue'
import routes from '@/data/routes'

const STORAGE_KEY = 'userProgress'

export const points = ref(0)
export const checkedPlaces = ref([])
export const completedRoutes = ref([])
/**
 * 打卡记录列表
 * [{ placeId, distance, time, method: 'geo'|'manual'|'force' }]
 */
export const checkinRecords = ref([])

export const checkedSet = computed(() => new Set(checkedPlaces.value))
export const completedSet = computed(() => new Set(completedRoutes.value))

/**
 * 加载本地保存的进度
 */
function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const data = JSON.parse(raw)
    points.value = Number.isFinite(data.points) ? data.points : 0
    checkedPlaces.value = Array.isArray(data.checkedPlaces) ? data.checkedPlaces : []
    completedRoutes.value = Array.isArray(data.completedRoutes) ? data.completedRoutes : []
    checkinRecords.value = Array.isArray(data.checkinRecords) ? data.checkinRecords : []
  } catch (err) {
    console.warn('[userProgress] load failed:', err)
  }
}

/**
 * 保存进度到本地
 */
function saveProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      points: points.value,
      checkedPlaces: checkedPlaces.value,
      completedRoutes: completedRoutes.value,
      checkinRecords: checkinRecords.value,
    }))
  } catch (err) {
    console.warn('[userProgress] save failed:', err)
  }
}

// 自动持久化
watch([points, checkedPlaces, completedRoutes, checkinRecords], saveProgress, { deep: true })

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
 * @param {string} placeId
 * @param {{ distance?: number, method?: string }} [record] - 打卡记录信息
 * @returns {{ newlyChecked: boolean, routeCompleted: string[] }}
 */
export function checkinPlace(placeId, record = {}) {
  if (isPlaceChecked(placeId)) {
    return { newlyChecked: false, routeCompleted: [] }
  }

  checkedPlaces.value.push(placeId)
  points.value += 1

  // 保存打卡记录
  checkinRecords.value.push({
    placeId,
    distance: Number.isFinite(record.distance) ? Math.round(record.distance * 10) / 10 : null,
    time: new Date().toISOString(),
    method: record.method || 'manual',
  })

  // 检查是否有路线因此首次完成
  const routeCompleted = []
  for (const route of routes) {
    if (completedSet.value.has(route.id)) continue
    if (!route.points?.length) continue

    const allChecked = route.points.every(id => checkedSet.value.has(id))
    if (allChecked) {
      completedRoutes.value.push(route.id)
      points.value += 5
      routeCompleted.push(route.id)
    }
  }

  return { newlyChecked: true, routeCompleted }
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

// 初始化加载
loadProgress()
