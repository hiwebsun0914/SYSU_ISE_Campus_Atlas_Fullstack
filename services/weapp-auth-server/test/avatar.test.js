const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const test = require('node:test');
const jwt = require('jsonwebtoken');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avatar-test-'));
const usersFile = path.join(testDir, 'users.json');
const jwtSecret = 'avatar-test-secret-with-sufficient-length';
const cosSecretId = 'fake-avatar-secret-id';
const cosSecretKey = 'fake-avatar-secret-key';

fs.writeFileSync(usersFile, JSON.stringify([{
  id: 101,
  username: '头像测试用户',
  avatar: '',
  role: 'visitor'
}]), 'utf8');

process.env.USERS_FILE = usersFile;
process.env.JWT_SECRET = jwtSecret;
process.env.PORT = '0';
process.env.DEV_BYPASS_AUTH = 'false';
process.env.COS_BUCKET = 'avatar-test-1234567890';
process.env.COS_REGION = 'ap-guangzhou';
process.env.TENCENT_SECRET_ID = cosSecretId;
process.env.TENCENT_SECRET_KEY = cosSecretKey;

const app = require('../app');
const server = app.listen(0, '127.0.0.1');
const token = jwt.sign({ id: 101 }, jwtSecret, { expiresIn: '5m' });
let baseUrl = '';

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
  if (resolved.startsWith(path.resolve(os.tmpdir()))) {
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});

test('creates a scoped avatar upload URL without exposing the server secret key', async () => {
  const response = await fetch(`${baseUrl}/avatar/presign`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ext: 'png' })
  });
  const body = await response.json();
  const serialized = JSON.stringify(body);

  assert.equal(response.status, 200);
  assert.equal(body.code, 0);
  assert.match(body.data.key, /^UserImage\/101\/\d+_[a-z0-9]+\.png$/);
  assert.match(body.data.putUrl, /^https:\/\//);
  assert.ok(decodeURI(body.data.putUrl).includes(`/${body.data.key}`));
  assert.ok(body.data.putUrl.includes(encodeURIComponent(cosSecretId)) || body.data.putUrl.includes(cosSecretId));
  assert.equal(serialized.includes(cosSecretKey), false);
});
