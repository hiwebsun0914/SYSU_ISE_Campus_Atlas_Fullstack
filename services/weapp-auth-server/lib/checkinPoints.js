'use strict';

const { getLocation } = require('./locationSettings');

/**
 * 旧版照片提交会在进入待审核队列时立即加分。新规则要求审核前始终为 0，
 * 因此首次读取旧数据时撤回这部分积分，并用 pointsDeferred 防止重复迁移。
 */
function deferLegacyPendingPoints(users) {
  let changed = false;
  for (const user of Array.isArray(users) ? users : []) {
    const pending = Array.isArray(user.pendingCheckins) ? user.pendingCheckins : [];
    const unlocked = new Set((user.unlockedLocations || []).map(Number));
    user.points = Number.isFinite(Number(user.points)) ? Number(user.points) : 0;

    for (const item of pending) {
      const locationId = Number(item.locationId);
      if (!Number.isInteger(locationId) || unlocked.has(locationId) || item.pointsDeferred === true) continue;

      // 旧提交逻辑固定为隐藏地点 +2、普通地点 +1，并不读取后台的自定义积分。
      const legacyAward = getLocation(locationId)?.isHidden ? 2 : 1;
      const reverted = Math.min(legacyAward, Math.max(0, user.points));
      user.points -= reverted;
      item.pointsDeferred = true;
      item.legacyPointsReverted = reverted;
      changed = true;
    }
  }
  return changed;
}

module.exports = { deferLegacyPendingPoints };
