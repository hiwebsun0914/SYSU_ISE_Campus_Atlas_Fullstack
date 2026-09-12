function validTimestamp(value) {
  const timestamp = Number(value)
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null
}

export function buildRouteAwardRows(users, approvedCheckins, routes) {
  const checkinsByUser = new Map()

  approvedCheckins.forEach(checkin => {
    const userId = String(checkin.userId)
    const locationId = Number(checkin.locationId)
    if (!Number.isFinite(locationId)) return

    if (!checkinsByUser.has(userId)) checkinsByUser.set(userId, new Map())
    const locations = checkinsByUser.get(userId)
    const timestamp = validTimestamp(checkin.uploadTime)
    const existing = locations.get(locationId)
    if (!existing || (timestamp && (!existing.timestamp || timestamp < existing.timestamp))) {
      locations.set(locationId, { timestamp })
    }
  })

  return users.map(user => {
    const locations = checkinsByUser.get(String(user.id)) || new Map()
    const completedRoutes = routes.flatMap(route => {
      if (!route.points.length || !route.points.every(id => locations.has(Number(id)))) return []
      const pointTimes = route.points.map(id => locations.get(Number(id))?.timestamp)
      const completedAt = pointTimes.every(Boolean) ? Math.max(...pointTimes) : null
      return [{ id: route.id, completedAt }]
    })
    const completedRouteTimes = completedRoutes.map(route => route.completedAt)
    const rankingCompletedAt = completedRouteTimes.length && completedRouteTimes.every(Boolean)
      ? Math.max(...completedRouteTimes)
      : null

    return {
      ...user,
      completedRouteIds: completedRoutes.map(route => route.id),
      completedRouteCount: completedRoutes.length,
      rankingCompletedAt
    }
  }).sort(compareRouteAwardRows).map((user, index) => ({ ...user, rank: index + 1 }))
}

export function compareRouteAwardRows(a, b) {
  const countDifference = Number(b.completedRouteCount || 0) - Number(a.completedRouteCount || 0)
  if (countDifference) return countDifference

  const aTime = validTimestamp(a.rankingCompletedAt) ?? Number.POSITIVE_INFINITY
  const bTime = validTimestamp(b.rankingCompletedAt) ?? Number.POSITIVE_INFINITY
  if (aTime !== bTime) return aTime - bTime

  const nameDifference = String(a.username || '').localeCompare(String(b.username || ''), 'zh-CN')
  return nameDifference || String(a.id).localeCompare(String(b.id), 'zh-CN', { numeric: true })
}

