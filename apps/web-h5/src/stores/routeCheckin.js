import { ref, computed } from 'vue'
import { getPlaceById } from '@/data/campusPlaces'
import {
  checkedPlaces,
  completedRoutes,
  isPlaceChecked,
  isRouteCompleted,
  getRouteCheckedCount,
} from './userProgress'

/**
 * 当前探索状态（仅用于路线导航，不保存打卡数据）
 * {
 *   id: string,
 *   name: string,
 *   points: string[],
 *   currentIndex: number
 * }
 */
export const currentRoute = ref(null)

export const isExploring = computed(() => currentRoute.value !== null)

export const currentPlace = computed(() => {
  if (!currentRoute.value) return null
  const id = currentRoute.value.points[currentRoute.value.currentIndex]
  return getPlaceById(id)
})

export const totalStops = computed(() => currentRoute.value?.points?.length ?? 0)

export const completedCount = computed(() => {
  if (!currentRoute.value) return 0
  return getRouteCheckedCount(currentRoute.value.id)
})

export const progressText = computed(() => {
  if (!currentRoute.value) return ''
  return `${completedCount.value}/${totalStops.value}`
})

export const currentStepText = computed(() => {
  if (!currentRoute.value) return ''
  return `第${currentRoute.value.currentIndex + 1}/${totalStops.value}站`
})

/**
 * 获取某条路线的已打卡数量
 */
export function getRouteProgress(routeId) {
  return getRouteCheckedCount(routeId)
}

/**
 * 获取路线下一个未打卡目标
 */
export function getNextTarget(routeId, points) {
  if (!points?.length) return null
  for (const id of points) {
    if (!isPlaceChecked(id)) {
      return getPlaceById(id)
    }
  }
  return null
}

/**
 * 开始探索某条路线
 */
export function startExplore(route) {
  if (!route?.points?.length) return false

  currentRoute.value = {
    id: route.id,
    name: route.name,
    points: [...route.points],
    currentIndex: 0,
  }

  return true
}

/**
 * 仅进入下一地点（不重复打卡）
 * @returns {boolean} 是否还有下一站
 */
export function advanceRoute() {
  if (!currentRoute.value) return false
  if (currentRoute.value.currentIndex < currentRoute.value.points.length - 1) {
    currentRoute.value.currentIndex++
    return true
  }
  return false
}

/**
 * 重置探索状态（不清除用户打卡进度）
 */
export function resetRouteCheckin() {
  currentRoute.value = null
}
