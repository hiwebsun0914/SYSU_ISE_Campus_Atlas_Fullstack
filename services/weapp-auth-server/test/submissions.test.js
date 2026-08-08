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
  { id: 101, username: 'alice', role: 'visitor' },
  { id: 202, username: 'bob', role: 'visitor' }
];

fs.writeFileSync(usersFile, JSON.stringify(users), 'utf8');
process.env.USERS_FILE = usersFile;
process.env.SUBMISSIONS_FILE = submissionsFile;
process.env.JWT_SECRET = jwtSecret;

const submissionsRouter = require('../routes/submissions');
const app = express();
app.use(express.json({ limit: '64kb' }));
app.use('/submissions', submissionsRouter);

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

test('handles corrupted storage without crashing', async () => {
  fs.writeFileSync(submissionsFile, '{broken', 'utf8');
  const after = await api(101, '/submissions/mine');
  assert.equal(after.body.code, 0);
});
