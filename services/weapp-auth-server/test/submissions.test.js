const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const test = require('node:test');
const express = require('express');
const jwt = require('jsonwebtoken');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'submissions-test-'));
const usersFile = path.join(testDir, 'users.json');
const submissionsFile = path.join(testDir, 'submissions.json');
const jwtSecret = 'test-only-secret-with-sufficient-length';
const users = [
  { id: 101, username: 'alice', role: 'visitor', phone: '张三', realName: '张三' },
  { id: 202, username: 'bob', role: 'admin', phone: '李四', realName: '李四' },
  { id: 303, username: 'carol', role: 'visitor', phone: '王五', realName: '王五' },
  { id: 404, username: 'dave', role: 'visitor', phone: '王五', realName: '王五' }
];

fs.writeFileSync(usersFile, JSON.stringify(users), 'utf8');
process.env.USERS_FILE = usersFile;
process.env.SUBMISSIONS_FILE = submissionsFile;
process.env.JWT_SECRET = jwtSecret;

const submissionsRouter = require('../routes/submissions');
const adminRouter = require('../routes/admin');
const authMw = require('../middleware/auth');
const app = express();
app.use(express.json({ limit: '64kb' }));
app.use('/submissions', submissionsRouter);

// 管理员权限（与 app.js 挂载方式一致）
function adminOnly(req, res, next) {
  const list = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
  const me = list.find(u => u.id === req.userId);
  if (!me) return res.status(401).json({ code: 1, message: '未登录' });
  if (me.role !== 'admin') return res.status(403).json({ code: 1, message: '无管理员权限' });
  next();
}
app.use('/admin', authMw, adminOnly, adminRouter);

const server = app.listen(0, '127.0.0.1');
let baseUrl = '';
const tokens = Object.fromEntries(users.map(user => [
  user.id,
  jwt.sign({ sub: user.id, username: user.username, role: user.role }, jwtSecret, { expiresIn: '5m' })
]));

async function api(userId, url, options = {}) {
  const response = await fetch(`${baseUrl}${url}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${tokens[userId]}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  let body = null;
  try { body = await response.json(); } catch {}
  return { response, body };
}

const validPayload = (overrides = {}) => ({
  category: 'creative',
  title: '我的创意作品',
  description: '这是作品的说明。',
  locationId: 1,
  images: [{ key: 'Award/101__alice/1700000000000_abc123.jpg' }],
  ...overrides
});

// 直接向测试数据文件追加一条“已通过”的作品（用于配额等测试）
function addApprovedRecord(id, userId, username, title) {
  const list = JSON.parse(fs.readFileSync(submissionsFile, 'utf8'));
  list.push({
    id,
    category: 'creative',
    categoryName: '最佳创意奖',
    title,
    description: '测试作品说明',
    locationId: 1,
    locationName: '何尔达屋',
    images: [{ key: 'sample/sample_x.jpg', url: '' }],
    userId,
    username,
    avatar: '',
    status: 'approved',
    featured: false,
    winnerRank: '',
    votes: [],
    appealReason: '',
    appealTime: 0,
    appealStatus: '',
    appealResult: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    reviewedAt: Date.now(),
    reviewNote: ''
  });
  fs.writeFileSync(submissionsFile, JSON.stringify(list, null, 2), 'utf8');
}

test.before(async () => {
  if (!server.listening) await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (server.listening) {
    server.close();
    await once(server, 'close');
  }
  const resolved = path.resolve(testDir);
  if (resolved.startsWith(path.resolve(os.tmpdir()))) fs.rmSync(resolved, { recursive: true, force: true });
});

test('meta returns categories, deadline and limits', async () => {
  const { response, body } = await api(101, '/submissions/meta');
  assert.equal(response.status, 200);
  assert.equal(body.code, 0);
  assert.equal(body.data.categories.length, 2);
  assert.ok(body.data.deadline);
  assert.ok(body.data.maxImagesPerWork > 0);
  assert.ok(body.data.maxVotesPerDay > 0);
});

test('creates a pending submission', async () => {
  const { response, body } = await api(101, '/submissions', {
    method: 'POST',
    body: JSON.stringify(validPayload())
  });
  assert.equal(response.status, 200);
  assert.equal(body.code, 0);
  assert.equal(body.data.submission.status, 'pending');
  assert.equal(body.data.submission.categoryName, '最佳创意奖');
});

test('prevents duplicate submission in the same category', async () => {
  const { response, body } = await api(101, '/submissions', {
    method: 'POST',
    body: JSON.stringify(validPayload({ title: '重复提交' }))
  });
  assert.equal(response.status, 200);
  assert.equal(body.code, 2);
});

test('allows a submission in a different category', async () => {
  const { response, body } = await api(101, '/submissions', {
    method: 'POST',
    body: JSON.stringify(validPayload({ category: 'photography', title: '我的摄影作品' }))
  });
  assert.equal(response.status, 200);
  assert.equal(body.code, 0);
  assert.equal(body.data.submission.categoryName, '最佳摄影奖');
});

test('validates category, location, title and image count', async () => {
  const badCategory = await api(101, '/submissions', {
    method: 'POST',
    body: JSON.stringify(validPayload({ category: 'music' }))
  });
  assert.equal(badCategory.body.code, 1);

  const badLocation = await api(101, '/submissions', {
    method: 'POST',
    body: JSON.stringify(validPayload({ locationId: 99999 }))
  });
  assert.equal(badLocation.body.code, 1);

  const badTitle = await api(101, '/submissions', {
    method: 'POST',
    body: JSON.stringify(validPayload({ title: '  ' }))
  });
  assert.equal(badTitle.body.code, 1);

  const tooManyImages = await api(101, '/submissions', {
    method: 'POST',
    body: JSON.stringify(validPayload({
      images: [1, 2, 3, 4].map(n => ({ key: `Award/101__alice/img${n}.jpg` }))
    }))
  });
  assert.equal(tooManyImages.body.code, 1);
});

test('rejects images that do not belong to the user', async () => {
  const { response, body } = await api(101, '/submissions', {
    method: 'POST',
    body: JSON.stringify(validPayload({
      category: 'photography',
      images: [{ key: 'Award/202__bob/1700000000000_x.jpg' }]
    }))
  });
  assert.equal(response.status, 400);
  assert.equal(body.code, 1);
});

test('mine returns only my submissions and public list hides pending', async () => {
  const mine = await api(101, '/submissions/mine');
  assert.equal(mine.body.code, 0);
  assert.equal(mine.body.list.length, 2);

  const otherMine = await api(202, '/submissions/mine');
  assert.equal(otherMine.body.list.length, 0);

  const publicList = await api(101, '/submissions');
  assert.equal(publicList.body.list.length, 0); // nothing approved yet
});

test('user can withdraw own pending submission only', async () => {
  const mine = await api(101, '/submissions/mine');
  const targetId = mine.body.list[0].id;

  const forbidden = await api(202, `/submissions/${targetId}`, { method: 'DELETE' });
  assert.equal(forbidden.response.status, 403);

  const removed = await api(101, `/submissions/${targetId}`, { method: 'DELETE' });
  assert.equal(removed.body.code, 0);

  const after = await api(101, '/submissions/mine');
  assert.equal(after.body.list.length, 1);
});

test('supports same-day vote toggle on approved works', async () => {
  // 101 投摄影奖（其创意类已有待审核作品，摄影类可投）
  const created = await api(101, '/submissions', {
    method: 'POST',
    body: JSON.stringify(validPayload({ category: 'photography', title: '可投票的作品' }))
  });
  assert.equal(created.body.code, 0);
  const id = created.body.data.submission.id;

  const approved = await api(202, `/admin/submissions/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    body: JSON.stringify({})
  });
  assert.equal(approved.body.code, 0);

  // 101 投票
  const vote1 = await api(101, `/submissions/${encodeURIComponent(id)}/vote`, {
    method: 'POST',
    body: JSON.stringify({ action: 'vote' })
  });
  assert.equal(vote1.body.code, 0);
  assert.equal(vote1.body.likeCount, 1);
  assert.equal(vote1.body.votedToday, true);

  // 202 投票 → 2
  const vote2 = await api(202, `/submissions/${encodeURIComponent(id)}/vote`, {
    method: 'POST',
    body: JSON.stringify({ action: 'vote' })
  });
  assert.equal(vote2.body.likeCount, 2);

  // 101 再次点击 = 取消当天投票 → 1
  const cancel = await api(101, `/submissions/${encodeURIComponent(id)}/vote`, {
    method: 'POST',
    body: JSON.stringify({ action: 'vote' })
  });
  assert.equal(cancel.body.likeCount, 1);
  assert.equal(cancel.body.votedToday, false);

  // 101 重新投票 → 2
  const revote = await api(101, `/submissions/${encodeURIComponent(id)}/vote`, {
    method: 'POST',
    body: JSON.stringify({ action: 'vote' })
  });
  assert.equal(revote.body.likeCount, 2);
  assert.equal(revote.body.votedToday, true);

  // 公开列表：202 视角 votedToday=true
  const publicList = await api(202, '/submissions?category=photography');
  const target = publicList.body.list.find(x => x.id === id);
  assert.equal(target.likeCount, 2);
  assert.equal(target.votedToday, true);
});

test('cannot vote a pending work', async () => {
  const created = await api(202, '/submissions', {
    method: 'POST',
    body: JSON.stringify(validPayload({
      category: 'creative',
      title: '待审核作品',
      images: [{ key: 'Award/202__bob/1700000000000_xyz.jpg' }]
    }))
  });
  assert.equal(created.body.code, 0);
  const id = created.body.data.submission.id;

  const vote = await api(101, `/submissions/${encodeURIComponent(id)}/vote`, {
    method: 'POST',
    body: JSON.stringify({ action: 'vote' })
  });
  assert.equal(vote.body.code, 1);
});

test('limits votes to 3 per user per day', async () => {
  addApprovedRecord('q1', 303, 'carol', '作品一');
  addApprovedRecord('q2', 303, 'carol', '作品二');
  addApprovedRecord('q3', 303, 'carol', '作品三');
  addApprovedRecord('q4', 303, 'carol', '作品四');

  const v1 = await api(303, '/submissions/q1/vote', { method: 'POST', body: JSON.stringify({ action: 'vote' }) });
  assert.equal(v1.body.code, 0);
  assert.equal(v1.body.remaining, 2);

  const v2 = await api(303, '/submissions/q2/vote', { method: 'POST', body: JSON.stringify({ action: 'vote' }) });
  assert.equal(v2.body.remaining, 1);

  const v3 = await api(303, '/submissions/q3/vote', { method: 'POST', body: JSON.stringify({ action: 'vote' }) });
  assert.equal(v3.body.remaining, 0);

  // 第 4 票被拦截
  const v4 = await api(303, '/submissions/q4/vote', { method: 'POST', body: JSON.stringify({ action: 'vote' }) });
  assert.equal(v4.body.code, 3);

  // 同一真实姓名的另一个账号（dave）共享每日额度 → 也被拦截
  const daveVote = await api(404, '/submissions/q4/vote', { method: 'POST', body: JSON.stringify({ action: 'vote' }) });
  assert.equal(daveVote.body.code, 3);

  // 取消 q3 当天投票 → 剩 1 票
  const cancel = await api(303, '/submissions/q3/vote', { method: 'POST', body: JSON.stringify({ action: 'vote' }) });
  assert.equal(cancel.body.code, 0);
  assert.equal(cancel.body.votedToday, false);
  assert.equal(cancel.body.remaining, 1);

  // dave 用同一真实姓名投 q4 → 成功，剩余 0
  const daveVote2 = await api(404, '/submissions/q4/vote', { method: 'POST', body: JSON.stringify({ action: 'vote' }) });
  assert.equal(daveVote2.body.code, 0);
  assert.equal(daveVote2.body.votedToday, true);
  assert.equal(daveVote2.body.remaining, 0);

  // carol 再点 q4 = 同一真实姓名 → 取消当天的这 1 票（每真名每作品每天 1 票）
  const carolToggle = await api(303, '/submissions/q4/vote', { method: 'POST', body: JSON.stringify({ action: 'vote' }) });
  assert.equal(carolToggle.body.code, 0);
  assert.equal(carolToggle.body.votedToday, false);
  assert.equal(carolToggle.body.remaining, 1);

  // 配额接口
  const quota = await api(303, '/submissions/votes/quota');
  assert.equal(quota.body.code, 0);
  assert.equal(quota.body.data.usedToday, 2);
  assert.equal(quota.body.data.remaining, 1);
  assert.equal(quota.body.data.maxVotesPerDay, 3);
});

test('realName is used as vote identity', () => {
  const { realNameOfUser, voteKey } = submissionsRouter._test;
  assert.equal(realNameOfUser({ realName: '张三' }), '张三');
  assert.equal(realNameOfUser({ phone: '李四' }), '李四');
  assert.equal(realNameOfUser({ username: 'alice' }), 'alice');
  const byName = voteKey({ name: '王五', userId: 303 }, {});
  assert.equal(byName, '王五');
  const byUser = voteKey({ userId: 303 }, { '303': { realName: '王五' } });
  assert.equal(byUser, '王五');
});

test('beijingDay helper uses UTC+8 date', () => {
  const { beijingDay } = submissionsRouter._test;
  // 2026-08-09T16:30:00Z = 北京时间 2026-08-10 00:30
  assert.equal(beijingDay(Date.UTC(2026, 7, 9, 16, 30)), '2026-08-10');
  // 2026-08-09T15:59:00Z = 北京时间 2026-08-09 23:59
  assert.equal(beijingDay(Date.UTC(2026, 7, 9, 15, 59)), '2026-08-09');
});

test('admin can set and unset winner; public winners list reflects it', async () => {
  const created = await api(202, '/submissions', {
    method: 'POST',
    body: JSON.stringify(validPayload({
      category: 'photography',
      title: '获奖作品',
      images: [{ key: 'Award/202__bob/1700000000001_xyz.jpg' }]
    }))
  });
  assert.equal(created.body.code, 0);
  const id = created.body.data.submission.id;

  // 未通过前不能设置获奖
  const tooEarly = await api(202, `/admin/submissions/${encodeURIComponent(id)}/winner`, {
    method: 'POST',
    body: JSON.stringify({ rank: 'first' })
  });
  assert.equal(tooEarly.body.code, 1);

  // 通过后设置一等奖
  await api(202, `/admin/submissions/${encodeURIComponent(id)}/approve`, { method: 'POST', body: JSON.stringify({}) });
  const setWinner = await api(202, `/admin/submissions/${encodeURIComponent(id)}/winner`, {
    method: 'POST',
    body: JSON.stringify({ rank: 'first' })
  });
  assert.equal(setWinner.body.code, 0);
  assert.equal(setWinner.body.winnerLabel, '一等奖');

  // 公开公示列表包含该作品
  const winners = await api(101, '/submissions/winners');
  assert.equal(winners.body.code, 0);
  assert.ok(winners.body.list.some(x => x.id === id && x.winnerLabel === '一等奖'));

  // 非法等级
  const badRank = await api(202, `/admin/submissions/${encodeURIComponent(id)}/winner`, {
    method: 'POST',
    body: JSON.stringify({ rank: 'superstar' })
  });
  assert.equal(badRank.body.code, 1);

  // 取消获奖后公示为空
  await api(202, `/admin/submissions/${encodeURIComponent(id)}/winner`, {
    method: 'POST',
    body: JSON.stringify({ rank: '' })
  });
  const winnersAfter = await api(101, '/submissions/winners');
  assert.equal(winnersAfter.body.list.some(x => x.id === id), false);
});

test('rejection reason, appeal and re-review flow', async () => {
  // 用 202 在“cannot vote a pending work”里创建的待审核作品做驳回+申诉
  const mine = await api(202, '/submissions/mine');
  const target = mine.body.list.find(x => x.title === '待审核作品');
  assert.ok(target);

  // 管理员驳回，必须写明理由
  const noNote = await api(202, `/admin/submissions/${encodeURIComponent(target.id)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ note: '' })
  });
  assert.equal(noNote.body.code, 1);

  const rejected = await api(202, `/admin/submissions/${encodeURIComponent(target.id)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ note: '作品模糊，请重新拍摄' })
  });
  assert.equal(rejected.body.code, 0);

  // 本人可见详情与驳回理由
  const detail = await api(202, `/submissions/${encodeURIComponent(target.id)}`);
  assert.equal(detail.body.code, 0);
  assert.equal(detail.body.data.submission.status, 'rejected');
  assert.equal(detail.body.data.submission.reviewNote, '作品模糊，请重新拍摄');

  // 他人不可见详情
  const forbidden = await api(101, `/submissions/${encodeURIComponent(target.id)}`);
  assert.equal(forbidden.response.status, 403);

  // 申诉必须有理由
  const noReason = await api(202, `/submissions/${encodeURIComponent(target.id)}/appeal`, {
    method: 'POST',
    body: JSON.stringify({ reason: '' })
  });
  assert.equal(noReason.body.code, 1);

  // 提交申诉
  const appeal = await api(202, `/submissions/${encodeURIComponent(target.id)}/appeal`, {
    method: 'POST',
    body: JSON.stringify({ reason: '原图清晰，是压缩导致模糊，请复核' })
  });
  assert.equal(appeal.body.code, 0);
  assert.equal(appeal.body.data.submission.appealStatus, 'pending');

  // 申诉中不能重复申诉
  const repeat = await api(202, `/submissions/${encodeURIComponent(target.id)}/appeal`, {
    method: 'POST',
    body: JSON.stringify({ reason: '再申诉一次' })
  });
  assert.equal(repeat.body.code, 1);

  // 管理员通过申诉 → 状态变为已通过
  const approveAppeal = await api(202, `/admin/submissions/${encodeURIComponent(target.id)}/approve`, {
    method: 'POST',
    body: JSON.stringify({})
  });
  assert.equal(approveAppeal.body.code, 0);

  const after = await api(202, `/submissions/${encodeURIComponent(target.id)}`);
  assert.equal(after.body.data.submission.status, 'approved');
  assert.equal(after.body.data.submission.appealStatus, 'resolved');
  assert.equal(after.body.data.submission.appealResult, 'approved');
});

test('handles corrupted storage without crashing', async () => {
  fs.writeFileSync(submissionsFile, '{broken', 'utf8');
  const after = await api(101, '/submissions/mine');
  assert.equal(after.body.code, 0);
});
