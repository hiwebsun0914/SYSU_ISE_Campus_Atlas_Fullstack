<template>
  <div ref="container" class="campus-map-container">
    <div v-if="status === 'loading'" class="map-overlay">
      <div class="map-overlay-content">
        <span class="spinner" />
        <p>地图加载中...</p>
      </div>
    </div>
    <div v-else-if="status === 'error'" class="map-overlay map-overlay-error">
      <div class="map-overlay-content">
        <p class="error-icon">⚠️</p>
        <p class="error-text">{{ errorMsg }}</p>
        <button class="retry-btn" @click="reload">重试</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import {
  resolveRoutePlaces,
  buildNumberBadgeHTML,
  createRoutePolyline,
  planWalkingRoute,
} from '@/utils/routeManager'
import { checkedPlaces, isPlaceChecked } from '@/stores/userProgress'
import { getUserPosition as geoGetUserPosition, calcDistance } from '@/utils/geoCheckin'

window._AMapSecurityConfig = {
  securityJsCode: '2fdd6731124c1ead5c18535fd74f7db2',
}

const props = defineProps({
  locations: { type: Array, default: () => [] },
  selectedId: { type: [String, Number, null], default: null },
})

const emit = defineEmits(['marker-click', 'map-click', 'map-ready', 'map-error'])

const container = ref(null)
const status = ref('loading')
const errorMsg = ref('')

let mapInstance = null
let AMapNS = null
const markerMap = new Map()
const markerLevels = new Map()
let layerIndex = 0

// 路线探索模式状态
let routeMode = false
const routeMarkers = []
let routePolyline = null
let routeRenderVersion = 0

const LEVEL_ZOOM = { 1: 1, 2: 14, 3: 17 }

const CONFIG = {
  key: '12a77a7d701917410324b1be7714e45f',
  version: '2.0',
  // 初始视野中心取“非隐藏打卡点”的质心，让标记密集区落在页面中央
  defaultCenter: [113.2982, 23.0967],
  defaultZoom: 16,
  minZoom: 14,
  maxZoom: 19,
  defaultPitch: 45,
  styles: ['amap://styles/normal', 'amap://styles/dark'],
}

const ROUTE_MAX_ZOOM = 17

const CATEGORY_ICONS = {
  landmark: '⭐', teaching: '📚', canteen: '🍜', dormitory: '🏠',
  library: '📖', sports: '⚽', service: '🏪',
}

function loadAMapScript() {
  return new Promise((resolve, reject) => {
    if (window.AMap && window.AMap.Map) {
      resolve(window.AMap)
      return
    }

    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.async = true
    script.src = `https://webapi.amap.com/maps?v=${CONFIG.version}&key=${CONFIG.key}&plugin=AMap.Scale,AMap.Geolocation`

    const timer = setTimeout(() => {
      reject(new Error('地图脚本加载超时，请检查网络'))
    }, 15000)

    script.onload = () => {
      clearTimeout(timer)
      if (window.AMap && window.AMap.Map) {
        resolve(window.AMap)
      } else {
        reject(new Error('脚本加载后未找到 window.AMap'))
      }
    }

    script.onerror = () => {
      clearTimeout(timer)
      reject(new Error('地图脚本加载失败'))
    }

    document.head.appendChild(script)
  })
}

function buildMarkerHTML(place) {
  const checked = isPlaceChecked(place.id)
  const selected = props.selectedId === place.id
  const icon = CATEGORY_ICONS[place.category] || '📍'
  const size = selected ? 44 : 36
  const fontSize = selected ? 18 : 14

  let bg, border
  if (checked) {
    bg = '#16a34a'; border = '#15803d'
  } else if (selected) {
    bg = '#0d9488'; border = '#0b7a72'
  } else {
    bg = '#fff'; border = '#9ca3af'
  }

  const shadow = selected
    ? '0 4px 20px rgba(13,148,136,.5)'
    : '0 2px 8px rgba(10,46,59,.18)'
  let labelBg, labelText
  if (checked) {
    labelBg = 'rgba(22,163,74,.92)'; labelText = '#fff'
  } else if (selected) {
    labelBg = 'rgba(13,148,136,.92)'; labelText = '#fff'
  } else {
    labelBg = 'rgba(255,255,255,.9)'; labelText = '#0a2e3b'
  }

  return `
<div style="display:flex;flex-direction:column;align-items:center;
  pointer-events:none;transform:translate(-50%,-100%);">
  <div style="width:${size}px;height:${size}px;border-radius:50%;
    background:${bg};border:2.5px solid ${border};box-shadow:${shadow};
    display:flex;align-items:center;justify-content:center;
    font-size:${fontSize}px;transition:all .18s ease;position:relative;
    cursor:pointer;pointer-events:auto;">
    ${icon}
    ${checked ? '<div style="position:absolute;top:-3px;right:-3px;width:16px;height:16px;border-radius:50%;background:#16a34a;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;">✓</div>' : ''}
  </div>
  <div style="margin-top:4px;padding:2px 9px;border-radius:5px;font-size:11px;
    font-weight:600;color:${labelText};background:${labelBg};
    white-space:nowrap;max-width:120px;overflow:hidden;text-overflow:ellipsis;
    box-shadow:0 1px 4px rgba(10,46,59,.1);pointer-events:none;">${escapeHTML(place.name)}</div>
</div>`
}

function escapeHTML(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function clearAllMarkers() {
  for (const m of markerMap.values()) {
    try { m?.setMap?.(null) } catch (_) { /* noop */ }
  }
  markerMap.clear()
  markerLevels.clear()
}

function showHideByZoom() {
  if (!mapInstance) return
  const zoom = mapInstance.getZoom()
  for (const [id, marker] of markerMap.entries()) {
    const level = markerLevels.get(id) ?? 2

    const levelOk = level === 1 || (level === 2 && zoom >= 14) || (level === 3 && zoom >= 17)

    marker.setMap(levelOk ? mapInstance : null)
  }
}

function rebuildMarkers() {
  if (!mapInstance || !AMapNS || !Array.isArray(props.locations)) return
  if (routeMode) return // 路线模式下由路线覆盖物接管 Marker
  clearAllMarkers()

  for (const place of props.locations) {
    if (!place?.lnglat || place.lnglat.length < 2) continue
    if (place.isHidden === 1) continue

    const marker = new AMapNS.Marker({
      position: place.lnglat,
      content: buildMarkerHTML(place),
      zIndex: props.selectedId === place.id ? 200 : 100,
    })

    marker.on('click', () => emit('marker-click', { ...place }))
    marker.setMap(mapInstance)
    markerMap.set(place.id, marker)
    markerLevels.set(place.id, place.level ?? 2)
  }

  showHideByZoom()
}

function refreshMarker(placeId) {
  const marker = markerMap.get(placeId)
  if (!marker) return
  const place = props.locations?.find(p => p.id === placeId)
  if (!place) return
  marker.setContent(buildMarkerHTML(place))
  marker.setzIndex(props.selectedId === placeId ? 200 : 100)
}

async function initMap() {
  if (!container.value) {
    setError('地图容器不存在')
    return
  }

  try {
    AMapNS = await loadAMapScript()

    mapInstance = new AMapNS.Map(container.value, {
      center: CONFIG.defaultCenter,
      zoom: CONFIG.defaultZoom,
      zooms: [CONFIG.minZoom, CONFIG.maxZoom],
      pitch: CONFIG.defaultPitch,
      viewMode: '3D',
      mapStyle: CONFIG.styles[0],
      features: ['bg', 'road', 'building'],
      showIndoorMap: false,
      resizeEnable: true,
      touchZoom: true,
      dragEnable: true,
      zoomEnable: true,
    })

    mapInstance.addControl(new AMapNS.Scale({ position: 'LB' }))

    mapInstance.on('click', (e) => {
      if (!e.target) emit('map-click')
    })

    mapInstance.on('zoomchange', () => {
      showHideByZoom()
    })

    rebuildMarkers()

    status.value = 'ready'
    emit('map-ready')
  } catch (err) {
    setError(err.message || '地图初始化失败')
  }
}

function setError(msg) {
  status.value = 'error'
  errorMsg.value = msg
  emit('map-error', msg)
}

function reload() {
  status.value = 'loading'
  errorMsg.value = ''
  destroyMap()
  nextTick(() => initMap())
}

function destroyMap() {
  routeRenderVersion += 1
  routeMode = false
  removeRouteOverlays()
  clearAllMarkers()
  if (mapInstance) {
    try { mapInstance.destroy() } catch (_) { /* noop */ }
    mapInstance = null
  }
  AMapNS = null
}

function flyTo(lnglat, zoom = 17) {
  if (!mapInstance || !lnglat || lnglat.length < 2) return
  mapInstance.setZoomAndCenter(zoom, lnglat)
}

/**
 * 根据一组坐标自动调整地图视野
 * @param {Array<[number,number]>} lnglats - [[lng, lat], ...]
 */
function fitToBounds(lnglats) {
  if (!mapInstance || !AMapNS || !lnglats?.length) return
  if (lnglats.length === 1) {
    mapInstance.setZoomAndCenter(17, lnglats[0])
    return
  }
  const bounds = new AMapNS.LngLatBounds(
    new AMapNS.LngLat(lnglats[0][0], lnglats[0][1]),
    new AMapNS.LngLat(lnglats[0][0], lnglats[0][1])
  )
  for (let i = 1; i < lnglats.length; i++) {
    bounds.extend([lnglats[i][0], lnglats[i][1]])
  }
  mapInstance.setFitView(bounds, false, [80, 80, 300, 80])
}

function getRouteFitPadding() {
  const viewportWidth = container.value?.clientWidth || window.innerWidth
  return viewportWidth < 700
    ? [72, 72, 36, 36]
    : [64, 64, 64, 64]
}

/**
 * 进入路线探索模式：立即显示编号、预览线与完整视野，再后台细化步行路径
 */
function startRoute(route) {
  if (!mapInstance || !AMapNS || !route) return

  const renderVersion = ++routeRenderVersion
  routeMode = true
  removeRouteOverlays()

  const places = resolveRoutePlaces(route)
  if (places.length === 0) {
    routeMode = false
    rebuildMarkers()
    return
  }

  // 隐藏普通地点 Marker
  clearAllMarkers()

  // 创建编号 Marker
  places.forEach((place, index) => {
    const marker = new AMapNS.Marker({
      position: place.lnglat,
      content: buildNumberBadgeHTML(index + 1),
      offset: new AMapNS.Pixel(-15, -15),
      zIndex: 200,
    })
    marker.on('click', () => emit('marker-click', { ...place }))
    marker.setMap(mapInstance)
    routeMarkers.push(marker)
  })

  // 先用地点坐标立即画出绿色预览线，避免等待多段步行规划
  const directPath = places.map(place => place.lnglat)
  if (directPath.length > 1) {
    routePolyline = createRoutePolyline(AMapNS, directPath)
    if (routePolyline) routePolyline.setMap(mapInstance)
  }

  // 视野与首屏路线同时确定，不等待高德步行规划完成
  if (routeMarkers.length > 0) {
    mapInstance.setFitView(routeMarkers, false, getRouteFitPadding(), ROUTE_MAX_ZOOM)
  }

  if (places.length > 1) {
    void refineWalkingRoute(places, renderVersion)
  }
}

async function refineWalkingRoute(places, renderVersion) {
  try {
    const refinedPath = await planWalkingRoute(AMapNS, mapInstance, places)
    if (
      refinedPath.length < 2 ||
      renderVersion !== routeRenderVersion ||
      !routeMode ||
      !mapInstance ||
      !routePolyline
    ) return

    // 只替换线条路径，不再次调整视野，避免地图在加载后突然缩放
    routePolyline.setPath(refinedPath)
  } catch (err) {
    console.warn('[CampusMap] walking route refinement failed, keeping direct preview:', err)
  }
}

/**
 * 退出路线探索模式并恢复普通 Marker
 */
function clearRoute() {
  routeRenderVersion += 1
  routeMode = false

  removeRouteOverlays()
  rebuildMarkers()
}

function removeRouteOverlays() {
  routeMarkers.forEach(m => m.setMap(null))
  routeMarkers.length = 0

  if (routePolyline) {
    routePolyline.setMap(null)
    routePolyline = null
  }
}

function locateUser() {
  if (!mapInstance || !AMapNS) return
  AMapNS.plugin('AMap.Geolocation', () => {
    const geo = new AMapNS.Geolocation({
      enableHighAccuracy: true,
      timeout: 10000,
      zoomToAccuracy: true,
    })
    mapInstance.addControl(geo)
    geo.getCurrentPosition((status, result) => {
      if (status === 'complete' && result?.position) {
        mapInstance.setZoomAndCenter(17, [result.position.lng, result.position.lat])
      }
    })
    setTimeout(() => mapInstance.removeControl(geo), 5000)
  })
}

function resetView() {
  if (!mapInstance) return
  mapInstance.setZoomAndCenter(CONFIG.defaultZoom, CONFIG.defaultCenter)
}

function toggleLayer() {
  if (!mapInstance) return
  layerIndex = (layerIndex + 1) % CONFIG.styles.length
  mapInstance.setMapStyle(CONFIG.styles[layerIndex])
}

/**
 * 获取用户当前位置（供外部调用）
 * @returns {Promise<{lng: number, lat: number}>}
 */
function getUserPosition() {
  return geoGetUserPosition(AMapNS, mapInstance)
}

/**
 * 计算两点间距离（供外部调用）
 */
function getDistance(lnglat1, lnglat2) {
  return calcDistance(lnglat1, lnglat2, AMapNS)
}

defineExpose({
  flyTo, fitToBounds, startRoute, clearRoute, locateUser,
  resetView, toggleLayer, getUserPosition, getDistance,
})

watch(() => props.locations, () => {
  if (mapInstance && AMapNS) rebuildMarkers()
}, { deep: true })

watch(() => props.selectedId, (newId, oldId) => {
  if (!mapInstance || !AMapNS) return
  if (oldId != null) refreshMarker(oldId)
  if (newId != null) refreshMarker(newId)
})

watch(checkedPlaces, () => {
  if (!mapInstance || !AMapNS) return
  rebuildMarkers()
  if (props.selectedId) refreshMarker(props.selectedId)
}, { deep: true })

onMounted(() => nextTick(() => initMap()))
onUnmounted(() => destroyMap())
</script>

<style scoped>
.campus-map-container {
  width: 100%;
  height: 100%;
  min-height: 0;
  position: relative;
}

.map-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(232, 239, 233, .97);
}

.map-overlay-error { background: rgba(254, 242, 242, .97); }

.map-overlay-content {
  text-align: center;
  color: #64748b;
}

.map-overlay-content p { margin: 0 0 8px; font-size: 14px; }

.error-icon { font-size: 32px; margin-bottom: 6px; }

.error-text {
  font-size: 14px;
  color: #b91c1c;
  max-width: 280px;
  word-break: break-all;
}

.spinner {
  display: inline-block;
  width: 28px;
  height: 28px;
  border: 3px solid #d1d5db;
  border-top-color: #0d9488;
  border-radius: 50%;
  animation: spin .6s linear infinite;
  margin-bottom: 8px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.retry-btn {
  margin-top: 12px;
  padding: 8px 24px;
  border: none;
  border-radius: 8px;
  background: #0d9488;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.retry-btn:hover { background: #0f766e; }
</style>
