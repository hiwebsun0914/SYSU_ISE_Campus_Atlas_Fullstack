<template>
  <div class="map-shell">
    <header class="map-header">
      <button class="icon-btn" type="button" aria-label="返回" @click="router.back()">
        <ArrowLeft :size="22" />
      </button>
      <div class="header-title">
        <h1>校园地图</h1>
        <span>CAMPUS MAP · {{ MAP_CONFIG.campus }}</span>
      </div>
      <button class="icon-btn" type="button" aria-label="地点列表" @click="listVisible = true">
        <List :size="22" />
      </button>
    </header>

    <div class="map-stage" ref="mapStage">
      <CampusMap
        ref="campusMapRef"
        :locations="locations"
        :selected-id="selectedPlace?.id ?? null"
        @marker-click="onMarkerClick"
        @map-click="onMapClick"
        @map-ready="onMapReady"
        @map-error="onMapError"
      />

      <div v-if="mapReady" class="map-toolbar">
        <button type="button" aria-label="定位" @click="campusMapRef?.locateUser()">
          <Crosshair :size="20" />
        </button>
        <button type="button" aria-label="复位" @click="campusMapRef?.resetView()">
          <RotateCcw :size="20" />
        </button>
        <button type="button" aria-label="切换图层" @click="campusMapRef?.toggleLayer()">
          <Layers :size="20" />
        </button>
      </div>

      <div v-if="mapReady" class="map-filters" ref="filterScroll">
        <button
          v-for="[key, meta] in Object.entries(CATEGORY_MAP)"
          :key="key"
          type="button"
          :class="['filter-chip', { active: activeCategory === key }]"
          @click="toggleCategory(key)"
        >
          <span class="filter-icon">{{ meta.icon }}</span>
          <span>{{ meta.label }}</span>
        </button>
      </div>
    </div>

    <PointDisplay />

    <RoutePanel
      :selected-route-id="selectedRoute?.id ?? null"
      :exploring-route-id="exploringRoute?.id ?? null"
      @route-select="onRouteSelect"
      @start-explore="onStartExplore"
      @open-hidden="goHiddenCheckpoints"
    />

    <Transition name="sheet">
      <div v-if="selectedPlace" class="place-sheet">
        <CheckinCard
          :place="selectedPlace"
          :primary-label="isExploring && selectedPlace?.id === currentPlace?.id ? '完成打卡' : ''"
          :geo-status="geoStatus"
          :geo-distance="geoDistance"
          :geo-error="geoError"
          @geo-checkin="onGeoCheckin"
          @close="selectedPlace = null"
        />
      </div>
    </Transition>

    <Transition name="drawer">
      <aside v-if="listVisible" class="list-drawer">
        <div class="list-drawer-header">
          <h2>校园地点</h2>
          <button class="icon-btn" type="button" aria-label="关闭" @click="listVisible = false">
            <X :size="22" />
          </button>
        </div>
        <div class="list-drawer-search">
          <Search :size="18" />
          <input v-model="searchQuery" type="text" placeholder="搜索地点..." />
        </div>
        <ul class="place-list">
          <li v-for="place in filteredPlaces" :key="place.id">
            <button type="button" @click="selectFromList(place)">
              <span class="place-icon">{{ CATEGORY_MAP[place.category]?.icon || '📍' }}</span>
              <span class="place-info">
                <strong>{{ place.name }}</strong>
                <small>{{ place.shortDesc }}</small>
              </span>
            </button>
          </li>
        </ul>
      </aside>
    </Transition>

    <div v-if="toastMessage" class="map-toast" role="status">
      <span>{{ toastMessage }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  ArrowLeft, Crosshair, Layers, List,
  RotateCcw, Search, X,
} from '@lucide/vue'
import CampusMap from '@/components/CampusMap.vue'
import RoutePanel from '@/components/RoutePanel.vue'
import PointDisplay from '@/components/PointDisplay.vue'
import CheckinCard from '@/components/CheckinCard.vue'
import { campusLocations, CATEGORY_MAP, MAP_CONFIG, searchPlaces, getPlaceById, placeIdToBackend } from '@/data/campusPlaces'
import routes from '@/data/routes'

import {
  currentRoute as exploringRoute,
  isExploring,
  currentPlace,
  startExplore,
  advanceRoute,
  resetRouteCheckin,
} from '@/stores/routeCheckin'
import { fetchUserProgress } from '@/stores/userProgress'
import { CHECKIN_RADIUS } from '@/utils/geoCheckin'
import checkinFlow from '@/utils/checkinFlow'

const router = useRouter()
const route = useRoute()
const campusMapRef = ref(null)

const visibleBase = campusLocations.filter(p => p.isHidden !== 1)
const locations = ref([...visibleBase])
const selectedPlace = ref(null)
const activeCategory = ref('all')
const selectedRoute = ref(null) // 当前选中的路线
const listVisible = ref(false)
const searchQuery = ref('')
const mapReady = ref(false)
const mapLoading = ref(false)
const mapError = ref('')
const toastMessage = ref('')
let toastTimer = null
let lastConsumedDeepLink = ''



// 定位打卡状态
const geoStatus = ref('idle') // 'idle' | 'locating' | 'too_far' | 'success' | 'error'
const geoDistance = ref(null)
const geoError = ref('')

const filteredPlaces = computed(() => {
  const list = searchPlaces(searchQuery.value)
  if (activeCategory.value === 'all') return list
  return list.filter(p => p.category === activeCategory.value)
})

function showToast(msg) {
  toastMessage.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMessage.value = '' }, 3000)
}

function onMarkerClick(place) {
  selectedPlace.value = place
  // 重置打卡定位状态
  geoStatus.value = 'idle'
  geoDistance.value = null
  geoError.value = ''
}

function onMapClick() {
  selectedPlace.value = null
}

function goHiddenCheckpoints() {
  router.push('/hidden-checkpoints')
}

async function onRouteSelect(route) {
  if (!route) {
    // 取消选中：恢复全量地点 + 默认视野 + 清除路线覆盖物 + 退出探索
    selectedRoute.value = null
    resetRouteCheckin()
    updateLocations()
    campusMapRef.value?.clearRoute()
    nextTick(() => {
      campusMapRef.value?.resetView()
    })
    return
  }

  selectedRoute.value = route
  activeCategory.value = 'all' // 路线模式下重置分类
  updateLocations()

  // 地点列表更新后立即进入路线显示模式：仅保留路线点、顺序编号和连线
  await nextTick()
  await campusMapRef.value?.startRoute(route)

  console.log('[Route] selected:', route.name, 'points:', route.points ?? [])
}

/** 开始探索：初始化打卡状态，显示路线，定位第一站 */
async function onStartExplore(route) {
  if (!route || !route.points?.length) return

  // 选中并显示路线
  if (selectedRoute.value?.id !== route.id) {
    await onRouteSelect(route)
  }

  // 初始化探索状态
  startExplore(route)

  // 打开第一站卡片并定位
  if (currentPlace.value) {
    selectedPlace.value = currentPlace.value
    nextTick(() => {
      campusMapRef.value?.flyTo(currentPlace.value.lnglat)
    })
  }
}

/** 监听当前探索地点变化，自动打开卡片 */
watch(currentPlace, (place) => {
  if (isExploring.value && place) {
    selectedPlace.value = place
    geoStatus.value = 'idle'
    geoDistance.value = null
    geoError.value = ''
  }
})

/** 根据当前模式（路线 / 分类）更新地图地点列表 */
function updateLocations() {
  if (selectedRoute.value) {
    const ids = selectedRoute.value.points ?? []
    locations.value = ids.map(id => getPlaceById(id)).filter(Boolean)
  } else {
    locations.value = activeCategory.value === 'all'
      ? visibleBase
      : visibleBase.filter(p => p.category === activeCategory.value)
  }
}

function onMapReady() {
  mapReady.value = true
  mapLoading.value = false
  consumeMapDeepLink()
}

function onMapError(msg) {
  mapError.value = msg
  mapLoading.value = false
  showToast(msg)
}

function toggleCategory(key) {
  // 路线模式下切换分类：先退出路线模式并清理覆盖物
  if (selectedRoute.value) {
    selectedRoute.value = null
    resetRouteCheckin()
    campusMapRef.value?.clearRoute()
  }
  activeCategory.value = activeCategory.value === key ? 'all' : key
  updateLocations()
}

function selectFromList(place) {
  selectedPlace.value = place
  listVisible.value = false
  nextTick(() => {
    campusMapRef.value?.flyTo(place.lnglat)
  })
}

/** 定位打卡：获取用户位置并判断距离 */
async function onGeoCheckin() {
  if (!selectedPlace.value || !campusMapRef.value) return

  // 重置状态，开始定位
  geoStatus.value = 'locating'
  geoDistance.value = null
  geoError.value = ''

  try {
    const pos = await campusMapRef.value.getUserPosition()
    const targetLnglat = selectedPlace.value.lnglat
    const dist = campusMapRef.value.getDistance(pos, targetLnglat)

    geoDistance.value = dist

    if (dist <= CHECKIN_RADIUS) {
      // 在 50m 范围内：进入拍照打卡流程，照片通过审核后才计分
      geoStatus.value = 'success'
      submitPhotoCheckin()
    } else {
      // 距离过远
      geoStatus.value = 'too_far'
    }
  } catch (err) {
    geoStatus.value = 'error'
    geoError.value = err?.message || '定位失败'
  }
}

/** 50m 范围内进入拍照打卡：上传照片并通过审核才计分、解锁地点 */
async function submitPhotoCheckin() {
  const placeId = selectedPlace.value.id
  const backendId = placeIdToBackend[placeId]
  if (!backendId) {
    geoStatus.value = 'error'
    geoError.value = '地点数据异常，请稍后重试'
    return
  }

  try {
    const result = await checkinFlow.runCheckin({
      locationId: backendId,
      onError: (reason) => {
        if (reason === 'unauthorized') {
          checkinFlow.pushOrRedirect('/signin', route, router)
        }
      },
      // 提交成功后只进入待审核状态；审核通过后才解锁并计分
      onSubmitted: async () => {
        try { await fetchUserProgress() } catch (e) { /* 忽略刷新异常 */ }
      },
    })

    // 照片进入待审后即可前往路线下一站
    if (result?.ok && isExploring.value && currentPlace.value?.id === placeId) {
      const hasNext = advanceRoute()
      if (hasNext && currentPlace.value) {
        selectedPlace.value = currentPlace.value
        nextTick(() => {
          campusMapRef.value?.flyTo(currentPlace.value.lnglat)
        })
      } else {
        showToast(`🎉 ${exploringRoute.value?.name} 探索完成！`)
        selectedPlace.value = null
        resetRouteCheckin()
      }
    }

    // 回到可重试状态（成功提交后卡片会显示“照片审核中”）
    geoStatus.value = 'idle'
  } catch (err) {
    console.error('[submitPhotoCheckin] error:', err)
    showToast(err?.message || '打卡失败，请重试')
    geoStatus.value = 'error'
    geoError.value = err?.message || '打卡失败'
  }
}

function queryValue(value) {
  return Array.isArray(value) ? value[0] : value
}

function resetDeepLinkedMap() {
  selectedPlace.value = null
  activeCategory.value = 'all'
  onRouteSelect(null)
}

async function consumeMapDeepLink() {
  if (!mapReady.value || !campusMapRef.value) return
  const routeId = queryValue(route.query.route)
  const placeId = queryValue(route.query.place)
  if (!routeId && !placeId) {
    if (lastConsumedDeepLink) resetDeepLinkedMap()
    lastConsumedDeepLink = ''
    return
  }

  const deepLinkKey = `${routeId || ''}:${placeId || ''}`
  if (deepLinkKey === lastConsumedDeepLink) return
  lastConsumedDeepLink = deepLinkKey

  const targetRoute = routes.find(item => item.id === routeId)
  const targetPlace = getPlaceById(placeId)
  const placeBelongsToRoute = Boolean(
    targetRoute && targetPlace && targetRoute.points?.some(id => Number(id) === Number(targetPlace.backendId)),
  )

  if (!targetRoute || !targetPlace || targetPlace.isHidden === 1 || !placeBelongsToRoute) {
    resetDeepLinkedMap()
    showToast('路线或地点链接无效，已为你打开完整地图')
    return
  }

  onRouteSelect(targetRoute)
  await nextTick()
  await campusMapRef.value?.startRoute(targetRoute)
  selectedPlace.value = targetPlace
  campusMapRef.value?.flyTo(targetPlace.lnglat)
}

watch(
  () => [route.query.route, route.query.place],
  () => consumeMapDeepLink(),
)



onMounted(() => {
  document.title = '校园地图｜中山大学智能工程学院'
  // 页面加载时从后端同步一次用户进度
  fetchUserProgress().catch(err => {
    console.warn('[Map] fetchUserProgress failed:', err)
    // 只在未登录/未授权时提示登录；网络或后端异常静默处理
    if (err.type === 'unauthorized' || err.message?.includes('未登录') || err.message?.includes('登录')) {
      showToast('请先登录，打卡数据将同步到云端')
    }
  })
})

onBeforeUnmount(() => {
  clearTimeout(toastTimer)
})
</script>

<style scoped>
.map-shell {
  --ink: #0a2e3b;
  --primary: #0d9488;
  --primary-dark: #08766d;
  --accent: #c7f24a;
  --canvas: #f3f7f5;
  --surface: #fff;
  --text: #102a2e;
  --muted: #5e7271;
  --border: #d6e4df;
  --mobile-nav-clearance: calc(86px + env(safe-area-inset-bottom, 0px));
  position: relative;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--canvas);
  overflow: hidden;
  color: var(--text);
  padding-bottom: var(--mobile-nav-clearance);
}

.map-header {
  flex: 0 0 auto;
  height: calc(56px + env(safe-area-inset-top, 0px));
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: env(safe-area-inset-top, 0px) calc(12px + env(safe-area-inset-right, 0px)) 0 calc(12px + env(safe-area-inset-left, 0px));
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  z-index: 20;
}

.header-title {
  text-align: center;
}

.header-title h1 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
}

.header-title span {
  display: block;
  font-size: 10px;
  color: var(--muted);
  letter-spacing: .05em;
}

.icon-btn {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--ink);
  cursor: pointer;
}

.icon-btn:hover { background: #eef5f2; }

.map-stage {
  flex: 1;
  min-height: 0;
  position: relative;
  z-index: 0;
  isolation: isolate;
  overflow: hidden;
  background: #e8efe9;
}

.map-toolbar {
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 15;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.map-toolbar button {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 12px;
  background: var(--surface);
  color: var(--ink);
  box-shadow: 0 2px 10px rgba(10,46,59,.12);
  cursor: pointer;
}

.map-toolbar button:hover { background: var(--accent); }

.map-filters {
  position: absolute;
  left: 12px;
  bottom: 12px;
  z-index: 15;
  display: flex;
  gap: 8px;
  max-width: calc(100% - 80px);
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.map-filters::-webkit-scrollbar { display: none; }

.filter-chip {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--muted);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}

.filter-chip.active {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}

.place-sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 25;
  background: var(--surface);
  height: 85%;
  padding: 44px 16px var(--mobile-nav-clearance);
  display: flex;
  flex-direction: column;
}

.sheet-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 50%;
  background: rgba(0,0,0,.05);
  color: var(--muted);
  cursor: pointer;
}

.sheet-cover {
  width: 100%;
  height: 100px;
  border-radius: 14px;
  background: #e8efe9;
  background-size: cover;
  background-position: center;
  display: grid;
  place-items: center;
  margin-bottom: 10px;
}

.sheet-cover-fallback {
  font-size: 48px;
}

.sheet-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.sheet-category,
.sheet-tag {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
}

.sheet-category {
  background: var(--primary);
  color: #fff;
}

.sheet-tag {
  background: #eef5f2;
  color: var(--muted);
}

.place-sheet h2 {
  margin: 0 0 4px;
  font-size: 20px;
}

.place-sheet p {
  margin: 0 0 10px;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.6;
}

.sheet-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.sheet-description {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  margin-bottom: 14px;
  font-size: 15px;
  line-height: 1.7;
  color: var(--muted);
}

.sheet-description :deep(p) { margin: 0 0 10px; }

.sheet-description :deep(ul) { margin: 0 0 10px; padding-left: 18px; }

.sheet-description :deep(li) { margin-bottom: 6px; }

.sheet-actions {
  display: flex;
  gap: 10px;
}

.btn-primary,
.btn-ghost {
  flex: 1;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.btn-primary {
  border: none;
  background: var(--primary);
  color: #fff;
}

.btn-ghost {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--ink);
}

.list-drawer {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(320px, 80vw);
  z-index: 30;
  background: var(--surface);
  box-shadow: -4px 0 24px rgba(10,46,59,.12);
  display: flex;
  flex-direction: column;
}

.list-drawer-header {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border-bottom: 1px solid var(--border);
}

.list-drawer-header h2 {
  margin: 0;
  font-size: 16px;
}

.list-drawer-search {
  margin: 12px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--canvas);
}

.list-drawer-search input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-size: 14px;
}

.place-list {
  flex: 1;
  margin: 0;
  padding: 0 12px 12px;
  list-style: none;
  overflow-y: auto;
}

.place-list li {
  margin-bottom: 8px;
}

.place-list button {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  text-align: left;
  cursor: pointer;
}

.place-icon {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--canvas);
  font-size: 16px;
}

.place-info {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.place-info strong {
  font-size: 14px;
}

.place-info small {
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.map-toast {
  position: absolute;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 40;
  padding: 10px 18px;
  border-radius: 999px;
  background: var(--ink);
  color: #fff;
  font-size: 13px;
  box-shadow: 0 4px 16px rgba(10,46,59,.2);
}

.sheet-enter-active,
.sheet-leave-active {
  transition: transform .28s cubic-bezier(.2,.75,.25,1), opacity .2s ease;
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
  transform: translateY(100%);
}

.drawer-enter-active,
.drawer-leave-active {
  transition: transform .25s ease;
}

.drawer-enter-from,
.drawer-leave-to {
  transform: translateX(100%);
}

@media (min-width: 700px) {
  .place-sheet {
    left: auto;
    right: 16px;
    bottom: 16px;
    width: 380px;
    height: 85%;
    border-radius: 20px;
  }
}

@media (min-width: 1024px) {
  .map-shell { padding-bottom: 0; }
  .place-sheet { padding-bottom: 16px; }
}
</style>
