import { getPlaceById } from '@/data/campusPlaces'

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
 * 使用 AMap.Walking 规划真实步行路线
 * @param {object} AMapNS - AMap 命名空间
 * @param {object} mapInstance - 高德地图实例
 * @param {Array} places - 路线地点对象数组
 * @returns {Promise<Array<Array>>} 相邻站点间的分段路径数组（每段至少 2 个点），
 *   便于按打卡状态为不同路段设置不同样式
 */
export async function planWalkingRoute(AMapNS, mapInstance, places) {
  if (!AMapNS || !mapInstance || places.length < 2) {
    return buildRouteSegmentsFromPlaces(places)
  }

  // 确保 Walking 插件已加载
  await loadWalkingPlugin(AMapNS)

  const segmentCount = places.length - 1
  const segmentPaths = new Array(segmentCount)
  let nextSegmentIndex = 0

  // 同时规划少量相邻路段，兼顾加载速度与地图服务请求压力
  async function planNextSegment() {
    while (nextSegmentIndex < segmentCount) {
      const index = nextSegmentIndex++
      const start = normalizeLngLat(places[index].lnglat)
      const end = normalizeLngLat(places[index + 1].lnglat)
      segmentPaths[index] = await planWalkingSegmentWithFallback(AMapNS, start, end)
    }
  }

  const concurrency = Math.min(4, segmentCount)
  await Promise.all(Array.from({ length: concurrency }, () => planNextSegment()))

  const valid = segmentPaths.every(seg => Array.isArray(seg) && seg.length >= 2)
  return valid ? segmentPaths : buildRouteSegmentsFromPlaces(places)
}

/**
 * 加载 AMap.Walking 插件
 */
function loadWalkingPlugin(AMapNS) {
  return new Promise((resolve, reject) => {
    if (AMapNS.Walking) {
      resolve()
      return
    }
    AMapNS.plugin('AMap.Walking', () => {
      if (AMapNS.Walking) {
        resolve()
      } else {
        reject(new Error('AMap.Walking plugin failed to load'))
      }
    })
  })
}

/**
 * 规划相邻两点之间的步行路径
 */
function planWalkingSegment(AMapNS, start, end) {
  return new Promise((resolve) => {
    try {
      const walking = new AMapNS.Walking({
        map: null,
        hideMarkers: true,
      })

      walking.search(start, end, (status, result) => {
        if (status === 'complete' && result?.routes?.length > 0) {
          const route = result.routes[0]
          const path = []

          if (Array.isArray(route.steps)) {
            route.steps.forEach(step => {
              if (Array.isArray(step.path)) {
                step.path.forEach(pt => {
                  path.push(normalizeLngLat(pt))
                })
              }
            })
          }

          if (path.length >= 2) {
            resolve(path)
            return
          }
        }

        resolve(null)
      })
    } catch (err) {
      console.warn('[Walking] segment planning error:', err)
      resolve(null)
    }
  })
}

/**
 * 规划相邻两点之间的步行路径（含中点重试与直线兜底）
 * 优先级：A→B 真实路线 → A→M→B 真实路线 → A→B 直线
 */
async function planWalkingSegmentWithFallback(AMapNS, start, end) {
  // 1. 直接规划 A → B
  const directPath = await planWalkingSegment(AMapNS, start, end)
  if (directPath && directPath.length >= 2) {
    return directPath
  }

  // 2. 计算中点 M，分别规划 A → M、M → B
  const mid = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2]
  const [pathAM, pathMB] = await Promise.all([
    planWalkingSegment(AMapNS, start, mid),
    planWalkingSegment(AMapNS, mid, end),
  ])

  if (pathAM && pathAM.length >= 2 && pathMB && pathMB.length >= 2) {
    // 拼接两段，去除重复的中点
    return [...pathAM, ...pathMB.slice(1)]
  }

  // 3. 中点规划仍失败，使用直线连接
  return [start, end]
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
