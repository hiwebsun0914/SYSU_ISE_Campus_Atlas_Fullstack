#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const store = require('../lib/seasonStore');
const { digest } = require('../lib/seasonLifecycle');
function prepare() {
  const users = store.read(store.legacy('users.json', 'USERS_FILE'));
  const submissions = store.read(store.legacy('submissions.json', 'SUBMISSIONS_FILE'));
  if (!Array.isArray(users) || !Array.isArray(submissions)) store.fail('旧数据必须为数组');
  const ids = new Set(users.map(u => String(u.id)));
  if (ids.size !== users.length || users.some(u => u.id == null)) store.fail('存在重复或缺失的用户 ID，必须先人工处理');
  const submissionIds = new Set();
  for (const item of submissions) {
    if (!ids.has(String(item.userId)) || item.id == null || submissionIds.has(String(item.id))) store.fail('投稿存在无效关联或重复 ID');
    submissionIds.add(String(item.id));
    for (const vote of item.votes || []) if (!ids.has(String(vote.userId))) store.fail('投票存在无效用户关联');
  }
  const seasonId = '2026-welcome';
  const progress = {};
  for (const user of users) {
    if (!Number.isFinite(Number(user.points || 0))) store.fail('存在无效积分');
    progress[String(user.id)] = store.activity(user, seasonId);
  }
  const awards = { ...require('../data/awards'), revealAt: '2026-09-19T18:00:00+08:00' };
  const eligibility = Object.fromEntries(users.map(user => [String(user.id), {
    seasonId,
    userId: user.id,
    source: 'legacy-2026-migration',
    capabilities: { checkin: true, submit: true, vote: true }
  }]));
  const s = { seasonId, name: '2026 迎新活动', status: 'settling', legacyMedia: true,
    config: { awards, routes: require('../data/routes'), locations: require('../data/locations').locations,
      locationSettings: store.read(store.legacy('location-settings.json', 'LOCATION_SETTINGS_FILE'), {}),
      retention: { temporaryUploadsDays: null, failedUploadsDays: null, logsDays: null, feedbackAttachmentsDays: null } },
    progress, submissions: submissions.map(item => ({ ...item, seasonId, votes: (item.votes || []).map(v => ({ ...v, seasonId })) })), archive: null, eligibility };
  const accounts = users.map(user => ({ ...store.stripAccount(user), participantSeasonId: seasonId }));
  const report = { accounts: accounts.length, checkins: users.reduce((n,u) => n+(u.checkinRecords || []).length,0), pending: store.pending(s), submissions: submissions.length, votes: submissions.reduce((n,s)=>n+(s.votes || []).length,0), points: users.reduce((n,u)=>n+Number(u.points || 0),0), sourceDigest: digest({ users, submissions, config:s.config }) };
  return { accounts, s, report };
}
function migrate(apply = false) {
  const prepared = prepare();
  if (store.enabled()) {
    const previous = store.registry().migration;
    if (previous?.sourceDigest !== prepared.report.sourceDigest) store.fail('原始数据与迁移记录不一致，禁止覆盖');
    return { ...previous, alreadyMigrated: true };
  }
  if (apply) {
    const release = store.lock();
    try {
      store.recover();
      store.transaction('2026-welcome', () => {
        store.write(path.join(store.root(), 'accounts.json'), prepared.accounts);
        store.saveState(prepared.s);
        store.write(path.join(store.root(), 'registry.json'), { schemaVersion: 1, currentSeasonId: '2026-welcome', seasons: ['2026-welcome'], migration: prepared.report, audit: [{ action: 'migrate', actor: 'offline-operator', at: new Date().toISOString(), sourceDigest: prepared.report.sourceDigest }] });
      });
    } finally { release(); }
  }
  return { ...prepared.report, applied: apply };
}
if (require.main === module) {
  try { console.log(JSON.stringify(migrate(process.argv.includes('--apply')), null, 2)); }
  catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = { prepare, migrate };
