// routes/admin.js
require('dotenv').config();

const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const COS = require('cos-nodejs-sdk-v5');
const auth = require('../middleware/auth');
const routes = require('../data/routes');
const { effectiveRole, isAdminRole, canManageRoles, isConfiguredOwner } = require('../lib/roles');
const { getLocations, getLocation, updateLocation } = require('../lib/locationSettings');
const { deferLegacyPendingPoints } = require('../lib/checkinPoints');
const { readFeedback, writeFeedback } = require('../lib/feedbackStore');

// ====== 常量 / 配置 ======
const USERS_FILE = path.resolve(process.env.USERS_FILE || path.join(__dirname, '..', 'users.json'));
const DEFAULT_AVATAR = 'https://img.yzcdn.cn/vant/user-active.png';
const DEFAULT_ROLE   = 'visitor';

const {
  COS_BUCKET,
  COS_REGION,
  TENCENT_SECRET_ID,
  TENCENT_SECRET_KEY,
  PUBLIC_ASSET_DOMAIN
} = process.env;

// COS 客户端（没有密钥也能跑，只是取不了目录最新图片）
const cos = (TENCENT_SECRET_ID && TENCENT_SECRET_KEY)
  ? new COS({ SecretId: TENCENT_SECRET_ID, SecretKey: TENCENT_SECRET_KEY })
  : null;

const toUrl = (key) => {
  const base = PUBLIC_ASSET_DOMAIN ||
               (COS_BUCKET && COS_REGION ? `https://${COS_BUCKET}.cos.${COS_REGION}.myqcloud.com` : '');
  return base ? `${base}/${encodeURI(key)}` : '';
};

const safeSlug = (s = '') =>
  String(s).trim().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '')
    .slice(0, 40);

// ====== 文件工具（健壮）======
function ensureFile(fp, init = '[]') {
  try { if (!fs.existsSync(fp)) fs.writeFileSync(fp, init, 'utf8'); } catch {}
}

// 读取 users.json（始终返回数组）
function readUsers() {
  ensureFile(USERS_FILE, '[]');
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf8') || '[]';
    const arr = JSON.parse(raw);
    const users = Array.isArray(arr) ? arr : [];
    if (deferLegacyPendingPoints(users)) {
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    }
    return users.map(u => ({
      ...u,
      role: u.role || DEFAULT_ROLE,
      avatar: u.avatar || DEFAULT_AVATAR,
      username: u.username || '未命名',
      unlockedLocations: Array.isArray(u.unlockedLocations) ? u.unlockedLocations : [],
      lockingLocations : Array.isArray(u.lockingLocations)  ? u.lockingLocations  : [],
      completedRoutes  : Array.isArray(u.completedRoutes)   ? u.completedRoutes   : [],
      checkinRecords   : Array.isArray(u.checkinRecords)    ? u.checkinRecords    : [],
      pendingCheckins  : Array.isArray(u.pendingCheckins)   ? u.pendingCheckins   : [],
      checkinReviewRecords: Array.isArray(u.checkinReviewRecords) ? u.checkinReviewRecords : [],
      points: Number.isFinite(Number(u.points)) ? Number(u.points) : 0,
    }));
  } catch (e) {
    console.error('[admin] readUsers fail:', e);
    return [];
  }
}

function writeUsers(list) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (e) {
    console.error('[admin] writeUsers fail:', e);
  }
}

// ====== 权限：管理员 ======
function adminOnly(req, res, next) {
  const users = readUsers();
  const me = users.find(u => String(u.id) === String(req.userId));
  if (!me) return res.status(401).json({ code: 1, message: '未登录' });
  const role = effectiveRole(me);
  if (!isAdminRole(role)) {
    return res.status(403).json({ code: 1, message: '无管理员权限' });
  }
  req.role = role;
  req.adminUser = me;
  next();
}

function ownerOnly(req, res, next) {
  if (!canManageRoles(req.role)) {
    return res.status(403).json({ code: 1, message: '仅超级管理员可以调整管理员权限' });
  }
  next();
}

// ====== COS：列目录，找最新一张图 ======
function listLatestPhoto(uid, username, locationId) {
  return new Promise((resolve) => {
    if (!cos || !COS_BUCKET || !COS_REGION) {
      return resolve(null); // 无法列目录
    }
    const prefix = `checkin/${uid}__${safeSlug(username)}/${locationId}/`;
    cos.getBucket(
      { Bucket: COS_BUCKET, Region: COS_REGION, Prefix: prefix, MaxKeys: 1000 },
      (err, data) => {
        if (err || !data || !Array.isArray(data.Contents)) return resolve(null);
        const files = data.Contents.filter(obj => obj && obj.Key && !obj.Key.endsWith('/'));
        if (!files.length) return resolve(null);
        files.sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified));
        const latest = files[0];
        resolve({
          key: latest.Key,
          url: toUrl(latest.Key),
          uploadTime: Date.parse(latest.LastModified) || Date.now()
        });
      }
    );
  });
}

// ====== 用户列表（含打卡统计） ======
// GET /admin/users
router.get('/users', auth, adminOnly, (req, res) => {
  const users = readUsers();

  const list = users.map(u => {
    return {
      id: u.id,
      username: u.username,
      realName: u.realName || '',
      studentId: u.studentId || '',
      role: effectiveRole(u),
      avatar: u.avatar,
      unlocked: u.unlockedLocations.length,
      locking : u.lockingLocations.length,
      points: u.points,
      protectedOwner: isConfiguredOwner(u) || String(u.role || '') === 'owner',
      createdAt: u.createdAt || null,
      updatedAt: u.updatedAt || null
    };
  });

  res.json({ code: 0, list, canManageRoles: canManageRoles(req.role) });
});

// PATCH /admin/users/:id/role  { role: 'visitor' | 'admin' }
router.patch('/users/:id/role', auth, adminOnly, ownerOnly, (req, res) => {
  const role = String(req.body?.role || '').trim();
  if (!['visitor', 'admin'].includes(role)) {
    return res.status(400).json({ code: 1, message: '角色只能设置为普通用户或审核员' });
  }

  const users = readUsers();
  const target = users.find(user => String(user.id) === String(req.params.id));
  if (!target) return res.status(404).json({ code: 1, message: '用户不存在' });
  if (String(target.id) === String(req.userId)) {
    return res.status(400).json({ code: 1, message: '不能修改自己的权限' });
  }
  if (isConfiguredOwner(target) || String(target.role || '') === 'owner') {
    return res.status(400).json({ code: 1, message: '不能修改受保护的超级管理员' });
  }

  target.role = role;
  target.updatedAt = Date.now();
  writeUsers(users);
  return res.json({
    code: 0,
    message: role === 'admin' ? '已授予审核员权限' : '已撤销审核员权限',
    data: { id: target.id, role }
  });
});

// DELETE /admin/users/:id —— 仅超级管理员；删除账号，并清理其投稿、投票与反馈
router.delete('/users/:id', auth, adminOnly, ownerOnly, (req, res) => {
  const users = readUsers();
  const target = users.find(user => String(user.id) === String(req.params.id));
  if (!target) return res.status(404).json({ code: 1, message: '用户不存在' });
  if (String(target.id) === String(req.userId)) {
    return res.status(400).json({ code: 1, message: '不能删除自己的账号' });
  }
  if (isConfiguredOwner(target) || String(target.role || '') === 'owner') {
    return res.status(400).json({ code: 1, message: '不能删除受保护的超级管理员' });
  }

  writeUsers(users.filter(user => String(user.id) !== String(target.id)));

  // 清理投稿：删除该用户的投稿，并移除其在他人投稿中的投票
  let removedSubmissions = 0;
  try {
    const list = readSubmissionsArray();
    const kept = list.filter(item => {
      const own = String(item.userId) === String(target.id);
      if (own) removedSubmissions += 1;
      return !own;
    });
    let votesChanged = false;
    kept.forEach(item => {
      if (!Array.isArray(item.votes)) return;
      const filtered = item.votes.filter(vote => String(vote && vote.userId) !== String(target.id));
      if (filtered.length !== item.votes.length) {
        item.votes = filtered;
        votesChanged = true;
      }
    });
    if (removedSubmissions || votesChanged) writeSubmissionsArray(kept);
  } catch (error) {
    console.error('[DELETE /admin/users/:id] cleanup submissions fail:', error);
  }

  // 清理该用户提交的问题反馈
  let removedFeedback = 0;
  try {
    const feedback = readFeedback();
    const keptFeedback = feedback.filter(item => {
      const own = String(item.userId) === String(target.id);
      if (own) removedFeedback += 1;
      return !own;
    });
    if (removedFeedback) writeFeedback(keptFeedback);
  } catch (error) {
    console.error('[DELETE /admin/users/:id] cleanup feedback fail:', error);
  }

  return res.json({
    code: 0,
    message: `已删除账号「${target.username || target.id}」`,
    data: { id: target.id, removedSubmissions, removedFeedback }
  });
});

function timestampOf(value) {
  const parsed = typeof value === 'number' ? value : Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function beijingDay(value) {
  const timestamp = timestampOf(value);
  if (!timestamp) return '';
  return new Date(timestamp + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function buildActivity(users, days = 7) {
  const now = Date.now();
  const rows = [];
  const byDay = new Map();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const timestamp = now - offset * 24 * 60 * 60 * 1000;
    const date = beijingDay(timestamp);
    const row = { date, label: date.slice(5), count: 0 };
    rows.push(row);
    byDay.set(date, row);
  }

  users.forEach(user => {
    user.checkinRecords.forEach(record => {
      const row = byDay.get(beijingDay(record.time || record.createdAt));
      if (row) row.count += 1;
    });
  });
  return rows;
}

function buildHotspots(users, limit = 8) {
  const counts = new Map();
  users.forEach(user => {
    new Set(user.unlockedLocations.map(Number)).forEach(locationId => {
      if (Number.isInteger(locationId)) counts.set(locationId, (counts.get(locationId) || 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .map(([locationId, count]) => {
      const location = getLocation(locationId);
      return {
        locationId,
        name: location?.name || `未知地点 #${locationId}`,
        count,
        points: location?.points ?? 1
      };
    })
    .sort((a, b) => b.count - a.count || a.locationId - b.locationId)
    .slice(0, limit);
}

function buildAnomalies(users) {
  const anomalies = [];
  const distanceLimit = Math.max(1, Number(process.env.CHECKIN_ANOMALY_DISTANCE_M || 200));
  const staleLimit = Math.max(1, Number(process.env.CHECKIN_PENDING_STALE_HOURS || 48)) * 60 * 60 * 1000;
  const now = Date.now();

  users.forEach(user => {
    const duplicateKeys = new Set();
    const seen = new Map();

    user.checkinRecords.forEach((record, index) => {
      const locationId = Number(record.locationId);
      const location = getLocation(locationId);
      const occurredAt = timestampOf(record.time || record.createdAt);
      const distance = Number(record.distance);

      if (!location) {
        anomalies.push({
          id: `unknown-${user.id}-${locationId}-${index}`,
          type: 'unknown_location',
          severity: 'high',
          userId: user.id,
          username: user.username,
          locationId,
          locationName: `未知地点 #${locationId}`,
          title: '打卡点编号不存在',
          detail: '记录引用了当前地点库中不存在的编号，需要人工核对。',
          occurredAt
        });
      }

      if (Number.isFinite(distance) && distance > distanceLimit) {
        anomalies.push({
          id: `distance-${user.id}-${locationId}-${index}`,
          type: 'distance',
          severity: distance > distanceLimit * 2 ? 'high' : 'medium',
          userId: user.id,
          username: user.username,
          locationId,
          locationName: location?.name || `#${locationId}`,
          title: '定位距离超出阈值',
          detail: `记录距离为 ${Math.round(distance)} 米，当前阈值为 ${Math.round(distanceLimit)} 米。`,
          occurredAt
        });
      }

      const day = beijingDay(occurredAt);
      if (day) {
        const duplicateKey = `${locationId}-${day}`;
        const count = (seen.get(duplicateKey) || 0) + 1;
        seen.set(duplicateKey, count);
        if (count > 1 && !duplicateKeys.has(duplicateKey)) {
          duplicateKeys.add(duplicateKey);
          anomalies.push({
            id: `duplicate-${user.id}-${duplicateKey}`,
            type: 'duplicate',
            severity: 'medium',
            userId: user.id,
            username: user.username,
            locationId,
            locationName: location?.name || `#${locationId}`,
            title: '同日重复打卡',
            detail: `${day} 在同一地点出现多条成功记录。`,
            occurredAt
          });
        }
      }
    });

    user.pendingCheckins.forEach((pending, index) => {
      const submittedAt = timestampOf(pending.submittedAt || pending.createdAt);
      if (!submittedAt || now - submittedAt <= staleLimit) return;
      const locationId = Number(pending.locationId);
      const location = getLocation(locationId);
      anomalies.push({
        id: `stale-${user.id}-${locationId}-${index}`,
        type: 'stale_pending',
        severity: 'low',
        userId: user.id,
        username: user.username,
        locationId,
        locationName: location?.name || `#${locationId}`,
        title: '打卡等待审核过久',
        detail: `已等待超过 ${Math.round(staleLimit / 3600000)} 小时。`,
        occurredAt: submittedAt
      });
    });
  });

  return anomalies.sort((a, b) => {
    const priority = { high: 3, medium: 2, low: 1 };
    return (priority[b.severity] || 0) - (priority[a.severity] || 0) || b.occurredAt - a.occurredAt;
  });
}

// GET /admin/dashboard
router.get('/dashboard', auth, adminOnly, (req, res) => {
  const users = readUsers();
  const submissions = readSubmissionsArray();
  const feedback = readFeedback();
  const anomalies = buildAnomalies(users);
  const pendingCheckins = users.reduce((sum, user) => sum + user.lockingLocations.length, 0);
  const pendingSubmissions = submissions.filter(item =>
    item.status === 'pending' || (item.status === 'rejected' && item.appealStatus === 'pending')
  ).length;
  const pendingFeedback = feedback.filter(item => !['resolved', 'closed'].includes(item.status)).length;

  return res.json({
    code: 0,
    data: {
      currentAdmin: {
        id: req.adminUser.id,
        username: req.adminUser.username,
        avatar: req.adminUser.avatar,
        role: req.role,
        canManageRoles: canManageRoles(req.role)
      },
      metrics: {
        pendingTotal: pendingCheckins + pendingSubmissions + pendingFeedback,
        pendingCheckins,
        pendingSubmissions,
        pendingFeedback,
        userCount: users.length,
        submissionCount: submissions.length,
        checkinCount: users.reduce((sum, user) => sum + user.unlockedLocations.length, 0),
        anomalyCount: anomalies.length,
        featuredCount: submissions.filter(item => item.featured).length
      },
      activity: buildActivity(users),
      hotspots: buildHotspots(users),
      anomalyPreview: anomalies.slice(0, 5)
    }
  });
});

// GET /admin/feedback?status=submitted|in_progress|resolved|all
router.get('/feedback', auth, adminOnly, (req, res) => {
  try {
    const status = String(req.query.status || 'submitted');
    const allowed = new Set(['submitted', 'in_progress', 'resolved', 'closed', 'all']);
    if (!allowed.has(status)) return res.status(400).json({ code: 1, message: '无效的反馈状态' });

    const all = readFeedback();
    const list = (status === 'all' ? all : all.filter(item => (item.status || 'submitted') === status))
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    const stat = all.reduce((acc, item) => {
      const key = item.status || 'submitted';
      acc.all += 1;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, { all: 0, submitted: 0, in_progress: 0, resolved: 0, closed: 0 });
    return res.json({ code: 0, list, stat });
  } catch (error) {
    console.error('[GET /admin/feedback] error:', error);
    return res.status(503).json({ code: 1, message: '暂时无法读取问题反馈，请稍后重试。' });
  }
});

// PATCH /admin/feedback/:id { status, reply }
router.patch('/feedback/:id', auth, adminOnly, (req, res) => {
  try {
    const status = String(req.body?.status || '').trim();
    const reply = String(req.body?.reply || '').normalize('NFC').trim().slice(0, 1000);
    if (!['in_progress', 'resolved', 'closed'].includes(status)) {
      return res.status(400).json({ code: 1, message: '请选择有效的处理状态' });
    }
    if (status === 'resolved' && reply.length < 2) {
      return res.status(400).json({ code: 1, message: '解决反馈时请填写至少 2 个字符的回复' });
    }

    const list = readFeedback();
    const item = list.find(entry => String(entry.id) === String(req.params.id));
    if (!item) return res.status(404).json({ code: 1, message: '反馈不存在或已被删除' });
    item.status = status;
    item.reply = reply;
    item.updatedAt = Date.now();
    item.handledBy = req.adminUser.username || String(req.userId);
    writeFeedback(list);
    return res.json({ code: 0, message: '反馈处理状态已更新', data: { feedback: item } });
  } catch (error) {
    console.error('[PATCH /admin/feedback/:id] error:', error);
    return res.status(503).json({ code: 1, message: '暂时无法更新问题反馈，请稍后重试。' });
  }
});

// GET /admin/anomalies
router.get('/anomalies', auth, adminOnly, (req, res) => {
  const type = String(req.query.type || 'all');
  const all = buildAnomalies(readUsers());
  const list = type === 'all' ? all : all.filter(item => item.type === type);
  const stat = all.reduce((acc, item) => {
    acc.all += 1;
    acc[item.severity] = (acc[item.severity] || 0) + 1;
    return acc;
  }, { all: 0, high: 0, medium: 0, low: 0 });
  return res.json({ code: 0, list, stat });
});

// GET /admin/locations
router.get('/locations', auth, adminOnly, (req, res) => {
  const query = String(req.query.query || '').trim().toLowerCase();
  const all = getLocations();
  const list = query
    ? all.filter(item => `${item.id} ${item.name} ${item.position}`.toLowerCase().includes(query))
    : all;
  return res.json({ code: 0, list, total: all.length });
});

// PATCH /admin/locations/:id
router.patch('/locations/:id', auth, adminOnly, (req, res) => {
  try {
    const location = updateLocation(req.params.id, req.body || {});
    return res.json({ code: 0, message: '打卡点设置已保存', data: { location } });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ code: 1, message: error.message || '保存打卡点失败' });
  }
});

// ====== 打卡审核列表（待审、申诉、通过、驳回与全部） ======
// GET /admin/checkins?status=pending|appealed|approved|rejected|all
router.get('/checkins', auth, adminOnly, async (req, res) => {
  const statusQ = String(req.query.status || 'pending').toLowerCase();
  const allowed = new Set(['pending', 'appealed', 'approved', 'rejected', 'all']);
  if (!allowed.has(statusQ)) return res.status(400).json({ code: 1, message: '无效的审核状态' });
  const users = readUsers();

  // 活跃审核以 lockingLocations/pendingCheckins 为准；驳回历史来自审核记录。
  const tasks = [];
  for (const u of users) {
    const pendings  = Array.isArray(u.lockingLocations)  ? u.lockingLocations  : [];
    const approveds = Array.isArray(u.unlockedLocations) ? u.unlockedLocations : [];
    const latestRejected = new Map();
    [...u.checkinReviewRecords]
      .sort((a, b) => Number(b.reviewedAt || 0) - Number(a.reviewedAt || 0))
      .forEach(record => {
        const locId = Number(record.locationId);
        if (record.status === 'rejected' && !latestRejected.has(locId)) latestRejected.set(locId, record);
      });

    if (statusQ === 'pending' || statusQ === 'all') {
      pendings.forEach(locId => {
        const pending = u.pendingCheckins.find(item => Number(item.locationId) === Number(locId));
        if (pending?.appealStatus !== 'pending') tasks.push({ u, locId: Number(locId), status: 'pending', source: pending });
      });
    }
    if (statusQ === 'appealed' || statusQ === 'all') {
      pendings.forEach(locId => {
        const pending = u.pendingCheckins.find(item => Number(item.locationId) === Number(locId));
        if (pending?.appealStatus === 'pending') tasks.push({ u, locId: Number(locId), status: 'appealed', source: pending });
      });
    }
    if (statusQ === 'approved' || statusQ === 'all') {
      approveds.forEach(locId => tasks.push({ u, locId: Number(locId), status: 'approved' }));
    }
    if (statusQ === 'rejected' || statusQ === 'all') {
      latestRejected.forEach((record, locId) => {
        if (!pendings.map(Number).includes(locId) && !approveds.map(Number).includes(locId)) {
          tasks.push({ u, locId, status: 'rejected', source: record });
        }
      });
    }
  }

  // COS 查每条的“最新一张图”
  const rows = await Promise.all(tasks.map(async ({ u, locId, status, source }) => {
    const pending = u.pendingCheckins.find(item => Number(item.locationId) === locId);
    const approvedRecord = u.checkinRecords
      .filter(item => Number(item.locationId) === locId)
      .sort((a, b) => timestampOf(b.time) - timestampOf(a.time))[0];
    const reviewRecord = source || [...u.checkinReviewRecords]
      .reverse()
      .find(item => Number(item.locationId) === locId && item.status === status);
    const storedPhoto = pending?.photo || reviewRecord?.photo
      || (pending?.key ? toUrl(pending.key) : '')
      || (reviewRecord?.key ? toUrl(reviewRecord.key) : '');
    const found = storedPhoto ? null : await listLatestPhoto(u.id, u.username, locId);
    const location = getLocation(locId);
    return {
      id: `${u.id}_${locId}`,     // 组合键：userId_locationId
      userId: u.id,
      username: u.username,
      avatar: u.avatar,
      locationId: locId,
      locationName: location?.name || `未知地点 #${locId}`,
      points: location?.points ?? 1,
      status,                     // 'pending' or 'approved'
      reviewNote: reviewRecord?.note || '',
      appealStatus: pending?.appealStatus || reviewRecord?.appealStatus || '',
      appealReason: pending?.appealReason || reviewRecord?.appealReason || '',
      appealedAt: Number(pending?.appealedAt || reviewRecord?.appealedAt || 0),
      photo: storedPhoto || (found ? found.url : ''),
      uploadTime: timestampOf(pending?.submittedAt || reviewRecord?.submittedAt || reviewRecord?.reviewedAt || approvedRecord?.time) || (found ? found.uploadTime : 0)
    };
  }));

  // 排序：最新在前
  rows.sort((a, b) => (b.uploadTime || 0) - (a.uploadTime || 0));

  // 统计始终基于完整队列，避免切换筛选时数字跳成 0
  const stat = users.reduce((acc, user) => {
    const appealed = user.pendingCheckins.filter(item => item.appealStatus === 'pending').length;
    acc.appealed += appealed;
    acc.pending += Math.max(0, user.lockingLocations.length - appealed);
    acc.approved += user.unlockedLocations.length;
    const activeIds = new Set([...user.lockingLocations, ...user.unlockedLocations].map(Number));
    const rejectedIds = new Set(user.checkinReviewRecords
      .filter(item => item.status === 'rejected' && !activeIds.has(Number(item.locationId)))
      .map(item => Number(item.locationId)));
    acc.rejected += rejectedIds.size;
    acc.all += user.lockingLocations.length + user.unlockedLocations.length + rejectedIds.size;
    return acc;
  }, { all: 0, pending: 0, appealed: 0, approved: 0, rejected: 0 });

  return res.json({ code: 0, list: rows, stat });
});

// ====== 审核通过：locking -> unlocked ======
// POST /admin/checkins/:id/approve    （:id = `${userId}_${locationId}` 或 `${userId}:${locationId}`）
router.post('/checkins/:id/approve', auth, adminOnly, (req, res) => {
  const raw = String(req.params.id || '');
  const [uidStr, locStr] = raw.includes(':') ? raw.split(':') : raw.split('_');
  const userId = uidStr;
  const locationId = Number(locStr);
  if (!userId || !locationId) return res.status(400).json({ code: 1, message: '参数不正确' });

  const users = readUsers();
  const u = users.find(x => String(x.id) === String(userId));
  if (!u) return res.status(404).json({ code: 1, message: '用户不存在' });

  // 从 locking 中移除
  u.lockingLocations  = (u.lockingLocations  || []).filter(x => Number(x) !== locationId);
  u.unlockedLocations = Array.isArray(u.unlockedLocations) ? u.unlockedLocations : [];
  u.completedRoutes   = Array.isArray(u.completedRoutes)   ? u.completedRoutes   : [];
  u.checkinRecords    = Array.isArray(u.checkinRecords)    ? u.checkinRecords    : [];
  u.pendingCheckins   = Array.isArray(u.pendingCheckins)   ? u.pendingCheckins   : [];
  u.checkinReviewRecords = Array.isArray(u.checkinReviewRecords) ? u.checkinReviewRecords : [];
  u.points = Number.isFinite(u.points) ? u.points : 0;

  const alreadyUnlocked = u.unlockedLocations.includes(locationId);
  const newlyCompletedRoutes = [];
  const pending = u.pendingCheckins.find(item => Number(item.locationId) === locationId);
  const location = getLocation(locationId);
  const configuredPoints = Number.isFinite(Number(location?.points)) ? Number(location.points) : 1;
  // 所有待审记录均已迁移为积分延后，只有审核通过才计分。
  const pointsAwarded = pending?.pointsDeferred === true ? configuredPoints : 0;
  u.pendingCheckins = u.pendingCheckins.filter(item => Number(item.locationId) !== locationId);

  // 未解锁时才追加积分与打卡记录
  if (!alreadyUnlocked) {
    u.unlockedLocations.push(locationId);
    u.points += pointsAwarded;

    u.checkinRecords.push({
      locationId,
      distance: null,
      method: 'photo',
      pointsAwarded,
      time: new Date(timestampOf(pending?.submittedAt) || Date.now()).toISOString(),
      approvedAt: new Date().toISOString()
    });

    // 与 /checkin/map 相同的路线完成判定
    for (const route of routes) {
      if (u.completedRoutes.includes(route.id)) continue;
      if (!route.points || route.points.length === 0) continue;

      const allUnlocked = route.points.every(id => u.unlockedLocations.includes(id));
      if (allUnlocked) {
        u.completedRoutes.push(route.id);
        u.points += route.bonus || 5;
        newlyCompletedRoutes.push(route.id);
      }
    }
  }

  const appealedRecord = [...u.checkinReviewRecords]
    .reverse()
    .find(item => Number(item.locationId) === locationId && item.status === 'rejected' && item.appealStatus === 'pending');
  if (appealedRecord) appealedRecord.appealStatus = 'approved';

  u.checkinReviewRecords.push({
    locationId,
    status: 'approved',
    note: String(req.body?.note || '').trim(),
    photo: pending?.photo || '',
    key: pending?.key || '',
    submittedAt: Number(pending?.submittedAt || 0),
    appealStatus: pending?.appealStatus === 'pending' ? 'approved' : '',
    appealReason: pending?.appealReason || '',
    appealedAt: Number(pending?.appealedAt || 0),
    reviewerId: req.userId,
    reviewedAt: Date.now()
  });
  u.checkinReviewRecords = u.checkinReviewRecords.slice(-100);

  u.updatedAt = Date.now();
  writeUsers(users);

  res.json({
    code: 0,
    message: '已通过',
    data: {
      locationId,
      pointsAwarded: alreadyUnlocked ? 0 : pointsAwarded,
      newlyUnlocked: !alreadyUnlocked,
      newlyCompletedRoutes,
      points: u.points,
      unlockedLocations: u.unlockedLocations,
      completedRoutes: u.completedRoutes,
      checkinRecords: u.checkinRecords.slice(-20)
    }
  });
});

// ====== 审核驳回：从 locking 移除，不加入 unlocked ======
// POST /admin/checkins/:id/reject
router.post('/checkins/:id/reject', auth, adminOnly, (req, res) => {
  const raw = String(req.params.id || '');
  const [uidStr, locStr] = raw.includes(':') ? raw.split(':') : raw.split('_');
  const userId = uidStr;
  const locationId = Number(locStr);
  if (!userId || !locationId) return res.status(400).json({ code: 1, message: '参数不正确' });
  const note = String(req.body?.note || '').normalize('NFC').trim().slice(0, 500);
  if (Array.from(note).length < 4) {
    return res.status(400).json({ code: 1, message: '请填写至少 4 个字符的驳回理由，便于用户修改' });
  }

  const users = readUsers();
  const u = users.find(x => String(x.id) === String(userId));
  if (!u) return res.status(404).json({ code: 1, message: '用户不存在' });

  u.lockingLocations = (u.lockingLocations || []).filter(x => Number(x) !== locationId);
  u.pendingCheckins = Array.isArray(u.pendingCheckins) ? u.pendingCheckins : [];
  u.points = Number.isFinite(Number(u.points)) ? Number(u.points) : 0;
  const pending = u.pendingCheckins.find(item => Number(item.locationId) === locationId);
  const pointsReverted = 0;
  u.pendingCheckins = u.pendingCheckins.filter(item => Number(item.locationId) !== locationId);
  u.checkinReviewRecords = Array.isArray(u.checkinReviewRecords) ? u.checkinReviewRecords : [];
  const appealedRecord = [...u.checkinReviewRecords]
    .reverse()
    .find(item => Number(item.locationId) === locationId && item.status === 'rejected' && item.appealStatus === 'pending');
  if (appealedRecord) appealedRecord.appealStatus = 'rejected';
  u.checkinReviewRecords.push({
    locationId,
    status: 'rejected',
    note,
    photo: pending?.photo || '',
    key: pending?.key || '',
    submittedAt: Number(pending?.submittedAt || 0),
    appealStatus: pending?.appealStatus === 'pending' ? 'rejected' : '',
    appealReason: pending?.appealReason || '',
    appealedAt: Number(pending?.appealedAt || 0),
    pointsDeferred: pending?.pointsDeferred === true,
    pointsReverted,
    reviewerId: req.userId,
    reviewedAt: Date.now()
  });
  u.checkinReviewRecords = u.checkinReviewRecords.slice(-100);
  u.updatedAt = Date.now();
  writeUsers(users);

  res.json({ code: 0, message: '已驳回', data: { pointsReverted, points: u.points } });
});

// ================================================================
// Part 6: Best Creativity Award / Best Photography Award review
// ================================================================
const SUBMISSIONS_FILE = path.resolve(
  process.env.SUBMISSIONS_FILE || path.join(__dirname, '..', 'submissions.json')
);
const AWARDS = require('../data/awards');
const { isActivityEnded, computeWinners } = require('../winner');

function readSubmissionsArray() {
  ensureFile(SUBMISSIONS_FILE, '[]');
  try {
    const raw = fs.readFileSync(SUBMISSIONS_FILE, 'utf8') || '[]';
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('[admin] readSubmissionsArray fail:', e);
    return [];
  }
}

function writeSubmissionsArray(list) {
  try {
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (e) {
    console.error('[admin] writeSubmissionsArray fail:', e);
  }
}

// Build statistics: total + per-status + per-category
function buildSubmissionStat(list) {
  const stat = {
    all: list.length,
    pending: 0,
    approved: 0,
    rejected: 0,
    down: 0,
    featured: 0,
    byCategory: {}
  };
  (AWARDS.categories || []).forEach(cat => {
    stat.byCategory[cat.id] = { all: 0, pending: 0, approved: 0, rejected: 0, down: 0, featured: 0 };
  });
  list.forEach(s => {
    const st = s.status || 'pending';
    if (stat[st] !== undefined) stat[st] += 1;
    if (s.featured) stat.featured += 1;
    const cat = stat.byCategory[s.category];
    if (cat) {
      cat.all += 1;
      if (cat[st] !== undefined) cat[st] += 1;
      if (s.featured) cat.featured += 1;
    }
  });
  return stat;
}

// ====== Submission list + statistics ======
// GET /admin/submissions?status=all|pending|approved|rejected|featured&category=all|creative|photography
router.get('/submissions', auth, adminOnly, (req, res) => {
  const statusQ = String(req.query.status || 'all').toLowerCase();
  const categoryQ = String(req.query.category || 'all').toLowerCase();

  // 截止后自动按票数统计获奖名单
  const all = readSubmissionsArray();
  const { list: computedList, changed } = computeWinners(all, false);
  if (changed) writeSubmissionsArray(computedList);

  let list = computedList.slice();
  if (statusQ !== 'all') {
    list = list.filter(s => statusQ === 'featured' ? !!s.featured : (s.status || 'pending') === statusQ);
  }
  if (categoryQ !== 'all') {
    list = list.filter(s => s.category === categoryQ);
  }
  list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const stat = buildSubmissionStat(readSubmissionsArray());
  return res.json({ code: 0, list, stat });
});

// ====== Submission statistics only ======
// GET /admin/submissions/stats
router.get('/submissions/stats', auth, adminOnly, (_req, res) => {
  return res.json({ code: 0, stat: buildSubmissionStat(readSubmissionsArray()) });
});

// ====== Approve ======
// POST /admin/submissions/:id/approve
router.post('/submissions/:id/approve', auth, adminOnly, (req, res) => {
  const list = readSubmissionsArray();
  const item = list.find(s => String(s.id) === String(req.params.id));
  if (!item) return res.status(404).json({ code: 1, message: '投稿不存在' });
  const isAppeal = item.status === 'rejected' && item.appealStatus === 'pending';
  if (item.status !== 'pending' && !isAppeal) return res.json({ code: 1, message: '该投稿已审核' });

  item.status = 'approved';
  item.updatedAt = Date.now();
  item.reviewedAt = Date.now();
  if (req.body?.note !== undefined && req.body?.note !== null) {
    item.reviewNote = String(req.body.note || '').trim();
  }
  if (isAppeal) {
    item.appealStatus = 'resolved';
    item.appealResult = 'approved';
  }
  writeSubmissionsArray(list);
  res.json({ code: 0, message: isAppeal ? '已通过申诉' : '已通过' });
});

// ====== Reject ======
// POST /admin/submissions/:id/reject  { note }
router.post('/submissions/:id/reject', auth, adminOnly, (req, res) => {
  const list = readSubmissionsArray();
  const item = list.find(s => String(s.id) === String(req.params.id));
  if (!item) return res.status(404).json({ code: 1, message: '投稿不存在' });
  const isAppeal = item.status === 'rejected' && item.appealStatus === 'pending';
  if (item.status !== 'pending' && !isAppeal) return res.json({ code: 1, message: '该投稿已审核' });

  const note = String(req.body?.note || '').trim();
  if (!note) return res.json({ code: 1, message: '请填写驳回理由' });
  item.status = 'rejected';
  item.updatedAt = Date.now();
  item.reviewedAt = Date.now();
  item.reviewNote = note;
  if (isAppeal) {
    item.appealStatus = 'resolved';
    item.appealResult = 'rejected';
  }
  writeSubmissionsArray(list);
  res.json({ code: 0, message: isAppeal ? '已驳回申诉' : '已驳回' });
});

// ====== Mark / unmark featured ======
// POST /admin/submissions/:id/feature  { featured: true|false }
router.post('/submissions/:id/feature', auth, adminOnly, (req, res) => {
  const list = readSubmissionsArray();
  const item = list.find(s => String(s.id) === String(req.params.id));
  if (!item) return res.status(404).json({ code: 1, message: '投稿不存在' });
  if (item.status !== 'approved') {
    return res.status(400).json({ code: 1, message: '只有已通过的作品可以标记为优秀' });
  }

  const featured = req.body?.featured === true || req.body?.featured === 'true';
  item.featured = featured;
  item.updatedAt = Date.now();
  writeSubmissionsArray(list);
  res.json({ code: 0, message: featured ? '已标记为优秀作品' : '已取消优秀标记', featured });
});

// ====== 下架（已通过 → 已下架，不再公开展示） ======
// POST /admin/submissions/:id/down
router.post('/submissions/:id/down', auth, adminOnly, (req, res) => {
  const list = readSubmissionsArray();
  const item = list.find(s => String(s.id) === String(req.params.id));
  if (!item) return res.status(404).json({ code: 1, message: '投稿不存在' });
  if (item.status !== 'approved') return res.json({ code: 1, message: '只有已通过的作品可以下架' });

  item.status = 'down';
  item.updatedAt = Date.now();
  writeSubmissionsArray(list);
  res.json({ code: 0, message: '已下架，作品不再公开展示' });
});

// ====== 重新上架（已下架 → 已通过） ======
// POST /admin/submissions/:id/restore
router.post('/submissions/:id/restore', auth, adminOnly, (req, res) => {
  const list = readSubmissionsArray();
  const item = list.find(s => String(s.id) === String(req.params.id));
  if (!item) return res.status(404).json({ code: 1, message: '投稿不存在' });
  if (item.status !== 'down') return res.json({ code: 1, message: '只有已下架的作品可以重新上架' });

  item.status = 'approved';
  item.updatedAt = Date.now();
  writeSubmissionsArray(list);
  res.json({ code: 0, message: '已重新上架，作品恢复公开展示' });
});

// ====== 按当前票数刷新获奖名单（截止后自动执行；这里供管理员预览） ======
// POST /admin/submissions/compute-winners
router.post('/submissions/compute-winners', auth, adminOnly, (_req, res) => {
  const list = readSubmissionsArray();
  const { list: updated, changed, summary } = computeWinners(list, true);
  if (changed) writeSubmissionsArray(updated);
  res.json({
    code: 0,
    message: changed ? '已按当前票数刷新获奖名单' : '获奖名单未变化',
    changed,
    summary
  });
});

// ====== Export submission list (CSV) ======
// GET /admin/submissions/export?category=all|creative|photography
router.get('/submissions/export', auth, adminOnly, (req, res) => {
  const categoryQ = String(req.query.category || 'all').toLowerCase();
  let list = readSubmissionsArray().slice();
  if (categoryQ !== 'all') list = list.filter(s => s.category === categoryQ);
  list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const fmtTime = ts => {
    if (!ts) return '';
    try {
      return new Date(Number(ts)).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    } catch {
      return String(ts);
    }
  };

  // Prevent CSV formula injection
  const esc = v => {
    let s = String(v ?? '');
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    s = s.replace(/"/g, '""');
    return `"${s}"`;
  };

  const header = ['序号', '奖项', '作品名称', '作品说明', '打卡点', '投稿人', '提交时间', '审核状态', '是否优秀', '图片链接'];
  const rows = list.map((s, i) => [
    i + 1,
    s.categoryName || s.category || '',
    s.title || '',
    s.description || '',
    s.locationName || '',
    s.username || '',
    fmtTime(s.createdAt),
    ({ pending: '待审核', approved: '已通过', rejected: '已驳回', down: '已下架' })[s.status] || s.status,
    s.featured ? '是' : '否',
    (s.images || []).map(img => img.url || '').join('；')
  ]);

  const csv = '\ufeff' + [header, ...rows].map(row => row.map(esc).join(',')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent('奖项投稿名单')}_${Date.now()}.csv`
  );
  res.send(csv);
});

module.exports = router;
