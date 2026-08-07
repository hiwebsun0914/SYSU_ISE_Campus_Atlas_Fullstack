/**
 * 基于高德地图的定位打卡工具
 * 提供用户定位、距离计算与打卡判断
 */

/** 打卡判定半径（米），可在此统一调整 */
export const CHECKIN_RADIUS = 50

/**
 * 获取用户当前位置（Promise 包装 AMap.Geolocation）
 * @param {object} AMapNS
 * @param {object} mapInstance
 * @returns {Promise<{lng: number, lat: number}>}
 */
export function getUserPosition(AMapNS, mapInstance) {
  return new Promise((resolve, reject) => {
    if (!AMapNS || !mapInstance) {
      reject(new Error('地图尚未就绪'))
      return
    }

    AMapNS.plugin('AMap.Geolocation', () => {
      const geo = new AMapNS.Geolocation({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      })

      geo.getCurrentPosition((status, result) => {
        try { mapInstance.removeControl(geo) } catch (_) { /* noop */ }

        if (status === 'complete' && result?.position) {
          resolve({
            lng: result.position.lng,
            lat: result.position.lat,
          })
          return
        }

        const errMsg = result?.message || '定位失败，请检查位置权限'
        reject(new Error(errMsg))
      })
    })
  })
}

/**
 * 计算两个坐标点之间的距离（米）
 * 优先使用 AMap.GeometryUtil.distance，降级为 Haversine 公式
 * @param {[number,number]|object} a - [lng, lat] 或 {lng, lat}
 * @param {[number,number]|object} b
 * @param {object} [AMapNS]
 * @returns {number} 距离（米），保留一位小数
 */
export function calcDistance(a, b, AMapNS) {
  // 规范化坐标
  const p1 = normalizeLngLat(a)
  const p2 = normalizeLngLat(b)

  if (!p1 || !p2) return Infinity

  // 优先使用高德内置方法
  if (AMapNS?.GeometryUtil?.distance) {
    try {
      const d = AMapNS.GeometryUtil.distance(p1, p2)
      if (Number.isFinite(d)) return Math.round(d * 10) / 10
    } catch (_) { /* 降级 */ }
  }

  // 降级：Haversine
  return haversine(p1, p2)
}

/**
 * Haversine 公式计算两点距离
 */
function haversine(p1, p2) {
  const R = 6371000
  const dLat = toRad(p2[1] - p1[1])
  const dLon = toRad(p2[0] - p1[0])
  const lat1 = toRad(p1[1])
  const lat2 = toRad(p2[1])

  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c * 10) / 10
}

function toRad(deg) {
  return (deg * Math.PI) / 180
}

/**
 * 将各种格式的坐标统一为 [lng, lat]
 */
function normalizeLngLat(pt) {
  if (!pt) return null
  if (Array.isArray(pt) && pt.length >= 2) return [pt[0], pt[1]]
  if (pt && typeof pt.lng === 'number' && typeof pt.lat === 'number') return [pt.lng, pt.lat]
  if (pt && typeof pt.getLng === 'function') return [pt.getLng(), pt.getLat()]
  return null
}
