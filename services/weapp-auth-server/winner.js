// winner.js — 按票数自动评选获奖作品（活动截止后执行；管理员可强制预览）
const awards = require('./data/awards');

function isActivityEnded(now = Date.now()) {
  if (!awards.deadline) return false;
  return now > new Date(awards.deadline).getTime();
}

function winnerLabelOf(rank) {
  const n = Number(rank);
  if (!Number.isInteger(n) || n < 1 || n > 20) return '';
  const cn = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];
  return `第${cn[n - 1]}名`;
}

// 按票数（votes 数量）从高到低排名，取每个奖项前 winnerCounts[category] 名获奖
// force=true 时无视截止时间（管理员“刷新获奖名单”预览用）
function computeWinners(list, force = false) {
  if (!force && !isActivityEnded()) {
    return { list, changed: false, summary: null };
  }

  const counts = awards.winnerCounts || {};
  let changed = false;
  const summary = {};

  for (const cat of awards.categories || []) {
    const n = Number(counts[cat.id]) || 0;
    const candidates = (list || [])
      .filter(s => s.category === cat.id && s.status === 'approved')
      .map(s => ({ s, votes: (Array.isArray(s.votes) ? s.votes : []).length }))
      .sort((a, b) => (b.votes - a.votes) || ((a.s.createdAt || 0) - (b.s.createdAt || 0)));

    const winnerIds = new Set(candidates.slice(0, n).map(x => x.s.id));
    summary[cat.id] = candidates.slice(0, n).map((x, i) => ({
      id: x.s.id,
      rank: i + 1,
      votes: x.votes,
      title: x.s.title || ''
    }));

    for (let i = 0; i < candidates.length; i++) {
      const x = candidates[i];
      const rank = winnerIds.has(x.s.id) ? i + 1 : 0;
      const label = winnerLabelOf(rank);
      if (Number(x.s.winnerRank) !== rank || x.s.winnerLabel !== label) {
        x.s.winnerRank = rank;
        x.s.winnerLabel = label;
        changed = true;
      }
    }
  }

  return { list, changed, summary };
}

module.exports = { isActivityEnded, winnerLabelOf, computeWinners };
