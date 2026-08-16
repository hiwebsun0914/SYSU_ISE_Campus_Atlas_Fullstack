import { getPlaceById } from '@/data/campusPlaces'
import { request } from '@/utils/request'

/**
 * 根据路线 points 解析出完整地点对象（保持顺序，跳过不存在的 id）
 */
export function resolveRoutePlaces(route) {
  if (!route?.points?.length) return []
  return route.points
    .map(id => getPlaceById(id))
    .filter(Boolean)
}

/**
 * 生成带序号的圆形 Marker HTML
 * @param {number} number - 序号
 * @param {'todo'|'current'|'done'} state - 打卡状态：
 *   todo 未到达（灰底数字）、current 下一站（酸橙脉冲）、done 已打卡（绿底✓）
 */
export function buildNumberBadgeHTML(number, state = 'todo') {
  if (state === 'done') {
    return `
    <div style="
      width:30px;
      height:30px;
      border-radius:50%;
      background:#388e6e;
      color:#fff;
      display:flex;
      align-items:center;
      justify-content:center;
      font-weight:700;
      font-size:15px;
      box-shadow:0 2px 10px rgba(0,0,0,.2);
      border:2px solid #fff;
      pointer-events:auto;
      cursor:pointer;
    ">✓</div>
  `
  }
  if (state === 'current') {
    return `
    <div class="route-badge-current" style="
      width:32px;
      height:32px;
      border-radius:50%;
      background:#c7f24a;
      color:#0a2e3b;
      display:flex;
      align-items:center;
      justify-content:center;
      font-weight:800;
      font-size:15px;
      border:2px solid #0a2e3b;
      pointer-events:auto;
      cursor:pointer;
    ">${number}</div>
  `
  }
  return `
    <div style="
      width:30px;
      height:30px;
      border-radius:50%;
      background:#a3b1b8;
      color:#fff;
      display:flex;
      align-items:center;
      justify-content:center;
      font-weight:700;
      font-size:14px;
      box-shadow:0 2px 10px rgba(0,0,0,.16);
      border:2px dashed #fff;
      pointer-events:auto;
      cursor:pointer;
    ">${number}</div>
  `
}

/**
 * 创建路线 Polyline
 * @param {object} AMapNS - 高德地图命名空间
 * @param {Array} path - 路径坐标
 * @param {object} options - 样式覆盖，如 { strokeColor, strokeStyle, showDir }
 */
export function createRoutePolyline(AMapNS, path, options = {}) {
  if (!AMapNS || !path || path.length < 2) return null
  return new AMapNS.Polyline({
    path,
    strokeColor: '#388e6e',
    strokeWeight: 5,
    strokeOpacity: 0.85,
    strokeStyle: 'solid',
    lineJoin: 'round',
    lineCap: 'round',
    showDir: true,
    ...options,
  })
}

/** 路段样式：已走段实线绿，未走段虚线灰 */
export const ROUTE_SEGMENT_STYLES = {
  done: { strokeColor: '#388e6e', strokeStyle: 'solid', strokeOpacity: 0.9 },
  todo: { strokeColor: '#a3b1b8', strokeStyle: 'dashed', strokeOpacity: 0.8 },
}

/**
 * 计算路线地点的坐标路径数组（简单直线连接，备用）
 */
export function buildRoutePath(route) {
  return resolveRoutePlaces(route)
    .filter(p => Array.isArray(p.lnglat) && p.lnglat.length >= 2)
    .map(p => p.lnglat)
}

/**
 * 规划真实步行路线（经由后端 /route/walking 代理 + 缓存）
 * 后端对高德上游串行限速并缓存路段结果，避免前端并发直调触发
 * 高德 CUQPS 限流（2026-08-16 实测：并发 4 直调 54 段有 21 段被限流）。
 * @param {object} AMapNS - 保留参数，兼容旧调用（不再使用）
 * @param {object} mapInstance - 保留参数，兼容旧调用（不再使用）
 * @param {Array} places - 路线地点对象数组
 * @returns {Promise<Array<Array>>} 相邻站点间的分段路径数组；规划失败的段回退为直线
 */
export async function planWalkingRoute(AMapNS, mapInstance, places) {
  if (!places || places.length < 2) {
    return buildRouteSegmentsFromPlaces(places)
  }

  const segmentCount = places.length - 1
  const segmentPaths = new Array(segmentCount)
  let nextSegmentIndex = 0

  async function planNextSegment() {
    while (nextSegmentIndex < segmentCount) {
      const index = nextSegmentIndex++
      const start = normalizeLngLat(places[index].lnglat)
      const end = normalizeLngLat(places[index + 1].lnglat)
      segmentPaths[index] = await planWalkingSegmentViaServer(start, end)
    }
  }

  // 缓存命中时后端即时返回，冷缓存时由后端串行限速；前端保持低并发即可
  const concurrency = Math.min(2, segmentCount)
  await Promise.all(Array.from({ length: concurrency }, () => planNextSegment()))

  return segmentPaths.map((seg, index) => {
    if (Array.isArray(seg) && seg.length >= 2) return seg
    return [normalizeLngLat(places[index].lnglat), normalizeLngLat(places[index + 1].lnglat)]
  })
}

/**
 * 通过后端代理规划相邻两点之间的步行路径，失败返回 null（由调用方回退直线）
 */
async function planWalkingSegmentViaServer(start, end) {
  try {
    const resp = await request('/route/walking', 'GET', {
      from: start.join(','),
      to: end.join(',')
    }, { timeout: 15000 })
    const data = resp?.data?.data
    if (resp?.ok && resp?.data?.code === 0 && Array.isArray(data?.path) && data.path.length >= 2) {
      return data.path.map(normalizeLngLat)
    }
    console.warn('[Walking] server segment unavailable:', resp?.data?.message || resp?.status)
  } catch (err) {
    console.warn('[Walking] server segment error:', err)
  }
  return null
}

/**
 * 将 LngLat 对象或数组统一转换为 [lng, lat] 数组
 */
function normalizeLngLat(pt) {
  if (Array.isArray(pt)) return [pt[0], pt[1]]
  if (pt && typeof pt.getLng === 'function' && typeof pt.getLat === 'function') {
    return [pt.getLng(), pt.getLat()]
  }
  if (pt && typeof pt.lng === 'number' && typeof pt.lat === 'number') {
    return [pt.lng, pt.lat]
  }
  return pt
}

/**
 * 从地点数组构建相邻站点之间的直线路径分段（步行规划的兜底）
 * @returns {Array<Array>} 每段为 [start, end] 两个坐标点
 */
function buildRouteSegmentsFromPlaces(places) {
  const points = (places || [])
    .filter(p => Array.isArray(p.lnglat) && p.lnglat.length >= 2)
    .map(p => normalizeLngLat(p.lnglat))
  const segments = []
  for (let i = 0; i < points.length - 1; i++) {
    segments.push([points[i], points[i + 1]])
  }
  return segments
}
