const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const test = require('node:test');
const jwt = require('jsonwebtoken');
const COS = require('cos-nodejs-sdk-v5');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'checkin-upload-test-'));
const usersFile = path.join(testDir, 'users.json');
const jwtSecret = 'checkin-upload-test-secret-with-sufficient-length';
const heads = new Map();
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
