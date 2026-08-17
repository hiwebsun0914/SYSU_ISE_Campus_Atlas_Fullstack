/**
 * 基于高德地图的定位打卡工具
 * 提供用户定位、距离计算与打卡判断
 */

/** 默认打卡判定半径（米）；地点可通过 checkinRadius 字段单独覆盖 */
export const CHECKIN_RADIUS = 50

/** 单次定位超时（毫秒） */
const GEO_TIMEOUT = 8000
/** 最多连续采样次数：部分手机首次返回基站级粗定位，多次采样可取最优 */
const GEO_MAX_SAMPLES = 3
/** 精度达到该值（米）即提前结束采样 */
const GEO_GOOD_ACCURACY = 25

/**
 * 单次定位（Promise 包装 AMap.Geolocation.getCurrentPosition）
 * maximumAge 置 0，禁用缓存位置，避免拿到走到别处前的旧坐标
 */
function locateOnce(geo) {
  return new Promise((resolve, reject) => {
    geo.getCurrentPosition((status, result) => {
      if (status === 'complete' && result?.position) {
        resolve({
          lng: result.position.lng,
          lat: result.position.lat,
          // 浏览器定位提供的精度半径（米）；缺失时视为未知（null）
          accuracy: Number.isFinite(result?.accuracy) ? Math.round(result.accuracy) : null,
        })
        return
      }
      reject(new Error(result?.message || '定位失败，请检查位置权限'))
    })
  })
}

/**
 * 获取用户当前位置（多次采样取精度最优的一次）
 * @param {object} AMapNS
 * @param {object} mapInstance
 * @returns {Promise<{lng: number, lat: number, accuracy: number|null}>}
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
        timeout: GEO_TIMEOUT,
        maximumAge: 0,
      })

      let best = null
      let lastError = null
      let attempt = 0

      const finish = (err) => {
        try { mapInstance.removeControl(geo) } catch (_) { /* noop */ }
        if (best) {
          resolve(best)
        } else {
          reject(err || lastError || new Error('定位失败，请检查位置权限'))
        }
      }

      const step = async () => {
        attempt += 1
        try {
          const pos = await locateOnce(geo)
          // 精度未知时保守视为较差，继续采样；取精度半径最小的一次
          if (!best || (pos.accuracy ?? Infinity) < (best.accuracy ?? Infinity)) {
            best = pos
          }
          if (best.accuracy != null && best.accuracy <= GEO_GOOD_ACCURACY) {
            finish()
            return
          }
        } catch (err) {
          lastError = err
        }

        if (attempt < GEO_MAX_SAMPLES) {
          step()
        } else {
          finish(lastError)
        }
      }

      step()
    })
  })
}

/**
 * 打卡距离判定（含定位精度补偿）
 * 用户定位存在 ±accuracy 的误差圈，误差圈与打卡半径相交即视为达标，
 * 避免定位轻微漂移把站在点位的用户挡在门外。
 * @param {number} dist - 用户位置到打卡点的距离（米）
 * @param {number|null} accuracy - 定位精度半径（米），未知传 null
 * @param {number} [radius] - 打卡点半径（米），默认 CHECKIN_RADIUS
 * @returns {boolean}
 */
export function withinCheckinRange(dist, accuracy, radius = CHECKIN_RADIUS) {
  if (!Number.isFinite(dist)) return false
  const tolerance = Number.isFinite(accuracy) ? Math.max(0, accuracy) : 0
  return dist - tolerance <= radius
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
