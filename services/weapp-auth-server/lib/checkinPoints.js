'use strict';

const { getLocation } = require('./locationSettings');

/**
 * 旧版照片提交会在进入待审核队列时立即加分。新规则要求审核前始终为 0，
 * 因此首次读取旧数据时撤回这部分积分，并用 pointsDeferred 防止重复迁移。
 *
 * 旧版驳回会先删除 pendingCheckins，却不会撤回上传时增加的积分，所以还要
 * 逐条迁移历史 rejected 审核记录；同一地点多次上传再驳回应撤回多次。
 */
function deferLegacyPendingPoints(users) {
  let changed = false;
  for (const user of Array.isArray(users) ? users : []) {
    const pending = Array.isArray(user.pendingCheckins) ? user.pendingCheckins : [];
    const reviews = Array.isArray(user.checkinReviewRecords) ? user.checkinReviewRecords : [];
    const unlocked = new Set((user.unlockedLocations || []).map(Number));
    user.points = Number.isFinite(Number(user.points)) ? Number(user.points) : 0;

    const revertLegacyAward = (item) => {
      const locationId = Number(item.locationId);
      if (!Number.isInteger(locationId) || unlocked.has(locationId) || item.pointsDeferred === true) return;

      // 旧提交逻辑固定为隐藏地点 +2、普通地点 +1，并不读取后台的自定义积分。
      const legacyAward = getLocation(locationId)?.isHidden ? 2 : 1;
      const reverted = Math.min(legacyAward, Math.max(0, user.points));
      user.points -= reverted;
      item.pointsDeferred = true;
      item.legacyPointsReverted = reverted;
      changed = true;
    };

    for (const item of pending) revertLegacyAward(item);

    for (const item of reviews) {
      if (item?.status !== 'rejected') continue;

      // 新逻辑生成的驳回记录会显式带 pointsReverted；它从未预加分，不能再扣。
      if (Object.prototype.hasOwnProperty.call(item, 'pointsReverted')) {
        if (item.pointsDeferred !== true) {
          item.pointsDeferred = true;
          changed = true;
        }
        continue;
      }

      revertLegacyAward(item);
    }
  }
  return changed;
}

module.exports = { deferLegacyPendingPoints };
