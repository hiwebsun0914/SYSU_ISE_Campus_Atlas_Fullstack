const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const test = require('node:test');
const jwt = require('jsonwebtoken');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'profile-test-'));
const usersFile = path.join(testDir, 'users.json');
const feedbackFile = path.join(testDir, 'feedback.json');
const jwtSecret = 'profile-test-secret-with-sufficient-length';
const users = [
  {
    id: 101,
    username: '岭南同学',
    realName: '林同学',
    studentId: '',
    phone: '',
    bio: '',
    avatar: 'https://example.com/avatar-a.png',
    role: 'visitor',
    points: 7,
    unlockedLocations: [1, 12],
    lockingLocations: [],
    completedRoutes: [],
    checkinRecords: [],
    personality: null,
    createdAt: 1,
    updatedAt: 1
  },
  {
    id: 202,
    username: '康乐同学',
    realName: '',
    studentId: '23300002',
    phone: '',
    bio: '',
    avatar: '',
    role: 'visitor',
    points: 0,
    unlockedLocations: [],
    lockingLocations: [],
    completedRoutes: [],
    checkinRecords: [],
    personality: null,
    createdAt: 1,
    updatedAt: 1
  }
];

fs.writeFileSync(usersFile, JSON.stringify(users), 'utf8');
fs.writeFileSync(feedbackFile, '[]', 'utf8');
process.env.USERS_FILE = usersFile;
process.env.FEEDBACK_FILE = feedbackFile;
process.env.JWT_SECRET = jwtSecret;
process.env.PORT = '0';
process.env.DEV_BYPASS_AUTH = 'false';
process.env.ADMIN_OWNER_IDS = '101';

const app = require('../app');
const server = app.listen(0, '127.0.0.1');
let baseUrl = '';
const tokens = Object.fromEntries(users.map(user => [
  user.id,
  jwt.sign({ id: user.id }, jwtSecret, { expiresIn: '5m' })
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
  if (resolved.startsWith(path.resolve(os.tmpdir()))) {
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});

test('auth/me exposes the complete personal-home contract', async () => {
  const result = await api(101, '/auth/me');
  assert.equal(result.response.status, 200);
  assert.equal(result.body.code, 0);
  assert.equal(result.body.userInfo.realName, '林同学');
  assert.equal(result.body.userInfo.studentId, '');
  assert.equal(result.body.userInfo.bio, '');
  assert.equal(result.body.userInfo.personality, null);
  assert.equal(result.body.userInfo.role, 'owner');
  assert.equal(result.body.userInfo.points, 7);
  assert.deepEqual(result.body.userInfo.unlockedLocations, [1, 12]);
});

test('updates editable profile fields and rejects duplicate identifiers', async () => {
  const updated = await api(101, '/user/profile', {
    method: 'PUT',
    body: JSON.stringify({
      username: '逸仙同学',
      studentId: '23300001',
      phone: '138 0000 0000',
      bio: '正在收集康乐园的建筑与故事。',
      avatar: 'https://example.com/avatar-new.png'
    })
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.data.userInfo.studentId, '23300001');
  assert.equal(updated.body.data.userInfo.role, 'owner');

  const me = await api(101, '/auth/me');
  assert.equal(me.body.userInfo.username, '逸仙同学');
  assert.equal(me.body.userInfo.bio, '正在收集康乐园的建筑与故事。');
  assert.equal(me.body.userInfo.avatar, 'https://example.com/avatar-new.png');

  const lockedRealName = await api(101, '/user/profile', {
    method: 'PUT',
    body: JSON.stringify({ realName: '林逸仙' })
  });
  assert.equal(lockedRealName.response.status, 400);
  assert.equal(lockedRealName.body.errorCode, 'REAL_NAME_LOCKED');

  const unchangedRealName = await api(101, '/user/profile', {
    method: 'PUT',
    body: JSON.stringify({ realName: '林同学', bio: '姓名保持不变时，其他资料仍可保存。' })
  });
  assert.equal(unchangedRealName.response.status, 200);
  assert.equal(unchangedRealName.body.data.userInfo.realName, '林同学');

  const duplicateStudentId = await api(101, '/user/profile', {
    method: 'PUT',
    body: JSON.stringify({ studentId: '23300002' })
  });
  assert.equal(duplicateStudentId.response.status, 400);
  assert.equal(duplicateStudentId.body.errorCode, 'STUDENT_ID_TAKEN');

  const unsafeAvatar = await api(101, '/user/profile', {
    method: 'PUT',
    body: JSON.stringify({ avatar: 'javascript:alert(1)' })
  });
  assert.equal(unsafeAvatar.response.status, 400);
  assert.equal(unsafeAvatar.body.field, 'avatar');

  const tooLongName = await api(101, '/user/profile', {
    method: 'PUT',
    body: JSON.stringify({ username: '这是一条超过二十四个字符且不应被静默截断的用户昵称' })
  });
  assert.equal(tooLongName.response.status, 400);
  assert.equal(tooLongName.body.field, 'username');
});

test('persists the PLACE result as the ISETI personality shown on the profile', async () => {
  const invalid = await api(101, '/user/personality', {
    method: 'PUT',
    body: JSON.stringify({ mainCode: 'NOPE', subCode: 'TREE', placeId: 12 })
  });
  assert.equal(invalid.response.status, 400);
  assert.equal(invalid.body.errorCode, 'PERSONALITY_INVALID');

  const saved = await api(101, '/user/personality', {
    method: 'PUT',
    body: JSON.stringify({
      mainCode: 'GROW',
      subCode: 'WIKI',
      badges: ['aiVerifier', 'photoKeeper', 'not-real'],
      placeId: 12,
      placeName: '图书馆',
      line: '从校园故事继续向前。',
      task: '找到一个年份并记录下来。'
    })
  });
  assert.equal(saved.response.status, 200);
  assert.equal(saved.body.data.personality.mainName, '长期积累型');
  assert.equal(saved.body.data.personality.subName, '维基百科型');
  assert.deepEqual(saved.body.data.personality.badges.map(item => item.code), ['aiVerifier', 'photoKeeper']);

  const latest = await api(101, '/user/personality', {
    method: 'PUT',
    body: JSON.stringify({
      mainCode: 'SYNC',
      subCode: 'STAY',
      badges: ['groupStarter']
    })
  });
  assert.equal(latest.response.status, 200);
  assert.equal(latest.body.data.personality.mainName, '同伴同行型');
  assert.equal(latest.body.data.personality.subName, '慢节奏停留型');

  const me = await api(101, '/auth/me');
  assert.equal(me.body.userInfo.personality.testId, 'PLACE');
  assert.equal(me.body.userInfo.personality.version, 2);
  assert.equal(me.body.userInfo.personality.mainCode, 'SYNC');
  assert.equal(me.body.userInfo.personality.subCode, 'STAY');
  assert.equal(me.body.userInfo.personality.placeId, null);
});

test('submits feedback and keeps each user history private', async () => {
  const tooShort = await api(101, '/feedback', {
    method: 'POST',
    body: JSON.stringify({ category: 'bug', content: '卡顿' })
  });
  assert.equal(tooShort.response.status, 400);
  assert.equal(tooShort.body.errorCode, 'FEEDBACK_CONTENT_SHORT');

  const missingContact = await api(101, '/feedback', {
    method: 'POST',
    body: JSON.stringify({ category: 'bug', content: '页面按钮无法点击' })
  });
  assert.equal(missingContact.response.status, 400);
  assert.equal(missingContact.body.errorCode, 'FEEDBACK_CONTACT_REQUIRED');

  const created = await api(101, '/feedback', {
    method: 'POST',
    body: JSON.stringify({
      category: 'suggestion',
      content: '希望图鉴支持按建筑年代筛选。',
      contact: 'sysu_student_wechat'
    })
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.data.feedback.status, 'submitted');

  const mine = await api(101, '/feedback/mine');
  assert.equal(mine.body.list.length, 1);
  assert.equal(mine.body.list[0].categoryName, '功能建议');

  const otherMine = await api(202, '/feedback/mine');
  assert.equal(otherMine.body.list.length, 0);
});

test('does not replace corrupted feedback storage', async () => {
  const corrupted = '{not-json';
  fs.writeFileSync(feedbackFile, corrupted, 'utf8');
  const result = await api(101, '/feedback/mine');
  assert.equal(result.response.status, 503);
  assert.equal(result.body.errorCode, 'FEEDBACK_STORE_UNAVAILABLE');
  assert.equal(fs.readFileSync(feedbackFile, 'utf8'), corrupted);
});
