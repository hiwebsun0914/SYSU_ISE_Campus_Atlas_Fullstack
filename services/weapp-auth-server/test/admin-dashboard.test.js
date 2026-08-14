const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const test = require('node:test');
const express = require('express');
const jwt = require('jsonwebtoken');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-dashboard-test-'));
const usersFile = path.join(testDir, 'users.json');
const submissionsFile = path.join(testDir, 'submissions.json');
const feedbackFile = path.join(testDir, 'feedback.json');
const bottlesFile = path.join(testDir, 'bottles.json');
const locationSettingsFile = path.join(testDir, 'location-settings.json');
const jwtSecret = 'admin-dashboard-test-secret-with-sufficient-length';
const now = Date.now();

const users = [
  {
    id: 1,
    username: 'campus-owner',
    role: 'visitor',
    points: 0,
    unlockedLocations: [],
    lockingLocations: [],
    completedRoutes: [],
    checkinRecords: []
  },
  {
    id: 2,
    username: 'reviewer',
    role: 'admin',
    points: 0,
    unlockedLocations: [],
    lockingLocations: [],
    completedRoutes: [],
    checkinRecords: []
  },
  {
    id: 3,
    username: 'student',
    realName: '林同学',
    studentId: '23300003',
    role: 'visitor',
    points: 0,
    unlockedLocations: [1],
    lockingLocations: [2, 3],
    completedRoutes: [],
    pendingCheckins: [
      {
        locationId: 2,
        photo: 'https://example.com/checkin.jpg',
        submittedAt: now - 72 * 60 * 60 * 1000,
        pointsDeferred: true
      },
      {
        locationId: 3,
        photo: 'https://example.com/reject.jpg',
        submittedAt: now - 30 * 60 * 1000,
        pointsDeferred: true
      }
    ],
    checkinRecords: [
      { locationId: 1, distance: 360, method: 'geo', time: new Date(now - 60 * 60 * 1000).toISOString() },
      { locationId: 1, distance: 20, method: 'geo', time: new Date(now - 30 * 60 * 1000).toISOString() }
    ]
  }
];

const submissions = [
  {
    id: 'submission-1',
    category: 'creative',
    categoryName: '最佳创意奖',
    title: '红砖与树影',
    description: '校园摄影作品。',
    locationId: 1,
    locationName: '何尔达屋',
    images: [{ url: 'https://example.com/work.jpg' }],
    userId: 3,
    username: 'student',
    status: 'pending',
    featured: false,
    votes: [],
    createdAt: now,
    updatedAt: now
  }
];

const feedback = [
  {
    id: 'feedback-1',
    userId: 3,
    username: 'student',
    category: 'bug',
    categoryName: '问题反馈',
    content: '地图上的地点无法打开。',
    contact: 'student-wechat',
    images: [{ key: 'feedback/3/example.png', url: 'https://example.com/feedback.png' }],
    status: 'submitted',
    reply: '',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'feedback-2',
    userId: 3,
    username: 'student',
    category: 'suggestion',
    categoryName: '功能建议',
    content: '希望增加路线收藏功能。',
    contact: 'student-wechat',
    status: 'resolved',
    reply: '已记录。',
    createdAt: now - 1000,
    updatedAt: now - 500
  }
];

fs.writeFileSync(usersFile, JSON.stringify(users), 'utf8');
fs.writeFileSync(submissionsFile, JSON.stringify(submissions), 'utf8');
fs.writeFileSync(feedbackFile, JSON.stringify(feedback), 'utf8');
fs.writeFileSync(bottlesFile, '[]', 'utf8');

process.env.USERS_FILE = usersFile;
process.env.SUBMISSIONS_FILE = submissionsFile;
process.env.FEEDBACK_FILE = feedbackFile;
process.env.BOTTLES_FILE = bottlesFile;
process.env.LOCATION_SETTINGS_FILE = locationSettingsFile;
process.env.JWT_SECRET = jwtSecret;
process.env.ADMIN_OWNER_IDS = '1';
process.env.ADMIN_OWNER_USERNAMES = '';
process.env.CHECKIN_ANOMALY_DISTANCE_M = '200';
process.env.CHECKIN_PENDING_STALE_HOURS = '48';

const adminRouter = require('../routes/admin');
const checkinRouter = require('../routes/checkin');
const app = express();
app.use(express.json({ limit: '64kb' }));
app.use('/admin', adminRouter);
app.use('/checkin', checkinRouter);

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
  if (resolved.startsWith(path.resolve(os.tmpdir()))) fs.rmSync(resolved, { recursive: true, force: true });
});

test('keeps visitor accounts outside the administrator space', async () => {
  const result = await api(3, '/admin/dashboard');
  assert.equal(result.response.status, 403);
  assert.equal(result.body.code, 1);
});

test('returns real dashboard totals, activity, hotspots and anomaly signals', async () => {
  const result = await api(2, '/admin/dashboard');
  assert.equal(result.response.status, 200);
  assert.equal(result.body.code, 0);
  assert.equal(result.body.data.currentAdmin.role, 'admin');
  assert.equal(result.body.data.metrics.userCount, 3);
  assert.equal(result.body.data.metrics.pendingCheckins, 2);
  assert.equal(result.body.data.metrics.pendingSubmissions, 1);
  assert.equal(result.body.data.metrics.pendingFeedback, 1);
  assert.equal(result.body.data.metrics.pendingTotal, 4);
  assert.equal(result.body.data.activity.length, 7);
  assert.equal(result.body.data.hotspots[0].locationId, 1);
  assert.ok(result.body.data.metrics.anomalyCount >= 3);
});

test('lets administrators receive and resolve user feedback', async () => {
  const forbidden = await api(3, '/admin/feedback');
  assert.equal(forbidden.response.status, 403);

  const received = await api(2, '/admin/feedback?status=submitted');
  assert.equal(received.response.status, 200);
  assert.equal(received.body.list.length, 1);
  assert.equal(received.body.list[0].id, 'feedback-1');
  assert.equal(received.body.list[0].contact, 'student-wechat');
  assert.equal(received.body.list[0].images.length, 1);

  const resolved = await api(2, '/admin/feedback/feedback-1', {
    method: 'PATCH',
    body: JSON.stringify({ status: 'resolved', reply: '问题已修复，请重新打开地图。' })
  });
  assert.equal(resolved.response.status, 200);
  assert.equal(resolved.body.data.feedback.status, 'resolved');
  assert.equal(resolved.body.data.feedback.handledBy, 'reviewer');

  const dashboard = await api(2, '/admin/dashboard');
  assert.equal(dashboard.body.data.metrics.pendingFeedback, 0);
});

test('only a protected owner can grant and revoke reviewer access', async () => {
  const forbidden = await api(2, '/admin/users/3/role', {
    method: 'PATCH',
    body: JSON.stringify({ role: 'admin' })
  });
  assert.equal(forbidden.response.status, 403);

  const granted = await api(1, '/admin/users/3/role', {
    method: 'PATCH',
    body: JSON.stringify({ role: 'admin' })
  });
  assert.equal(granted.response.status, 200);
  assert.equal(granted.body.data.role, 'admin');

  const revoked = await api(1, '/admin/users/3/role', {
    method: 'PATCH',
    body: JSON.stringify({ role: 'visitor' })
  });
  assert.equal(revoked.response.status, 200);
  assert.equal(revoked.body.data.role, 'visitor');
});

test('persists checkpoint content and point settings', async () => {
  const updated = await api(2, '/admin/locations/2', {
    method: 'PATCH',
    body: JSON.stringify({
      name: '高利士屋 · 测试',
      position: '南校园 313 号',
      points: 7,
      description: '<p>测试介绍</p><script>alert(1)</script>'
    })
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.data.location.points, 7);
  assert.equal(updated.body.data.location.name, '高利士屋 · 测试');
  assert.equal(updated.body.data.location.description.includes('<script>'), false);

  const list = await api(2, '/admin/locations?query=%E9%AB%98%E5%88%A9%E5%A3%AB');
  assert.equal(list.body.list.length, 1);
  assert.equal(list.body.list[0].points, 7);
});

test('uses configured checkpoint points when approving a photo check-in', async () => {
  const approved = await api(2, '/admin/checkins/3_2/approve', {
    method: 'POST',
    body: JSON.stringify({ note: '照片可清楚识别建筑。' })
  });
  assert.equal(approved.response.status, 200);
  assert.equal(approved.body.data.pointsAwarded, 7);
  assert.equal(approved.body.data.points, 7);

  const storedUsers = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
  const student = storedUsers.find(user => user.id === 3);
  assert.equal(student.lockingLocations.includes(2), false);
  assert.equal(student.lockingLocations.includes(3), true);
  assert.ok(student.unlockedLocations.includes(2));
  assert.equal(student.checkinReviewRecords.at(-1).status, 'approved');
});

test('rejects a pending photo and keeps the review reason', async () => {
  const rejected = await api(2, '/admin/checkins/3_3/reject', {
    method: 'POST',
    body: JSON.stringify({ note: '照片无法识别建筑特征。' })
  });
  assert.equal(rejected.response.status, 200);
  assert.equal(rejected.body.code, 0);

  const storedUsers = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
  const student = storedUsers.find(user => user.id === 3);
  assert.equal(student.lockingLocations.includes(3), false);
  assert.equal(student.pendingCheckins.some(item => Number(item.locationId) === 3), false);
  assert.equal(student.checkinReviewRecords.at(-1).status, 'rejected');
  assert.equal(student.checkinReviewRecords.at(-1).note, '照片无法识别建筑特征。');
  assert.equal(student.checkinReviewRecords.at(-1).photo, 'https://example.com/reject.jpg');
});

test('blocks repeat check-ins during review and supports rejected-photo appeals', async () => {
  const appealed = await api(3, '/checkin/appeal', {
    method: 'POST',
    body: JSON.stringify({ locationId: 3, reason: '照片右侧可以清楚看到建筑门牌，请重新核对。' })
  });
  assert.equal(appealed.response.status, 200);
  assert.equal(appealed.body.data.appealStatus, 'pending');

  const duplicateMapCheckin = await api(3, '/checkin/map', {
    method: 'POST',
    body: JSON.stringify({ locationId: 3, distance: 5, method: 'geo' })
  });
  assert.equal(duplicateMapCheckin.response.status, 409);
  assert.equal(duplicateMapCheckin.body.errorCode, 'CHECKIN_REVIEW_PENDING');

  const appealQueue = await api(2, '/admin/checkins?status=appealed');
  assert.equal(appealQueue.response.status, 200);
  assert.equal(appealQueue.body.list.length, 1);
  assert.equal(appealQueue.body.list[0].status, 'appealed');
  assert.match(appealQueue.body.list[0].appealReason, /门牌/);

  const approved = await api(2, '/admin/checkins/3_3/approve', {
    method: 'POST',
    body: JSON.stringify({ note: '申诉复核通过。' })
  });
  assert.equal(approved.response.status, 200);
  assert.equal(approved.body.data.pointsAwarded, 1);

  const rejectedQueue = await api(2, '/admin/checkins?status=rejected');
  assert.equal(rejectedQueue.response.status, 200);
  assert.equal(rejectedQueue.body.list.length, 0);
});

test('marks only approved submissions as featured and supports toggling', async () => {
  const blocked = await api(2, '/admin/submissions/submission-1/feature', {
    method: 'POST',
    body: JSON.stringify({ featured: true })
  });
  assert.equal(blocked.response.status, 400);

  const approved = await api(2, '/admin/submissions/submission-1/approve', {
    method: 'POST',
    body: JSON.stringify({})
  });
  assert.equal(approved.response.status, 200);
  assert.equal(approved.body.code, 0);

  const featured = await api(2, '/admin/submissions/submission-1/feature', {
    method: 'POST',
    body: JSON.stringify({ featured: true })
  });
  assert.equal(featured.response.status, 200);
  assert.equal(featured.body.featured, true);

  const unfeatured = await api(2, '/admin/submissions/submission-1/feature', {
    method: 'POST',
    body: JSON.stringify({ featured: false })
  });
  assert.equal(unfeatured.response.status, 200);
  assert.equal(unfeatured.body.featured, false);
});
