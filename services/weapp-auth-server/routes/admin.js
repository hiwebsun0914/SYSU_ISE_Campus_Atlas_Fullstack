// routes/admin.js
require('dotenv').config();

const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const COS = require('cos-nodejs-sdk-v5');
const auth = require('../middleware/auth');

// ====== 常量 / 配置 ======
const USERS_FILE   = path.join(__dirname, '..', 'users.json');
const BOTTLES_FILE = path.join(__dirname, '..', 'bottles.json');
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
    return (Array.isArray(arr) ? arr : []).map(u => ({
      ...u,
      role: u.role || DEFAULT_ROLE,
      avatar: u.avatar || DEFAULT_AVATAR,
      username: u.username || '未命名',
      unlockedLocations: Array.isArray(u.unlockedLocations) ? u.unlockedLocations : [],
      lockingLocations : Array.isArray(u.lockingLocations)  ? u.lockingLocations  : [],
      bottlesThrow    : Array.isArray(u.bottlesThrow)       ? u.bottlesThrow       : [],
      bottlesReceived : Array.isArray(u.bottlesReceived)    ? u.bottlesReceived    : [],
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

// 读取 bottles.json —— 兼容数组或 { bottles: [] }，统一返回“瓶子数组”
function readBottlesArray() {
  ensureFile(BOTTLES_FILE, '[]');
  try {
    const raw = fs.readFileSync(BOTTLES_FILE, 'utf8') || '[]';
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.bottles)) return data.bottles;
    return [];
  } catch (e) {
    console.error('[admin] readBottlesArray fail:', e);
    return [];
  }
}

// ====== 权限：管理员 ======
function adminOnly(req, res, next) {
  const users = readUsers();
  const me = users.find(u => u.id === req.userId);
  if (!me) return res.status(401).json({ code: 1, message: '未登录' });
  if ((me.role || DEFAULT_ROLE) !== 'admin') {
    return res.status(403).json({ code: 1, message: '无管理员权限' });
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

// ====== 用户列表（含统计：unlocked/locking/threw） ======
// GET /admin/users
router.get('/users', auth, adminOnly, (_req, res) => {
  const users   = readUsers();
  const bottles = readBottlesArray();

  // 从 bottles.json 统计每个用户真实扔出的数量
  const thrownByOwner = bottles.reduce((acc, b) => {
    const k = String(b.ownerId);
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  const list = users.map(u => {
    const threwFromUsers = Array.isArray(u.bottlesThrow) ? u.bottlesThrow.length : 0;
    const threwFromBottle= thrownByOwner[String(u.id)] || 0;
    const threw = Math.max(threwFromUsers, threwFromBottle); // 取最大更稳健
    return {
      id: u.id,
      username: u.username,
      role: u.role,
      avatar: u.avatar,
      unlocked: u.unlockedLocations.length,
      locking : u.lockingLocations.length,
      threw,
      createdAt: u.createdAt || null,
      updatedAt: u.updatedAt || null
    };
  });

  res.json({ code: 0, list });
});

// ====== 打卡审核列表（区分 pending/approved/all） ======
// GET /admin/checkins?status=pending|approved|all
router.get('/checkins', auth, adminOnly, async (req, res) => {
  const statusQ = String(req.query.status || 'pending').toLowerCase();
  const users = readUsers();

  // 组装任务：pending 来自 lockingLocations；approved 来自 unlockedLocations
  const tasks = [];
  for (const u of users) {
    const pendings  = Array.isArray(u.lockingLocations)  ? u.lockingLocations  : [];
    const approveds = Array.isArray(u.unlockedLocations) ? u.unlockedLocations : [];

    if (statusQ === 'pending' || statusQ === 'all') {
      pendings.forEach(locId => tasks.push({ u, locId: Number(locId), status: 'pending' }));
    }
    if (statusQ === 'approved' || statusQ === 'all') {
      approveds.forEach(locId => tasks.push({ u, locId: Number(locId), status: 'approved' }));
    }
  }

  // COS 查每条的“最新一张图”
  const rows = await Promise.all(tasks.map(async ({ u, locId, status }) => {
    const found = await listLatestPhoto(u.id, u.username, locId); // 可能拿不到（未配置 COS 访问）
    return {
      id: `${u.id}_${locId}`,     // 组合键：userId_locationId
      userId: u.id,
      username: u.username,
      avatar: u.avatar,
      locationId: locId,
      status,                     // 'pending' or 'approved'
      photo: found ? found.url : '',
      uploadTime: found ? found.uploadTime : 0
    };
  }));

  // 排序：最新在前
  rows.sort((a, b) => (b.uploadTime || 0) - (a.uploadTime || 0));

  // 统计
  const stat = rows.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    acc.all++;
    return acc;
  }, { all: 0, pending: 0, approved: 0 });

  return res.json({ code: 0, list: rows, stat });
});

// ====== 审核通过：locking -> unlocked ======
// POST /admin/checkins/:id/approve    （:id = `${userId}_${locationId}` 或 `${userId}:${locationId}`）
router.post('/checkins/:id/approve', auth, adminOnly, (req, res) => {
  const raw = String(req.params.id || '');
  const [uidStr, locStr] = raw.includes(':') ? raw.split(':') : raw.split('_');
  const userId = Number(uidStr);
  const locationId = Number(locStr);
  if (!userId || !locationId) return res.status(400).json({ code: 1, message: '参数不正确' });

  const users = readUsers();
  const u = users.find(x => x.id === userId);
  if (!u) return res.status(404).json({ code: 1, message: '用户不存在' });

  // 从 locking 中移除，再安全加入 unlocked（避免重复）
  u.lockingLocations  = (u.lockingLocations  || []).filter(x => Number(x) !== locationId);
  u.unlockedLocations = Array.isArray(u.unlockedLocations) ? u.unlockedLocations : [];
  if (!u.unlockedLocations.includes(locationId)) u.unlockedLocations.push(locationId);

  u.updatedAt = Date.now();
  writeUsers(users);

  res.json({ code: 0, message: '已通过' });
});

// ====== 审核驳回：从 locking 移除，不加入 unlocked ======
// POST /admin/checkins/:id/reject
router.post('/checkins/:id/reject', auth, adminOnly, (req, res) => {
  const raw = String(req.params.id || '');
  const [uidStr, locStr] = raw.includes(':') ? raw.split(':') : raw.split('_');
  const userId = Number(uidStr);
  const locationId = Number(locStr);
  if (!userId || !locationId) return res.status(400).json({ code: 1, message: '参数不正确' });

  const users = readUsers();
  const u = users.find(x => x.id === userId);
  if (!u) return res.status(404).json({ code: 1, message: '用户不存在' });

  u.lockingLocations = (u.lockingLocations || []).filter(x => Number(x) !== locationId);
  u.updatedAt = Date.now();
  writeUsers(users);

  res.json({ code: 0, message: '已驳回' });
});

// ====== 漂流瓶列表（支持 all / picked / unpicked，兼容 picks 与 pickedBy） ======
// GET /admin/bottles?status=all|picked|unpicked
router.get('/bottles', auth, adminOnly, (req, res) => {
  const status  = String(req.query.status || 'all').toLowerCase();

  const bottles = readBottlesArray();
  const users   = readUsers();

  const id2name = {};
  users.forEach(u => { id2name[String(u.id)] = u.username || ''; });

  // 统一“是否被捡过”的判断 & 统一 picks 结构
  const norm = bottles.map(b => {
    let picks = [];
    if (Array.isArray(b.picks)) {
      picks = b.picks;
    } else if (b.pickedBy) {
      picks = [{ userId: b.pickedBy, pickTime: b.pickTime || 0 }];
    }
    const picked = picks.length > 0;

    const picksWithName = picks.map(p => ({
      ...p,
      name: id2name[String(p.userId)] || ''
    }));

    return {
      ...b,
      picks: picksWithName,
      _pickerNames: picksWithName.map(p => p.name).filter(Boolean).join('、'),
      _picked: picked
    };
  });

  let list = norm;
  if (status === 'picked')   list = norm.filter(b => b._picked);
  if (status === 'unpicked') list = norm.filter(b => !b._picked);

  const all      = norm.length;
  const picked   = norm.filter(b => b._picked).length;
  const unpicked = all - picked;

  // 按上传时间/ID 倒序
  list.sort((a, b) =>
    (Number(b.uploadTime || 0) - Number(a.uploadTime || 0)) ||
    (Number(b.id || 0)         - Number(a.id || 0))
  );

  return res.json({ code: 0, list, stat: { all, picked, unpicked } });
});

module.exports = router;
