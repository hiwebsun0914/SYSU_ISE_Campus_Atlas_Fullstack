'use strict';
const store = require('./seasonStore');
const { effectiveRole } = require('./roles');
const { buildSnapshot } = require('./seasonRankSnapshot');
const { computeWinners } = require('../winner');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function dataDigest() {
  const r = store.registry();
  const external = ['future_cards.json', 'feedback.json'].map((name, i) => {
    const file = store.legacy(name, ['FUTURE_CARDS_FILE', 'FEEDBACK_FILE'][i]);
    return [name, fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null];
  });
  return digest({ currentSeasonId: r.currentSeasonId, accounts: store.readAccounts().map(({ lastToken, lastLogin, updatedAt, ...u }) => u), seasons: r.seasons.map(id => store.state(id)), external });
}
function requireRestoreProof() {
  const proof = store.read(path.join(store.root(), 'restore-proof.json'), null);
  if (!proof || proof.dataDigest !== dataDigest() || !proof.objectsVerified || !proof.backupHash) store.fail('请先备份当前数据并完成隔离恢复演练', 'RESTORE_DRILL_REQUIRED');
  return proof;
}
function summary(s) {
  return { seasonId: s.seasonId, name: s.name, status: s.status, deadline: s.config.awards.deadline, revealAt: s.config.awards.revealAt, readOnly: s.status !== 'open' || Date.now() >= Date.parse(s.config.awards.deadline) };
}
function preview() {
  const s = store.state();
  const users = store.readUsers();
  const computed = s.archive ? { summary: s.archive.awards } : computeWinners(store.clone(s.submissions), true);
  return {
    season: summary(s), pending: store.pending(s),
    ...(s.archive ? { pointsRank: s.archive.pointsRank, checkinRank: s.archive.checkinRank, routes: s.archive.routes } : buildSnapshot(users, s.config.routes)),
    awards: computed.summary,
    adminReview: store.readAccounts().filter(u => ['admin', 'owner'].includes(effectiveRole(u))).map(u => ({ id: u.id, username: u.username, role: effectiveRole(u) })),
    archivedAt: s.archive?.archivedAt || null
  };
}
function create(input, actor) {
  const id = store.validId(input.seasonId);
  const r = store.registry();
  if (r.seasons.includes(id)) store.fail('活动期已存在');
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 80) store.fail('请填写活动名称');
  const deadline = Date.parse(input.deadline), reveal = Date.parse(input.revealAt);
  if (!Number.isFinite(deadline) || !Number.isFinite(reveal) || deadline <= Date.now() || reveal < deadline) store.fail('截止时间须在未来，公布时间不能早于截止时间');
  const config = store.clone(store.state(r.currentSeasonId).config);
  config.awards.deadline = new Date(deadline).toISOString();
  config.awards.revealAt = new Date(reveal).toISOString();
  config.awards.awardCeremony = String(input.awardCeremony || '').slice(0, 200);
  store.saveState({ seasonId: id, name: input.name.trim(), status: 'draft', legacyMedia: false, config, progress: {}, submissions: [], archive: null, eligibility: {} });
  r.seasons.push(id);
  store.write(path.join(store.root(), 'registry.json'), r);
  store.audit('create', actor, { seasonId: id });
  return summary(store.state(id));
}
function transition(action, actor, input = {}) {
  const r = store.registry();
  const s = store.state();
  if (action === 'settle') {
    if (s.status !== 'open' || s.seasonId !== r.currentSeasonId) store.fail('只有当前开放活动可以结算');
    s.status = 'settling';
  } else if (action === 'archive') {
    if (s.status !== 'settling') store.fail('请先进入结算期');
    const todo = store.pending(s);
    if (todo.checkins || todo.submissions) store.fail('仍有待审核或待处理申诉', 'PENDING_REVIEWS');
    const proof = requireRestoreProof();
    const result = preview();
    s.submissions = computeWinners(store.clone(s.submissions), true).list;
    s.archive = { ...result, config: store.clone(s.config), archivedAt: new Date().toISOString(), archivedBy: String(actor), backupHash: proof.backupHash, identities: store.readAccounts().map(u => ({ id:u.id, username:u.username, realName:u.realName, role:effectiveRole(u) })) };
    s.status = 'archived';
  } else if (action === 'activate') {
    if (s.status !== 'draft' || store.state(r.currentSeasonId).status !== 'archived') store.fail('上一届必须归档，新一届必须是草稿');
    if (Date.parse(s.config.awards.deadline) <= Date.now()) store.fail('新活动截止时间已过');
    if (!Object.values(s.eligibility || {}).some(item => Object.values(item?.capabilities || {}).some(Boolean))) {
      store.fail('请先通过当届花名册或审批流程写入参与资格', 'ELIGIBILITY_REQUIRED');
    }
    requireRestoreProof();
    const admins = store.readAccounts().filter(u => ['admin', 'owner'].includes(effectiveRole(u))).map(u => String(u.id)).sort();
    const checked = [...new Set((input.reviewedAdminIds || []).map(String))].sort();
    if (JSON.stringify(admins) !== JSON.stringify(checked)) store.fail('请逐一复核当前管理员名单', 'ADMIN_REVIEW_REQUIRED');
    r.currentSeasonId = s.seasonId;
    store.write(path.join(store.root(), 'registry.json'), r);
    s.status = 'open';
  } else store.fail('不支持的状态变更');
  store.saveState(s);
  store.audit(action, actor, { seasonId: s.seasonId, reviewedAdminIds: input.reviewedAdminIds || [] });
  return summary(s);
}
// #59 owns the eligibility writer and enforcement. Absence never implies eligibility.
function eligibility(userId, seasonId) { return store.state(seasonId).eligibility?.[String(userId)] || null; }
module.exports = { digest, dataDigest, requireRestoreProof, summary, preview, create, transition, eligibility };
