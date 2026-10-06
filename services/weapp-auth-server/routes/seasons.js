'use strict';
const router = require('express').Router();
const auth = require('../middleware/auth');
const { optionalAuth } = require('../middleware/auth');
const store = require('../lib/seasonStore');
const { getLocations } = require('../lib/locationSettings');
const lifecycle = require('../lib/seasonLifecycle');
const { effectiveRole, isAdminRole } = require('../lib/roles');
const { isHiddenFrom } = require('../lib/resultEmbargo');
const multer = require('multer');
const rosterImport = require('../lib/rosterImport');
const rosterUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
function receiveRoster(req, res, next) {
  rosterUpload.single('file')(req, res, error => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ code: 1, errorCode: 'ROSTER_TOO_LARGE', message: '花名册文件不能超过 5MB' });
    return res.status(400).json({ code: 1, errorCode: 'ROSTER_UPLOAD_INVALID', message: '花名册上传格式无效' });
  });
}
function run(fn) { return (req, res, next) => { try { fn(req, res); } catch (e) { if (e.errorCode) return res.status(e.status || 409).json({ code: 1, errorCode: e.errorCode, message: e.message }); next(e); } }; }
function admin(req, res, next) { return isAdminRole(effectiveRole(req.user)) ? next() : res.status(403).json({ code: 1, message: '需要管理员权限' }); }
function owner(req, res, next) { return effectiveRole(req.user) === 'owner' ? next() : res.status(403).json({ code: 1, message: '仅超管可以管理活动期' }); }
router.get('/', optionalAuth, run((req, res) => {
  const r = store.registry();
  const adminUser = isAdminRole(effectiveRole(req.user));
  const participantSeasonId = req.user ? store.participantSeasonId(req.user) : null;
  const visibleSeasonId = participantSeasonId || r.currentSeasonId;
  const ids = adminUser ? r.seasons : r.seasons.filter(id => id === visibleSeasonId);
  res.json({ code: 0, currentSeasonId: adminUser ? r.currentSeasonId : visibleSeasonId, participantSeasonId, list: ids.map(id => lifecycle.summary(store.state(id))).filter(s => adminUser || s.status !== 'draft') });
}));
router.get('/current', run((_req, res) => res.json({ code: 0, data: lifecycle.summary(store.state(store.registry().currentSeasonId)) })));
router.get('/config', optionalAuth, run((_req, res) => { const s = store.state(); res.json({ code: 0, data: { serverNow: Date.now(), ...lifecycle.summary(s), routes: s.config.routes, awards: s.config.awards, locations: getLocations({ includeRetired: true }) } }); }));
router.get('/mine', auth, run((req, res) => {
  const s = store.state();
  const progress = s.progress[String(req.userId)] || store.emptyProgress(req.userId, s.seasonId);
  const eligibility = s.eligibility?.[String(req.userId)] || null;
  res.json({ code: 0, data: { ...lifecycle.summary(s), eligibility, progress, awards: isHiddenFrom(req) ? [] : s.submissions.filter(x => String(x.userId) === String(req.userId) && x.status === 'approved' && x.winnerRank > 0).map(x => ({ id: x.id, title: x.title, category: x.category, winnerRank: x.winnerRank, winnerLabel: x.winnerLabel })) } });
}));
router.get('/admin', auth, admin, run((_req, res) => res.json({ code: 0, currentSeasonId: store.registry().currentSeasonId, list: store.registry().seasons.map(id => lifecycle.summary(store.state(id))), audit: store.registry().audit })));
router.get('/preview', auth, admin, run((_req, res) => res.json({ code: 0, data: (() => { const result = lifecycle.preview(); if (isHiddenFrom(_req)) { result.pointsRank = []; result.awards = {}; result.routes = []; result.checkinRank = []; } return result; })() })));
router.get('/archive', auth, admin, run((_req, res) => {
  const s = store.state();
  if (isHiddenFrom(_req)) store.fail('结果尚未公布', 'RESULTS_EMBARGOED', 403);
  if (!s.archive) store.fail('尚未生成归档');
  res.json({ code: 0, data: { ...s, accounts: s.archive.identities } });
}));
router.get('/admin-config', auth, owner, run((_req, res) => res.json({ code: 0, data: store.state().config })));
router.get('/roster', auth, owner, run((_req, res) => res.json({ code: 0, data: rosterImport.summary(store.readRoster()) })));
router.post('/roster/import', auth, owner, receiveRoster, async (req, res, next) => {
  try {
    if (!req.get('X-Season-Id')) store.fail('请选择活动期', 'SEASON_REQUIRED', 428);
    const s = store.state(req.seasonId);
    if (s.status !== 'draft') store.fail('仅草稿活动期可以导入或替换花名册', 'ROSTER_SEASON_LOCKED', 409);
    if (!req.file?.buffer) store.fail('请选择花名册文件', 'ROSTER_FILE_REQUIRED', 400);
    const roster = await rosterImport.parse(req.file.buffer, req.file.originalname, s.seasonId);
    roster.importedBy = String(req.userId);
    store.saveRoster(roster);
    store.audit('roster-import', req.userId, { seasonId: s.seasonId, count: roster.count, sha256: roster.sha256 });
    res.json({ code: 0, data: rosterImport.summary(roster) });
  } catch (error) {
    if (error.errorCode) return res.status(error.status || 409).json({ code: 1, errorCode: error.errorCode, message: error.message });
    next(error);
  }
});
router.put('/admin-config', auth, owner, run((req, res) => {
  if (!req.get('X-Season-Id')) store.fail('请选择活动期', 'SEASON_REQUIRED', 428);
  const s = store.state();
  if (s.status !== 'draft') store.fail('仅草稿可以编辑完整配置');
  const c = req.body;
  const deadline = Date.parse(c?.awards?.deadline), reveal = Date.parse(c?.awards?.revealAt);
  if (!Number.isFinite(deadline) || !Number.isFinite(reveal) || deadline <= Date.now() || reveal < deadline) store.fail('活动时间无效');
  if (!Array.isArray(c.routes) || !Array.isArray(c.locations) || !Array.isArray(c.awards.categories) || !c.locationSettings || !c.retention) store.fail('配置缺少地点、路线、奖项或保留策略');
  const ids = new Set(c.locations.map(x => x.backendId));
  if (ids.size !== c.locations.length || c.locations.some(x => !Number.isInteger(x.backendId) || x.backendId <= 0)) store.fail('地点 ID 重复或无效');
  if (new Set(c.routes.map(x=>x.id)).size !== c.routes.length || c.routes.some(x=>!x.id || !Array.isArray(x.points) || x.points.some(id=>!ids.has(id)) || !Number.isFinite(Number(x.bonus ?? 5)) || Number(x.bonus ?? 5)<0)) store.fail('路线配置或地点关联无效');
  for (const key of ['perUserPerCategory','maxImagesPerWork','maxImageMB','maxVotesPerDay']) if (!Number.isInteger(c.awards[key]) || c.awards[key] < 1 || c.awards[key] > 100) store.fail('投稿与投票限额无效');
  if (!Array.isArray(c.awards.allowedImageTypes) || c.awards.allowedImageTypes.some(x=>!['image/jpeg','image/png','image/webp','image/gif'].includes(x))) store.fail('图片格式无效');
  if (!c.awards.winnerCounts || c.awards.categories.some(x=>!x.id || !Number.isInteger(c.awards.winnerCounts[x.id]) || c.awards.winnerCounts[x.id]<0 || c.awards.winnerCounts[x.id]>20)) store.fail('奖项名额无效');
  for (const value of Object.values(c.retention)) if (value !== null && (!Number.isInteger(value) || value < 1)) store.fail('保留期限应为空或正整数天数');
  for (const [id, settings] of Object.entries(c.locationSettings)) {
    if (!ids.has(Number(id))) store.fail('地点配置关联无效');
    require('../lib/locationSettings').validatePatch(settings);
  }
  s.config = { awards:c.awards, locations:c.locations, routes:c.routes, locationSettings:c.locationSettings, retention:c.retention };
  store.saveState(s); store.audit('configure', req.userId, { seasonId:s.seasonId });
  res.json({ code: 0 });
}));
router.post('/', auth, owner, run((req, res) => res.json({ code: 0, data: lifecycle.create(req.body || {}, req.userId) })));
router.post('/:action(settle|archive|activate)', auth, owner, run((req, res) => {
  if (!req.get('X-Season-Id')) store.fail('请明确选择活动期', 'SEASON_REQUIRED', 428);
  res.json({ code: 0, data: lifecycle.transition(req.params.action, req.userId, req.body || {}) });
}));
module.exports = router;
