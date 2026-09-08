const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const test = require('node:test');
const jwt = require('jsonwebtoken');
const COS = require('cos-nodejs-sdk-v5');
const sharp = require('sharp');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'checkin-upload-test-'));
const usersFile = path.join(testDir, 'users.json');
const jwtSecret = 'checkin-upload-test-secret-with-sufficient-length';
const heads = new Map();
const bodies = new Map();
const metadataCopies = [];

fs.writeFileSync(usersFile, JSON.stringify([{
  id: 901,
  username: 'photo-user',
  role: 'visitor',
  points: 0,
  unlockedLocations: [],
  lockingLocations: [],
  completedRoutes: [],
  pendingCheckins: [],
  checkinReviewRecords: []
}]), 'utf8');

process.env.USERS_FILE = usersFile;
process.env.JWT_SECRET = jwtSecret;
process.env.PORT = '0';
process.env.DEV_BYPASS_AUTH = 'false';
process.env.COS_BUCKET = 'checkin-test-1234567890';
process.env.COS_REGION = 'ap-guangzhou';
process.env.PUBLIC_ASSET_DOMAIN = 'https://assets.example.com';
process.env.TENCENT_SECRET_ID = 'fake-id';
process.env.TENCENT_SECRET_KEY = 'fake-key';

COS.prototype.getObjectUrl = function getObjectUrl(options, callback) {
  callback(null, { Url: `https://upload.example.com/${encodeURI(options.Key)}` });
};
COS.prototype.headObject = async function headObject(options) {
  const value = heads.get(options.Key);
  if (!value) throw new Error('NoSuchKey');
  return value;
};
COS.prototype.putObjectCopy = async function putObjectCopy(options) {
  metadataCopies.push(options);
  return { statusCode: 200 };
};
COS.prototype.getObject = function getObject(options, callback) {
  const body = bodies.get(options.Key);
  if (!body) return callback(new Error('NoSuchKey'));
  return callback(null, { Body: body });
};
COS.prototype.putObject = function putObject(options, callback) {
  bodies.set(options.Key, options.Body);
  heads.set(options.Key, { headers: { 'content-length': String(options.ContentLength), 'content-type': options.ContentType } });
  return callback(null, { statusCode: 200 });
};
COS.prototype.deleteObject = function deleteObject(options, callback) {
  bodies.delete(options.Key);
  heads.delete(options.Key);
  return callback(null, { statusCode: 204 });
};

const app = require('../app');
const server = app.listen(0, '127.0.0.1');
const token = jwt.sign({ id: 901 }, jwtSecret, { expiresIn: '5m' });
let baseUrl = '';

async function api(route, body) {
  const response = await fetch(`${baseUrl}${route}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { response, body: await response.json() };
}

test.before(async () => {
  if (!server.listening) await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (server.listening) { server.close(); await once(server, 'close'); }
  fs.rmSync(testDir, { recursive: true, force: true });
});

test('commits both optimized objects, cache metadata, and thumbnail data', async () => {
  const signed = await api('/checkin/presign', { ext: 'webp', locationId: 1 });
  const { main, thumbnail } = signed.body.data;
  heads.set(main.key, { headers: { 'content-length': '800000', 'content-type': 'image/webp' } });
  heads.set(thumbnail.key, { headers: { 'content-length': '70000', 'content-type': 'image/webp' } });

  const committed = await api('/checkin/commit', {
    key: main.key,
    size: 800000,
    thumbnailKey: thumbnail.key,
    thumbnailSize: 70000,
    mime: 'image/webp',
    locationId: 1
  });

  assert.equal(committed.response.status, 200);
  assert.match(committed.body.thumbnail, /_thumb\.webp$/);
  assert.equal(metadataCopies.length, 2);
  assert.ok(metadataCopies.every(item => item.CacheControl === 'public, max-age=31536000, immutable'));
  const user = JSON.parse(fs.readFileSync(usersFile, 'utf8'))[0];
  assert.match(user.pendingCheckins[0].thumbnail, /_thumb\.webp$/);
});

test('presigns and commits JPEG derivatives when WebP encoding is unavailable', async () => {
  const signed = await api('/checkin/presign', { ext: 'jpg', locationId: 4 });
  const { main, thumbnail } = signed.body.data;
  assert.match(main.key, /_main\.jpg$/);
  assert.match(thumbnail.key, /_thumb\.jpg$/);
  assert.equal(main.contentType, 'image/jpeg');
  assert.equal(thumbnail.contentType, 'image/jpeg');
  heads.set(main.key, { headers: { 'content-length': '600000', 'content-type': 'image/jpeg' } });
  heads.set(thumbnail.key, { headers: { 'content-length': '60000', 'content-type': 'image/jpeg' } });

  const committed = await api('/checkin/commit', {
    key: main.key,
    size: 600000,
    thumbnailKey: thumbnail.key,
    thumbnailSize: 60000,
    mime: 'image/jpeg',
    locationId: 4
  });

  assert.equal(committed.response.status, 200);
  assert.match(committed.body.thumbnail, /_thumb\.jpg$/);
  assert.equal(metadataCopies.at(-1).ContentType, 'image/jpeg');
});

test('uses a temporary original to create review-quality derivatives on the server', async () => {
  const source = await sharp({
    create: { width: 2400, height: 1800, channels: 3, background: '#6a8f55' }
  }).jpeg({ quality: 95 }).toBuffer();
  const signed = await api('/checkin/fallback/presign', { ext: 'jpg', size: source.length, locationId: 5 });
  assert.equal(signed.response.status, 200);
  const target = signed.body.data;
  assert.match(target.key, /^checkin-temp\//);
  heads.set(target.key, { headers: { 'content-length': String(source.length), 'content-type': 'image/jpeg' } });
  bodies.set(target.key, source);

  const processed = await api('/checkin/fallback/process', { key: target.key, size: source.length, locationId: 5 });
  assert.equal(processed.response.status, 200);
  assert.match(processed.body.data.main.key, /_main\.webp$/);
  assert.match(processed.body.data.thumbnail.key, /_thumb\.webp$/);
  assert.ok(processed.body.data.main.size <= 2 * 1024 * 1024);
  assert.ok(processed.body.data.thumbnail.size <= 200 * 1024);
  assert.equal(heads.get(processed.body.data.main.key).headers['content-type'], 'image/webp');
});

test('rejects an oversized legacy upload even when the client reports a larger size', async () => {
  const key = 'checkin/901__photo-user/2/oversized.jpg';
  heads.set(key, { headers: { 'content-length': String(2 * 1024 * 1024 + 1), 'content-type': 'image/jpeg' } });
  const result = await api('/checkin/commit', { key, size: 3 * 1024 * 1024, locationId: 2 });
  assert.equal(result.response.status, 400);
  assert.match(result.body.message, /超过大小上限/);
});

test('rejects a missing thumbnail without accepting the review record', async () => {
  const key = 'checkin/901__photo-user/3/main_main.webp';
  heads.set(key, { headers: { 'content-length': '500000', 'content-type': 'image/webp' } });
  const result = await api('/checkin/commit', {
    key, size: 500000,
    thumbnailKey: 'checkin/901__photo-user/3/main_thumb.webp',
    thumbnailSize: 50000,
    mime: 'image/webp',
    locationId: 3
  });
  assert.equal(result.response.status, 400);
  assert.match(result.body.message, /缩略图不存在/);
});
