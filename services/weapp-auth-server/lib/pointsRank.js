'use strict';

const { effectiveRole } = require('./roles');

const RANK_LIMIT = 20;

/**
 * 用户“达到当前积分”的时间。
 * 优先取最近一次积分变动时间 pointsUpdatedAt（审核通过加分时写入）；
 * 历史数据没有该字段时回退到注册时间 createdAt；两者都缺失时排到最后。
 */
function pointsReachedAt(user) {
  const updated = Number(user?.pointsUpdatedAt);
  if (Number.isFinite(updated) && updated > 0) return updated;
  const created = Number(user?.createdAt);
  if (Number.isFinite(created) && created > 0) return created;
  return Number.MAX_SAFE_INTEGER;
}

/**
 * 积分排行榜：不出现并列，名次从 1 连续编号。
 * 排序规则：积分降序 → 同分时先达到该积分者靠前 → 昵称兜底保证确定性。
 * 超管（owner）不参与排名；只返回前 limit 名。
 */
function buildPointsRank(users, { limit = RANK_LIMIT, resolveAvatar } = {}) {
  const sorted = (Array.isArray(users) ? users : [])
    .filter(u => effectiveRole(u) !== 'owner')
    .map(u => ({
      userId: u.id,
      username: u.username || '匿名用户',
      avatar: resolveAvatar ? resolveAvatar(u) : (u.avatar || ''),
      points: Number.isFinite(Number(u.points)) ? Number(u.points) : 0,
      reachedAt: pointsReachedAt(u)
    }))
    .sort((a, b) =>
      (b.points - a.points) ||
      (a.reachedAt - b.reachedAt) ||
      String(a.username).localeCompare(String(b.username), 'zh')
    );

  return sorted.slice(0, Math.max(0, limit)).map((it, idx) => ({
    rank: idx + 1,
    userId: it.userId,
    username: it.username,
    avatar: it.avatar,
    points: it.points
  }));
}

module.exports = { RANK_LIMIT, pointsReachedAt, buildPointsRank };
