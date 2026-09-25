'use strict';
// Single-process JSON store. HTTP requests are serialized by seasonContext; a redo
// journal makes multi-file commits recoverable before the next request is served.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { AsyncLocalStorage } = require('async_hooks');
const context = new AsyncLocalStorage();
const base = path.join(__dirname, '..');
const clone = value => JSON.parse(JSON.stringify(value));
const fields = ['points', 'pointsUpdatedAt', 'unlockedLocations', 'lockingLocations', 'completedRoutes', 'checkinRecords', 'pendingCheckins', 'checkinReviewRecords'];
const root = () => path.resolve(process.env.SEASONS_DIR || path.join(base, 'data', 'seasons'));
const legacy = (name, env) => path.resolve(process.env[env] || path.join(base, name));
function fail(message, code = 'SEASON_INVALID', status = 409) {
  throw Object.assign(new Error(message), { errorCode: code, status });
}
function validId(id) {
  if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) fail('无效的活动期标识');
  return id;
}
function atomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  const fd = fs.openSync(tmp, 'wx', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(data, null, 2)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, file);
  const dir = fs.openSync(path.dirname(file), 'r');
  try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); }
}
function read(file, fallback) {
  const ctx = context.getStore();
  if (ctx?.writes.has(file)) return clone(ctx.writes.get(file));
  if (!fs.existsSync(file) && fallback !== undefined) return clone(fallback);
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { fail(`数据文件不可读取：${path.basename(file)}`, 'STORE_UNAVAILABLE', 503); }
}
function write(file, value) {
  const ctx = context.getStore();
  if (ctx) {
    if (ctx.cancelled) fail('请求已取消', 'REQUEST_CANCELLED');
    ctx.writes.set(file, clone(value));
  } else atomic(file, value);
}
function enabled() { return fs.existsSync(path.join(root(), 'registry.json')); }
function registry() {
  const value = read(path.join(root(), 'registry.json'));
  if (value.schemaVersion !== 1 || !Array.isArray(value.seasons)) fail('活动期注册表损坏', 'STORE_UNAVAILABLE', 503);
  return value;
}
function selectedId() { return context.getStore()?.seasonId || registry().currentSeasonId; }
function state(id = selectedId()) {
  const value = read(path.join(root(), validId(id), 'state.json'));
  if (value.seasonId !== id || !value.progress || !Array.isArray(value.submissions) || !value.config) fail('活动期数据损坏', 'STORE_UNAVAILABLE', 503);
  return value;
}
function saveState(value) { write(path.join(root(), validId(value.seasonId), 'state.json'), value); }
function emptyProgress(userId, seasonId) {
  return { userId, seasonId, points: 0, pointsUpdatedAt: 0, unlockedLocations: [], lockingLocations: [], completedRoutes: [], checkinRecords: [], pendingCheckins: [], checkinReviewRecords: [] };
}
function stripAccount(user) {
  const account = { ...user };
  for (const key of [...fields, 'seasonId', 'userId']) delete account[key];
  return account;
}
function activity(user, seasonId) {
  const result = emptyProgress(user.id, seasonId);
  for (const key of fields) if (user[key] !== undefined) result[key] = clone(user[key]);
  for (const key of ['checkinRecords', 'pendingCheckins', 'checkinReviewRecords']) {
    result[key] = result[key].map(record => ({ ...record, seasonId }));
  }
  return result;
}
function readAccounts() {
  const list = read(enabled() ? path.join(root(), 'accounts.json') : legacy('users.json', 'USERS_FILE'));
  if (!Array.isArray(list)) fail('账号文件格式错误', 'STORE_UNAVAILABLE', 503);
  return list;
}
function participantSeasonId(account) {
  if (!enabled() || !account) return null;
  if (account.participantSeasonId) return validId(account.participantSeasonId);
  const matches = registry().seasons.filter(id => {
    const item = state(id).eligibility?.[String(account.id)];
    return item && Object.values(item.capabilities || {}).some(Boolean);
  });
  return matches.length === 1 ? matches[0] : null;
}
function readUsers() {
  const accounts = readAccounts();
  if (!enabled()) return accounts;
  const s = state();
  return accounts.map(account => ({ ...account, ...(s.progress[String(account.id)] || emptyProgress(account.id, s.seasonId)) }));
}
function writeUsers(users) {
  if (!enabled()) return write(legacy('users.json', 'USERS_FILE'), users);
  const previous = readAccounts();
  if (previous.some(u => !users.some(v => String(v.id) === String(u.id)))) fail('分期模式下禁止直接删除账号；请使用经审计的数据治理流程', 'ACCOUNT_DELETE_REQUIRES_REVIEW');
  const s = state();
  let changed = false;
  for (const user of users) {
    const next = activity(user, s.seasonId);
    const old = s.progress[String(user.id)] || emptyProgress(user.id, s.seasonId);
    if (JSON.stringify(next) !== JSON.stringify(old)) {
      if (s.status === 'archived') fail('往届归档只读', 'SEASON_READ_ONLY');
      s.progress[String(user.id)] = next;
      changed = true;
    }
  }
  write(path.join(root(), 'accounts.json'), users.map(stripAccount));
  if (changed) saveState(s);
}
function readSubmissions() {
  const list = enabled() ? state().submissions : read(legacy('submissions.json', 'SUBMISSIONS_FILE'), []);
  if (!Array.isArray(list)) fail('投稿文件格式错误', 'STORE_UNAVAILABLE', 503);
  return list;
}
function writeSubmissions(list) {
  if (!enabled()) return write(legacy('submissions.json', 'SUBMISSIONS_FILE'), list);
  const s = state();
  if (s.status === 'archived') fail('往届归档只读', 'SEASON_READ_ONLY');
  s.submissions = list.map(item => ({ ...item, seasonId: s.seasonId, votes: (item.votes || []).map(v => ({ ...v, seasonId: s.seasonId })) }));
  saveState(s);
}
function config(name, fallback) { return enabled() ? state().config[name] : fallback; }
function configProxy(name, fallback) { return new Proxy(fallback, { get: (_target, key) => config(name, fallback)[key] }); }
function readSettings() { return enabled() ? state().config.locationSettings : read(legacy('location-settings.json', 'LOCATION_SETTINGS_FILE'), {}); }
function writeSettings(settings) {
  if (!enabled()) return write(legacy('location-settings.json', 'LOCATION_SETTINGS_FILE'), settings);
  const s = state();
  if (!['draft', 'open'].includes(s.status)) fail('结算及归档期配置只读', 'SEASON_READ_ONLY');
  s.config.locationSettings = settings;
  saveState(s);
}
function mediaRoot(kind) {
  if (!enabled()) return `${kind}/`;
  const s = state();
  return s.legacyMedia ? `${kind}/` : `seasons/${s.seasonId}/${kind}/`;
}
function pending(s = state()) {
  return {
    checkins: Object.values(s.progress).reduce((n, p) => n + (p.pendingCheckins || []).length, 0),
    submissions: s.submissions.filter(x => x.status === 'pending' || x.appealStatus === 'pending' || x.appeal?.status === 'pending').length
  };
}
function audit(action, actor, detail = {}) {
  const r = registry();
  r.audit.push({ id: crypto.randomUUID(), action, actor: String(actor), at: new Date().toISOString(), ...detail });
  write(path.join(root(), 'registry.json'), r);
}
function recover() {
  const journal = path.join(root(), 'transaction.json');
  if (!fs.existsSync(journal)) return;
  const entries = JSON.parse(fs.readFileSync(journal, 'utf8')).entries;
  for (const [file, data] of entries) {
    if (!path.isAbsolute(file)) fail('事务日志路径无效');
    atomic(file, data);
  }
  fs.unlinkSync(journal);
}
function commit(ctx) {
  if (!ctx.writes.size || ctx.cancelled) return;
  const journal = path.join(root(), 'transaction.json');
  atomic(journal, { entries: [...ctx.writes] });
  for (const [file, data] of ctx.writes) atomic(file, data);
  fs.unlinkSync(journal);
}
function transaction(seasonId, fn) {
  const ctx = { seasonId, writes: new Map() };
  return context.run(ctx, () => { const result = fn(); commit(ctx); return result; });
}
function lock() {
  fs.mkdirSync(root(), { recursive: true });
  const file = path.join(root(), 'writer.lock');
  try { fs.writeFileSync(file, String(process.pid), { flag: 'wx', mode: 0o600 }); }
  catch { fail('数据目录已锁定；停止服务或确认旧进程退出后人工解除 writer.lock', 'STORE_LOCKED', 503); }
  const release = () => { if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === String(process.pid)) fs.unlinkSync(file); };
  process.once('exit', release);
  return release;
}
module.exports = { context, root, legacy, clone, fields, fail, validId, atomic, read, write, enabled, registry, selectedId, state, saveState, emptyProgress, stripAccount, activity, readAccounts, participantSeasonId, readUsers, writeUsers, readSubmissions, writeSubmissions, config, configProxy, readSettings, writeSettings, mediaRoot, pending, audit, recover, commit, transaction, lock };
