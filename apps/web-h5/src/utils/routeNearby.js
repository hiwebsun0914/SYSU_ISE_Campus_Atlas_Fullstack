import { getPlaceById } from '@/data/campusPlaces'

// 路线附近地点判定半径（单位：米）
export const NEARBY_DISTANCE = 50

/**
 * 查找路线附近的地点
 * @param {Array} path - 路线坐标数组 [[lng, lat], ...]
 * @param {Array} allPlaces - campusPlaces 中所有地点
 * @param {Array<string>} excludeIds - 需要排除的地点 id（如路线本身的 points）
 * @param {number} distance - 距离阈值，默认 NEARBY_DISTANCE
 */
export function findNearbyPlaces(path, allPlaces, excludeIds = [], distance = NEARBY_DISTANCE) {
  if (!path || path.length < 2 || !allPlaces?.length) return []

  const excludeSet = new Set(excludeIds)

  return allPlaces.filter(place => {
    if (!place?.lnglat || place.lnglat.length < 2) return false
    if (excludeSet.has(place.id)) return false

    const dist = pointToPolylineDistance(place.lnglat, path)
    return dist <= distance
  })
}

/**
 * 创建提醒 Marker（显示 "!"）
 */
export function createReminderMarker(AMapNS, place, onClick) {
  const marker = new AMapNS.Marker({
    position: place.lnglat,
    content: `
      <div style="
        width:26px;
        height:26px;
        border-radius:50%;
        background:#ff9800;
        color:#fff;
        display:flex;
        align-items:center;
        justify-content:center;
        font-weight:700;
        font-size:14px;
        box-shadow:0 2px 8px rgba(0,0,0,.2);
        border:2px solid #fff;
        pointer-events:auto;
        cursor:pointer;
      ">!</div>
    `,
    offset: new AMapNS.Pixel(-13, -13),
    zIndex: 150,
  })

  marker.on('click', () => onClick(place))
  return marker
}

/**
 * 清除提醒 Marker
 */
export function clearNearbyMarkers(markers) {
  if (!markers) return
  markers.forEach(m => m.setMap(null))
  markers.length = 0
}

/**
 * 构建 InfoWindow 内容（简化信息卡片）
 */
export function buildInfoWindowHTML(place) {
  return `
    <div style="
      min-width:160px;
      max-width:220px;
      padding:12px 14px;
      font-family:system-ui,-apple-system,sans-serif;
    ">
      <div style="
        font-size:15px;
        font-weight:700;
        color:#0a2e3b;
        margin-bottom:6px;
      ">${escapeHtml(place.name)}</div>
      ${place.shortDesc ? `<div style="font-size:13px;color:#63737b;line-height:1.5;">${escapeHtml(place.shortDesc)}</div>` : ''}
      ${place.category ? `<div style="margin-top:8px;font-size:12px;color:#909ea5;">${escapeHtml(place.category)}</div>` : ''}
    </div>
  `
}

/**
 * 计算点到折线的最短距离（米）
 */
function pointToPolylineDistance(point, path) {
  let minDist = Infinity
  for (let i = 0; i < path.length - 1; i++) {
    const dist = pointToSegmentDistance(point, path[i], path[i + 1])
    if (dist < minDist) minDist = dist
  }
  return minDist
}

/**
 * 计算点到线段的最短距离（米）
 */
function pointToSegmentDistance(p, a, b) {
  const [px, py] = pointToLngLat(p)
  const [ax, ay] = pointToLngLat(a)
  const [bx, by] = pointToLngLat(b)

  const dx = bx - ax
  const dy = by - ay

  if (dx === 0 && dy === 0) return distance(p, a)

  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  const closest = [ax + t * dx, ay + t * dy]

  return distance(p, closest)
}

/**
 * 计算两点之间的距离（米）
 */
function distance(p1, p2) {
  const R = 6371000 // 地球半径，单位：米
  const [lng1, lat1] = pointToLngLat(p1)
  const [lng2, lat2] = pointToLngLat(p2)

  const radLat1 = lat1 * Math.PI / 180
  const radLat2 = lat2 * Math.PI / 180
  const deltaLat = (lat2 - lat1) * Math.PI / 180
  const deltaLng = (lng2 - lng1) * Math.PI / 180

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) *
    Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

/**
 * 统一坐标为 [lng, lat]
 */
function pointToLngLat(pt) {
  if (Array.isArray(pt)) return [pt[0], pt[1]]
  if (pt && typeof pt.getLng === 'function' && typeof pt.getLat === 'function') {
    return [pt.getLng(), pt.getLat()]
  }
  if (pt && typeof pt.lng === 'number' && typeof pt.lat === 'number') {
    return [pt.lng, pt.lat]
  }
  return [0, 0]
}

/**
 * 简单的 HTML 转义，防止 InfoWindow 内容注入
 */
function escapeHtml(text) {
  if (text == null) return ''
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
