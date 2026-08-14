const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const test = require('node:test');
const express = require('express');
const jwt = require('jsonwebtoken');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-user-delete-test-'));
const usersFile = path.join(testDir, 'users.json');
const submissionsFile = path.join(testDir, 'submissions.json');
const feedbackFile = path.join(testDir, 'feedback.json');
const locationSettingsFile = path.join(testDir, 'location-settings.json');
const jwtSecret = 'admin-user-delete-test-secret-with-sufficient-length';
const now = Date.now();

const blankUser = extra => ({
  points: 0,
  unlockedLocations: [],
  lockingLocations: [],
  completedRoutes: [],
  checkinRecords: [],
  pendingCheckins: [],
  checkinReviewRecords: [],
  ...extra
});

const users = [
  blankUser({ id: 1, username: 'campus-owner', role: 'visitor' }), // 通过 ADMIN_OWNER_IDS 成为超管
  blankUser({ id: 2, username: 'reviewer', role: 'admin' }),
  blankUser({ id: 3, username: 'student', realName: '林同学', studentId: '23300003', role: 'visitor' }),
  blankUser({ id: 4, username: 'co-owner', role: 'owner' })
];

const submissions = [
  {
    id: 'submission-own',
    category: 'creative',
    title: '本人投稿',
    userId: 3,
    username: 'student',
    status: 'approved',
    featured: false,
    votes: [],
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'submission-other',
    category: 'photography',
    title: '他人投稿',
    userId: 2,
    username: 'reviewer',
    status: 'approved',
    featured: false,
    votes: [
      { userId: 3, name: 'student', day: '2026-08-14', ts: now },
      { userId: 2, name: 'reviewer', day: '2026-08-14', ts: now }
    ],
    createdAt: now,
    updatedAt: now
  }
];

const feedback = [
  { id: 'feedback-own', userId: 3, username: 'student', content: '删除我', status: 'submitted', reply: '', createdAt: now, updatedAt: now },
  { id: 'feedback-other', userId: 2, username: 'reviewer', content: '保留我', status: 'submitted', reply: '', createdAt: now, updatedAt: now }
];

fs.writeFileSync(usersFile, JSON.stringify(users), 'utf8');
fs.writeFileSync(submissionsFile, JSON.stringify(submissions), 'utf8');
fs.writeFileSync(feedbackFile, JSON.stringify(feedback), 'utf8');

process.env.USERS_FILE = usersFile;
process.env.SUBMISSIONS_FILE = submissionsFile;
process.env.FEEDBACK_FILE = feedbackFile;
process.env.LOCATION_SETTINGS_FILE = locationSettingsFile;
process.env.JWT_SECRET = jwtSecret;
process.env.ADMIN_OWNER_IDS = '1';
process.env.ADMIN_OWNER_USERNAMES = '';

const adminRouter = require('../routes/admin');
const app = express();
app.use(express.json({ limit: '64kb' }));
app.use('/admin', adminRouter);

const server = app.listen(0, '127.0.0.1');
let baseUrl = '';
const tokens = Object.fromEntries(users.map(user => [
  user.id,
  jwt.sign({ id: user.id }, jwtSecret, { expiresIn: '5m' })
]));

async function api(userId, url, options = {}) {
  const response = await fetch(`${baseUrl}${url}`, {
    ...options,
    headers: { Authorization: `Bearer ${tokens[userId]}`, 'Content-Type': 'application/json' }
  });
  return { response, body: await response.json() };
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

test('rejects account deletion from non-owner roles', async () => {
  const visitor = await api(3, '/admin/users/2', { method: 'DELETE' });
  assert.equal(visitor.response.status, 403);

  const reviewer = await api(2, '/admin/users/3', { method: 'DELETE' });
  assert.equal(reviewer.response.status, 403);
});

test('protects the owner and privileged accounts from deletion', async () => {
  const selfDelete = await api(1, '/admin/users/1', { method: 'DELETE' });
  assert.equal(selfDelete.response.status, 400);
  assert.equal(selfDelete.body.message, '不能删除自己的账号');

  const ownerDelete = await api(1, '/admin/users/4', { method: 'DELETE' });
  assert.equal(ownerDelete.response.status, 400);
  assert.equal(ownerDelete.body.message, '不能删除受保护的超级管理员');

  const missing = await api(1, '/admin/users/999', { method: 'DELETE' });
  assert.equal(missing.response.status, 404);
});

test('owner deletion removes the account and its submissions, votes and feedback', async () => {
  const result = await api(1, '/admin/users/3', { method: 'DELETE' });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.code, 0);
  assert.equal(result.body.data.removedSubmissions, 1);
  assert.equal(result.body.data.removedFeedback, 1);

  const storedUsers = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
  assert.equal(storedUsers.length, 3);
  assert.ok(!storedUsers.some(user => user.id === 3));

  const storedSubmissions = JSON.parse(fs.readFileSync(submissionsFile, 'utf8'));
  assert.equal(storedSubmissions.length, 1);
  assert.equal(storedSubmissions[0].id, 'submission-other');
  assert.deepEqual(storedSubmissions[0].votes.map(vote => vote.userId), [2]);

  const storedFeedback = JSON.parse(fs.readFileSync(feedbackFile, 'utf8'));
  assert.deepEqual(storedFeedback.map(item => item.id), ['feedback-other']);

  // 被删账号的 token 立即失效
  const revoked = await api(3, '/admin/dashboard');
  assert.equal(revoked.response.status, 401);
});
