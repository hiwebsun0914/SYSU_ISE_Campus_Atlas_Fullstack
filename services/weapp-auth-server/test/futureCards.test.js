const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const test = require('node:test');
const express = require('express');
const jwt = require('jsonwebtoken');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'future-cards-test-'));
const usersFile = path.join(testDir, 'users.json');
const cardsFile = path.join(testDir, 'future_cards.json');
const jwtSecret = 'test-only-secret-with-sufficient-length';
const users = [
  { id: 101, username: '测试甲', role: 'participant' },
  { id: 202, username: '测试乙', role: 'participant' }
];

fs.writeFileSync(usersFile, JSON.stringify(users), 'utf8');
process.env.USERS_FILE = usersFile;
process.env.FUTURE_CARDS_FILE = cardsFile;
process.env.JWT_SECRET = jwtSecret;
process.env.SENSITIVE_WORDS = '诈骗,赌博';
process.env.FUTURE_CARD_WRITE_LIMIT = '100';

const futureCardsRouter = require('../routes/futureCards');
const app = express();
app.use(express.json({ limit: '32kb' }));
app.use('/future-cards', futureCardsRouter);

const server = app.listen(0, '127.0.0.1');
let baseUrl = '';
const tokens = Object.fromEntries(users.map(user => [
  user.id,
  jwt.sign({ sub: user.id, username: user.username, role: user.role }, jwtSecret, { expiresIn: '5m' })
]));

function payload(mode = 'expectation', content = '愿我一直保持探索。', overrides = {}) {
  return {
    mode,
    content,
    templateId: 'sysu-editorial',
    style: { fontId: 'sans', size: 'medium', align: 'left', signatureMode: 'default' },
    ...overrides
  };
}

async function api(userId, url, options = {}) {
  const response = await fetch(`${baseUrl}${url}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${tokens[userId]}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
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

test('counts Unicode graphemes and ignores whitespace', () => {
  const { visibleLength } = futureCardsRouter._test;
  assert.equal(visibleLength(' 中\n 文 '), 2);
  assert.equal(visibleLength('👨‍👩‍👧‍👦'), 1);
  assert.equal(visibleLength('e\u0301'), 1);
  assert.equal(visibleLength(' \n\t '), 0);
});

test('enforces 60/500 limits and style allowlists', async () => {
  const sixty = await api(101, '/future-cards', { method: 'POST', body: JSON.stringify(payload('expectation', '愿'.repeat(60))) });
  assert.equal(sixty.response.status, 201);
  assert.equal(sixty.body.code, 0);

  const sixtyOne = await api(101, '/future-cards', { method: 'POST', body: JSON.stringify(payload('expectation', '愿'.repeat(61))) });
  assert.equal(sixtyOne.response.status, 400);
  assert.equal(sixtyOne.body.errorCode, 'CONTENT_TOO_LONG');

  const fiveHundred = await api(101, '/future-cards', { method: 'POST', body: JSON.stringify(payload('letter', '前'.repeat(500))) });
  assert.equal(fiveHundred.response.status, 201);

  const fiveHundredOne = await api(101, '/future-cards', { method: 'POST', body: JSON.stringify(payload('letter', '前'.repeat(501))) });
  assert.equal(fiveHundredOne.body.errorCode, 'CONTENT_TOO_LONG');

  const invalidStyle = await api(101, '/future-cards', { method: 'POST', body: JSON.stringify(payload('expectation', '你好', { templateId: 'user-upload' })) });
  assert.equal(invalidStyle.body.errorCode, 'INVALID_STYLE');
});

test('rejects blank, obfuscated sensitive content, and HTML-like markup', async () => {
  const blank = await api(101, '/future-cards', { method: 'POST', body: JSON.stringify(payload('expectation', ' \n\t ')) });
  assert.equal(blank.body.errorCode, 'CONTENT_EMPTY');

  const obfuscated = await api(101, '/future-cards', { method: 'POST', body: JSON.stringify(payload('expectation', '请勿诈\u200b 骗')) });
  assert.equal(obfuscated.body.errorCode, 'CONTENT_REJECTED');

  const html = await api(101, '/future-cards', { method: 'POST', body: JSON.stringify(payload('expectation', '<img src=x onerror=alert(1)>')) });
  assert.equal(html.body.errorCode, 'CONTENT_REJECTED');
});

test('supports CRUD while hiding cards from other users', async () => {
  const created = await api(101, '/future-cards', {
    method: 'POST',
    body: JSON.stringify(payload('letter', '四年后见。', {
      ownerId: 202,
      style: { fontId: 'song', size: 'small', align: 'center', signatureMode: 'nickname' }
    }))
  });
  const card = created.body.data.card;
  assert.match(card.id, /^[0-9a-f-]{36}$/i);
  assert.equal(card.ownerId, 101);
  assert.equal(card.style.signatureText, '测试甲');

  const otherList = await api(202, '/future-cards');
  assert.equal(otherList.body.data.cards.some(item => item.id === card.id), false);

  const otherGet = await api(202, `/future-cards/${card.id}`);
  assert.equal(otherGet.response.status, 404);
  assert.equal(otherGet.body.errorCode, 'CARD_NOT_FOUND');

  const otherPatch = await api(202, `/future-cards/${card.id}`, { method: 'PATCH', body: JSON.stringify(payload('letter', '越权修改')) });
  assert.equal(otherPatch.body.errorCode, 'CARD_NOT_FOUND');

  const updated = await api(101, `/future-cards/${card.id}`, { method: 'PATCH', body: JSON.stringify(payload('letter', '继续向前。')) });
  assert.equal(updated.body.data.card.content, '继续向前。');

  const otherDelete = await api(202, `/future-cards/${card.id}`, { method: 'DELETE' });
  assert.equal(otherDelete.body.errorCode, 'CARD_NOT_FOUND');

  const removed = await api(101, `/future-cards/${card.id}`, { method: 'DELETE' });
  assert.equal(removed.body.code, 0);

  const missing = await api(101, `/future-cards/${card.id}`);
  assert.equal(missing.body.errorCode, 'CARD_NOT_FOUND');
});

test('reports corrupted storage without replacing it', async () => {
  const corrupted = '{not-json';
  fs.writeFileSync(cardsFile, corrupted, 'utf8');
  const result = await api(101, '/future-cards');
  assert.equal(result.response.status, 503);
  assert.equal(result.body.errorCode, 'STORE_UNAVAILABLE');
  assert.equal(fs.readFileSync(cardsFile, 'utf8'), corrupted);
});

