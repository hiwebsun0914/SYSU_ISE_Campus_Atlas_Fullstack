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
process.env.FUTURE_CARD_IMAGE_LIMIT = '64';
process.env.COS_BUCKET = 'public-bucket';
process.env.COS_REGION = 'ap-guangzhou';
process.env.PUBLIC_ASSET_DOMAIN = 'https://public.example.test';
delete process.env.COS_SECRET_ID;
delete process.env.COS_SECRET_KEY;
delete process.env.TENCENT_SECRET_ID;
delete process.env.TENCENT_SECRET_KEY;

const futureCardsModule = require('../routes/futureCards');
const putCalls = [];
const deleteCalls = [];
const publicFetchCalls = [];
let failPut = false;
let pendingPut = null;
const fakeCos = {
  putObject(params) {
    putCalls.push(params);
    if (failPut) return Promise.reject(new Error('cos upload failed'));
    if (pendingPut) return pendingPut.promise;
    return Promise.resolve();
  },
  deleteObject(params) {
    deleteCalls.push(params);
    return Promise.resolve();
  },
  getObjectUrl({ Key }) {
    return `https://cos.test/${encodeURIComponent(Key)}`;
  }
};
const futureCardsRouter = futureCardsModule.createFutureCardsRouter({ cosClient: fakeCos });
const app = express();
app.use(express.json({ limit: '32kb' }));
app.use('/future-cards', futureCardsRouter);

const noCosApp = express();
noCosApp.use(express.json({ limit: '32kb' }));
noCosApp.use('/future-cards', futureCardsModule.createFutureCardsRouter({ cosClient: null }));

const publicApp = express();
publicApp.use(express.json({ limit: '32kb' }));
publicApp.use('/future-cards', futureCardsModule.createFutureCardsRouter({
  fetchImpl(url, options) {
    publicFetchCalls.push({ url, options });
    return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('') });
  }
}));

const server = app.listen(0, '127.0.0.1');
const noCosServer = noCosApp.listen(0, '127.0.0.1');
const publicServer = publicApp.listen(0, '127.0.0.1');
let baseUrl = '';
let noCosBaseUrl = '';
let publicBaseUrl = '';
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
  return apiAt(baseUrl, userId, url, options);
}

async function apiAt(origin, userId, url, options = {}) {
  const response = await fetch(`${origin}${url}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${tokens[userId]}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  return { response, body: await response.json() };
}

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise(resolve => setImmediate(resolve));
  }
  throw new Error('timed out waiting for test condition');
}

const validPng = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x01, 0x02, 0x03
]);

async function createImageCard(content = 'image card') {
  const result = await api(101, '/future-cards', {
    method: 'POST',
    body: JSON.stringify(payload('expectation', content))
  });
  assert.equal(result.response.status, 201);
  return result.body.data.card.id;
}

test.before(async () => {
  if (!server.listening) await once(server, 'listening');
  if (!noCosServer.listening) await once(noCosServer, 'listening');
  if (!publicServer.listening) await once(publicServer, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  noCosBaseUrl = `http://127.0.0.1:${noCosServer.address().port}`;
  publicBaseUrl = `http://127.0.0.1:${publicServer.address().port}`;
});

test.after(async () => {
  if (server.listening) {
    server.close();
    await once(server, 'close');
  }
  if (noCosServer.listening) {
    noCosServer.close();
    await once(noCosServer, 'close');
  }
  if (publicServer.listening) {
    publicServer.close();
    await once(publicServer, 'close');
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

test('uses reliable numeric fallbacks for configured limits', () => {
  const { readPositiveLimit } = futureCardsRouter._test;
  const envName = 'FUTURE_CARD_TEST_LIMIT';
  const previous = process.env[envName];
  process.env[envName] = 'not-a-number';
  assert.equal(readPositiveLimit(envName, 30), 30);
  process.env[envName] = '0';
  assert.equal(readPositiveLimit(envName, 30), 30);
  process.env[envName] = '12.9';
  assert.equal(readPositiveLimit(envName, 30), 12);
  if (previous === undefined) delete process.env[envName];
  else process.env[envName] = previous;
});

test('requires authentication for every future-card endpoint, including image upload', async () => {
  const response = await fetch(`${baseUrl}/future-cards`);
  const body = await response.json();
  assert.equal(response.status, 401);
  assert.equal(body.code, 1);

  const before = putCalls.length;
  const imageResponse = await fetch(`${baseUrl}/future-cards/missing/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: validPng
  });
  const imageBody = await imageResponse.json();
  assert.equal(imageResponse.status, 401);
  assert.equal(imageBody.code, 1);
  assert.equal(putCalls.length, before);
});

test('does not allow another user to upload an image to an owned card', async () => {
  const cardId = await createImageCard('owner isolation');
  const before = putCalls.length;
  const result = await api(202, `/future-cards/${cardId}/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: validPng
  });
  assert.equal(result.response.status, 404);
  assert.equal(result.body.errorCode, 'CARD_NOT_FOUND');
  assert.equal(putCalls.length, before);
});

test('enforces 500-character limits and style allowlists', async () => {
  const expectationFiveHundred = await api(101, '/future-cards', { method: 'POST', body: JSON.stringify(payload('expectation', '愿'.repeat(500))) });
  assert.equal(expectationFiveHundred.response.status, 201);
  assert.equal(expectationFiveHundred.body.code, 0);

  const expectationFiveHundredOne = await api(101, '/future-cards', { method: 'POST', body: JSON.stringify(payload('expectation', '愿'.repeat(501))) });
  assert.equal(expectationFiveHundredOne.response.status, 400);
  assert.equal(expectationFiveHundredOne.body.errorCode, 'CONTENT_TOO_LONG');

  const fiveHundred = await api(101, '/future-cards', { method: 'POST', body: JSON.stringify(payload('letter', '前'.repeat(500))) });
  assert.equal(fiveHundred.response.status, 201);

  const fiveHundredOne = await api(101, '/future-cards', { method: 'POST', body: JSON.stringify(payload('letter', '前'.repeat(501))) });
  assert.equal(fiveHundredOne.body.errorCode, 'CONTENT_TOO_LONG');

  const invalidStyle = await api(101, '/future-cards', { method: 'POST', body: JSON.stringify(payload('expectation', '你好', { templateId: 'user-upload' })) });
  assert.equal(invalidStyle.body.errorCode, 'INVALID_STYLE');
});

test('accepts a custom signature and validates its length', async () => {
  const custom = await api(101, '/future-cards', {
    method: 'POST',
    body: JSON.stringify(payload('expectation', '保持好奇。', {
      style: { fontId: 'sans', size: 'medium', align: 'left', signatureMode: 'custom', signatureText: '智工探索者' }
    }))
  });
  assert.equal(custom.response.status, 201);
  assert.equal(custom.body.data.card.style.signatureText, '智工探索者');

  const empty = await api(101, '/future-cards', {
    method: 'POST',
    body: JSON.stringify(payload('expectation', '继续前进。', {
      style: { fontId: 'sans', size: 'medium', align: 'left', signatureMode: 'custom', signatureText: '   ' }
    }))
  });
  assert.equal(empty.body.errorCode, 'INVALID_SIGNATURE');

  const tooLong = await api(101, '/future-cards', {
    method: 'POST',
    body: JSON.stringify(payload('expectation', '去看更大的世界。', {
      style: { fontId: 'sans', size: 'medium', align: 'left', signatureMode: 'custom', signatureText: '署'.repeat(25) }
    }))
  });
  assert.equal(tooLong.body.errorCode, 'INVALID_SIGNATURE');
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

test('validates PNG bytes before calling COS and maps image size errors', async () => {
  const cardId = await createImageCard('image validation');
  putCalls.length = 0;

  const spoofed = await api(101, `/future-cards/${cardId}/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: Buffer.from('not a png')
  });
  assert.equal(spoofed.response.status, 400);
  assert.equal(spoofed.body.errorCode, 'INVALID_IMAGE');
  assert.equal(putCalls.length, 0);

  const wrongMime = await api(101, `/future-cards/${cardId}/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/jpeg' },
    body: validPng
  });
  assert.equal(wrongMime.response.status, 400);
  assert.equal(wrongMime.body.errorCode, 'INVALID_IMAGE');
  assert.equal(putCalls.length, 0);

  const tooLarge = await api(101, `/future-cards/${cardId}/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: Buffer.concat([validPng, Buffer.alloc(64)])
  });
  assert.equal(tooLarge.response.status, 413);
  assert.equal(tooLarge.body.errorCode, 'IMAGE_TOO_LARGE');
  assert.equal(putCalls.length, 0);
});

test('returns structured COS unavailable and upload failures', async () => {
  const cardId = await createImageCard('cos errors');
  const unavailable = await apiAt(noCosBaseUrl, 101, `/future-cards/${cardId}/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: validPng
  });
  assert.equal(unavailable.response.status, 503);
  assert.equal(unavailable.body.errorCode, 'COS_UNAVAILABLE');

  deleteCalls.length = 0;
  failPut = true;
  const failed = await api(101, `/future-cards/${cardId}/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: validPng
  });
  failPut = false;
  assert.equal(failed.response.status, 502);
  assert.equal(failed.body.errorCode, 'IMAGE_UPLOAD_FAILED');
  assert.equal(deleteCalls.length, 1);
  assert.equal(deleteCalls[0].Key, putCalls.at(-1).Key);
});

test('uploads to public bucket defaults without COS credentials', async () => {
  const created = await apiAt(publicBaseUrl, 101, '/future-cards', {
    method: 'POST',
    body: JSON.stringify(payload('expectation', 'public bucket upload'))
  });
  const cardId = created.body.data.card.id;
  publicFetchCalls.length = 0;

  const uploaded = await apiAt(publicBaseUrl, 101, `/future-cards/${cardId}/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: validPng
  });

  assert.equal(uploaded.response.status, 201);
  assert.equal(publicFetchCalls.length, 1);
  assert.equal(publicFetchCalls[0].options.method, 'PUT');
  assert.match(publicFetchCalls[0].url, /^https:\/\/public\.example\.test\/FutureCard\/101\//);
  assert.match(uploaded.body.data.card.imageUrl, /^https:\/\/public\.example\.test\/FutureCard\/101\//);
});

test('uploads, replaces, and deletes card images with signed URLs and cleanup', async () => {
  const cardId = await createImageCard('cos success');
  deleteCalls.length = 0;
  const first = await api(101, `/future-cards/${cardId}/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: validPng
  });
  assert.equal(first.response.status, 201);
  const firstKey = first.body.data.card.imageKey;
  assert.match(first.body.data.card.imageUrl, /^https:\/\/cos\.test\//);

  const second = await api(101, `/future-cards/${cardId}/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: Buffer.concat([validPng, Buffer.from([0xaa])])
  });
  assert.equal(second.response.status, 201);
  const secondKey = second.body.data.card.imageKey;
  assert.notEqual(secondKey, firstKey);
  assert.ok(deleteCalls.some(item => item.Key === firstKey));

  const removed = await api(101, `/future-cards/${cardId}`, { method: 'DELETE' });
  assert.equal(removed.response.status, 200);
  assert.ok(deleteCalls.some(item => item.Key === secondKey));
});

test('retains a concurrent PATCH while an image upload is in flight', async () => {
  const cardId = await createImageCard('before concurrent patch');
  let resolvePut;
  pendingPut = { promise: new Promise(resolve => { resolvePut = resolve; }) };
  putCalls.length = 0;
  const uploading = api(101, `/future-cards/${cardId}/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: validPng
  });
  await waitFor(() => putCalls.length > 0);

  const patched = await api(101, `/future-cards/${cardId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload('expectation', 'patched during upload'))
  });
  assert.equal(patched.response.status, 200);
  resolvePut();
  pendingPut = null;
  const uploaded = await uploading;
  assert.equal(uploaded.response.status, 201);

  const current = await api(101, `/future-cards/${cardId}`);
  assert.equal(current.body.data.card.content, 'patched during upload');
  assert.equal(current.body.data.card.imageKey, uploaded.body.data.card.imageKey);
  await api(101, `/future-cards/${cardId}`, { method: 'DELETE' });
});

test('does not resurrect a card deleted while its image upload is in flight', async () => {
  const cardId = await createImageCard('delete during upload');
  let resolvePut;
  pendingPut = { promise: new Promise(resolve => { resolvePut = resolve; }) };
  putCalls.length = 0;
  deleteCalls.length = 0;
  const uploading = api(101, `/future-cards/${cardId}/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: validPng
  });
  await waitFor(() => putCalls.length > 0);
  const deleted = await api(101, `/future-cards/${cardId}`, { method: 'DELETE' });
  assert.equal(deleted.response.status, 200);
  const uploadedKey = putCalls[0].Key;
  resolvePut();
  pendingPut = null;
  const result = await uploading;
  assert.equal(result.response.status, 404);
  assert.equal(result.body.errorCode, 'CARD_NOT_FOUND');
  assert.ok(deleteCalls.some(item => item.Key === uploadedKey));
  const missing = await api(101, `/future-cards/${cardId}`);
  assert.equal(missing.response.status, 404);
});

test('reports corrupted storage without replacing it', async () => {
  const corrupted = '{not-json';
  fs.writeFileSync(cardsFile, corrupted, 'utf8');
  const result = await api(101, '/future-cards');
  assert.equal(result.response.status, 503);
  assert.equal(result.body.errorCode, 'STORE_UNAVAILABLE');
  assert.equal(fs.readFileSync(cardsFile, 'utf8'), corrupted);
});
