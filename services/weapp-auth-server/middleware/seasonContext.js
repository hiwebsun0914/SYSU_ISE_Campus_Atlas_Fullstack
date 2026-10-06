'use strict';
const store = require('../lib/seasonStore');
let tail = Promise.resolve();
function activityPath(url) {
  return /^\/(checkin|submissions)(\/|$)/.test(url) || url === '/user/unlock' || /^\/admin\/(checkins|submissions|locations)(\/|$)/.test(url);
}
module.exports = function seasonContext(req, res, next) {
  if (req.path === '/health' || req.method === 'OPTIONS') return next();
  const start = tail;
  let release;
  tail = new Promise(resolve => { release = resolve; });
  start.then(() => {
    const ctx = { writes: new Map(), cancelled: false };
    let done = false;
    const finish = () => { if (!done) { done = true; ctx.cancelled = true; release(); } };
    res.once('close', finish);
    res.once('finish', finish);
    store.context.run(ctx, () => {
      try {
        store.recover();
        if (!store.enabled()) store.fail('请先完成活动期迁移', 'SEASON_MIGRATION_REQUIRED', 503);
        const r = store.registry();
        const supplied = [req.get('X-Season-Id'), req.query.seasonId, (req.path === '/seasons' && req.method === 'POST' ? undefined : req.body?.seasonId)].filter(x => x !== undefined && x !== '');
        if (supplied.some(x => typeof x !== 'string') || new Set(supplied).size > 1) store.fail('活动期参数冲突');
        ctx.seasonId = store.validId(supplied[0] || r.currentSeasonId);
        if (!r.seasons.includes(ctx.seasonId)) store.fail('活动期不存在', 'SEASON_NOT_FOUND', 404);
        const s = store.state();
        req.seasonId = s.seasonId;
        const mutation = !['GET', 'HEAD'].includes(req.method);
        if (mutation && activityPath(req.path)) {
          if (!supplied.length) store.fail('请更新客户端后重试', 'SEASON_REQUIRED', 428);
          if (s.status === 'archived') store.fail('往届归档只读', 'SEASON_READ_ONLY', 403);
          if (s.seasonId !== r.currentSeasonId || s.status === 'draft') store.fail('当前活动未开放', 'ACTIVITY_CLOSED', 403);
          const review = /^\/admin\/(checkins|submissions)(\/|$)/.test(req.path);
          if (s.status === 'settling' && !review) store.fail('活动已截止，仅可处理已有审核', 'ACTIVITY_CLOSED', 403);
        }
        const json = res.json.bind(res);
        res.json = body => {
          if (body && typeof body === 'object' && !Array.isArray(body)) body.seasonId = ctx.seasonId;
          res.set('Cache-Control', 'private, no-store');
          return json(body);
        };
        const end = res.end.bind(res);
        res.end = function (...args) {
          try {
            if (res.statusCode < 400) {
              if (mutation && /^\/admin\/users/.test(req.path)) store.audit('account-admin-change', req.userId, { method: req.method, path: req.path });
              store.commit(ctx);
            }
          }
          catch (error) {
            res.statusCode = 503;
            res.removeHeader('Content-Length');
            res.setHeader('Content-Type', 'application/json');
            args = [JSON.stringify({ code: 1, errorCode: 'STORE_UNAVAILABLE', message: '保存失败，请勿重复提交；联系管理员恢复事务' })];
          }
          return end(...args);
        };
        next();
      } catch (error) {
        res.status(error.status || 503).json({ code: 1, errorCode: error.errorCode || 'STORE_UNAVAILABLE', message: error.message });
      }
    });
  }).catch(next);
};
module.exports.activityPath = activityPath;
