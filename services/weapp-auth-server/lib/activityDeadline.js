'use strict';

const { isActivityEnded } = require('../winner');

const ACTIVITY_CLOSED_MESSAGE = '活动已截止，无法新增打卡、投稿、投票或申诉；已提交记录仍会继续审核。';

// Only guard participant writes. Historical reads and administrator reviews remain open.
function rejectIfActivityClosed(res, status = 403, now = Date.now()) {
  if (!isActivityEnded(now)) return false;
  res.status(status).json({ code: 4, errorCode: 'ACTIVITY_CLOSED', message: ACTIVITY_CLOSED_MESSAGE });
  return true;
}

function requireActivityOpen(_req, res, next) {
  if (!rejectIfActivityClosed(res)) next();
}

module.exports = { ACTIVITY_CLOSED_MESSAGE, rejectIfActivityClosed, requireActivityOpen };
