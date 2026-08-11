// routes/checkin.js
require('dotenv').config();

const router = require('express').Router();
const COS = require('cos-nodejs-sdk-v5');
const STS = require('qcloud-cos-sts');
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');
const routes = require('../data/routes');
const locations = require('../data/locations');

// ==== 环境变量 ====
const {
  COS_BUCKET, COS_REGION, PUBLIC_ASSET_DOMAIN,
  TENCENT_SECRET_ID, TENCENT_SECRET_KEY,
  STS_DURATION = 300
} = process.env;

// ==== COS 实例 ====
const cos = new COS({ SecretId: TENCENT_SECRET_ID, SecretKey: TENCENT_SECRET_KEY });

// ==== users.json 读取 ====
const USERS_FILE = path.join(__dirname, '..', 'users.json');
function readUsers() {
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf8') || '[]';
    return JSON.parse(raw);
  } catch (e) {
    console.error('[checkin] read users.json fail:', e);
    return [];
  }
}
function getUserById(id) {
  return readUsers().find(u => String(u.id) === String(id));
}
function writeUsers(list) {
  try { fs.writeFileSync(USERS_FILE, JSON.stringify(list, null, 2), 'utf8'); }
  catch (e) { console.error('[checkin] write users fail:', e); }
}

// ==== 工具 ====
const toUrl = (key) => {
  const base = PUBLIC_ASSET_DOMAIN || `https://${COS_BUCKET}.cos.${COS_REGION}.myqcloud.com`;
  return `${base}/${encodeURI(key)}`;
};

const safeSlug = (s = '') =>
  String(s).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '').slice(0, 40);

const safeExt = (e = 'jpg') => {
  const ext = String(e).replace('.', '').toLowerCase();
  if (ext === 'jpeg') return 'jpg';
  return ['jpg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
};

const pickDir = (req) => {
  const d = String(req.body?.dir || '').toLowerCase();
  // 仅允许两个命名空间：checkin / Bottle
  if (d === 'bottle' || d === 'bottles') return 'Bottle';
  return 'checkin';
};

// checkin/<uid>__<slug>/<locationId>/<ts_rand>.<ext>
// 或 Bottle/<uid>__<slug>/<locationId>/<ts_rand>.<ext>
function buildKey(req, ext = 'jpg') {
  const u = req.user?.username
    ? { username: req.user.username }
    : getUserById(req.userId) || {};
  const dir = pickDir(req);
  const uid = req.userId;
  const slug = safeSlug(u.username || 'user');
  const loc = (req.body?.locationId || 'general').toString();
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${dir}/${uid}__${slug}/${loc}/${ts}_${rand}.${safeExt(ext)}`;
}

// ======= 取图相关：前缀、签名、公网 URL、列举 =======
function getUserSlug(req) {
  const u = req.user?.username ? { username: req.user.username } : getUserById(req.userId) || {};
  return safeSlug(u.username || 'user');
}
function getUserPrefix(req, locationId) {
  const slug = getUserSlug(req);
  const uid  = req.userId;
  const loc  = String(locationId || 'general');
  return `checkin/${uid}__${slug}/${loc}/`;
}
function getUserRootPrefixes(req) {
  const slug = getUserSlug(req);
  const uid  = req.userId;
  return [
    `checkin/${uid}__${slug}/`,
    `Bottle/${uid}__${slug}/`,
  ];
}
// 校验某 key 是否属于当前用户（checkin/ 或 Bottle/ 任一目录均可）
function ensureKeyOwned(req, key) {
  const roots = getUserRootPrefixes(req);
  return !!roots.find(p => String(key || '').startsWith(p));
}

function toSignedUrl(key, expires = 600) {
  // cos.getObjectUrl 支持同步返回签名 URL
  return cos.getObjectUrl({
    Bucket: COS_BUCKET,
    Region: COS_REGION,
    Key: key,
    Sign: true,
    Expires: expires
  });
}
function toPublicUrl(key) {
  return toUrl(key);
}

// COS 列举（Marker 分页），只取图片后缀
async function listObjectsByPrefix(prefix, max = 1000) {
  const out = [];
  let Marker = undefined;
  do {
    const data = await cos.getBucket({
      Bucket: COS_BUCKET,
      Region: COS_REGION,
      Prefix: prefix,
      MaxKeys: Math.min(1000, max),
      Marker
    });
    const items = (data.Contents || [])
      .map(o => o.Key)
      .filter(k => /\.(png|jpe?g|webp|gif|bmp)$/i.test(k));
    out.push(...items);
    Marker = data.IsTruncated ? data.NextMarker : undefined;
  } while (Marker && out.length < max);
  // 你的命名规则是 “{13位时间戳}_rand.ext”，按 Key 倒序≈时间倒序
  out.sort((a, b) => b.localeCompare(a));
  return out;
}

// ==== A. 预签名 PUT ====
router.post('/presign', auth, (req, res) => {
  const ext = req.body?.ext;
  const dir = (req.body?.dir || '').toString();   // 可选：'Bottle'
  const uid = req.userId;
  const slug = safeSlug(req.user?.username || 'user');

  let key;
  if (dir && /^[-_/A-Za-z0-9]+$/.test(dir)) {
    // ✅ 用于漂流瓶：Bucket 中的 Bottle/ 目录
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    key = `${dir}/${uid}__${slug}/${ts}_${rand}.${safeExt(ext)}`;
  } else {
    // ✅ 正常打卡：checkin/<uid>__<slug>/<locationId>/<ts_rand>.<ext>
    key = buildKey(req, ext);
  }

  cos.getObjectUrl(
    { Bucket: COS_BUCKET, Region: COS_REGION, Key: key, Method: 'PUT', Sign: true, Expires: 300 },
    (err, data) => {
      if (err || !data?.Url) {
        console.error('[PRESIGN ERROR]', err || data);
        return res.status(500).json({ code: 1, message: '预签名失败' });
      }
      res.json({ code: 0, data: { key, putUrl: data.Url } });
    }
  );
});

// ==== B. STS 临时凭证（可选直传）====
router.post('/init', auth, (req, res) => {
  const key = buildKey(req, req.body?.ext);
  const [, appid] = String(COS_BUCKET).split(/-(?=[^-]+$)/);
  const prefix = key.replace(/\/[^/]+$/, '/*');

  const policy = {
    version: '2.0',
    statement: [{
      effect: 'allow',
      principal: { qcs: ['*'] },
      action: [
        'name/cos:PutObject','name/cos:PostObject','name/cos:HeadObject',
        'name/cos:InitiateMultipartUpload','name/cos:ListMultipartUploads',
        'name/cos:ListParts','name/cos:UploadPart',
        'name/cos:CompleteMultipartUpload','name/cos:AbortMultipartUpload'
      ],
      resource: [`qcs::cos:${COS_REGION}:uid/${appid}:${COS_BUCKET}/${prefix}`]
    }]
  };

  STS.getCredential({
    secretId: TENCENT_SECRET_ID,
    secretKey: TENCENT_SECRET_KEY,
    durationSeconds: Number(STS_DURATION) || 300,
    policy
  }, (err, creds) => {
    if (err || !creds?.credentials) {
      console.error('[checkin/init] STS error:', err || creds);
      return res.status(500).json({ code: 1, message: '获取上传凭证失败' });
    }
    res.json({
      code: 0,
      data: {
        bucket: COS_BUCKET,
        region: COS_REGION,
        key,
        credentials: {
          tmpSecretId: creds.credentials.tmpSecretId,
          tmpSecretKey: creds.credentials.tmpSecretKey,
          sessionToken: creds.credentials.sessionToken,
          startTime: creds.startTime,
          expiredTime: creds.expiredTime
        }
      }
    });
  });
});

// ==== C. 提交绑定（兜底设置 public-read 并校验归属）====
router.post('/commit', auth, async (req, res) => {
  const { key, size } = req.body || {};
  const uid = req.userId;
  const slug = safeSlug(req.user?.username || 'user');

  // 允许 Bottle/ 前缀 或 checkin/<uid>__<slug>/ 前缀
  const okPrefix1 = `checkin/${uid}__${slug}/`;
  const okPrefix2 = `Bottle/${uid}__${slug}/`;

  if (!key || !(key.startsWith(okPrefix1) || key.startsWith(okPrefix2))) {
    return res.status(400).json({ code: 1, message: '非法 key' });
  }

  const head = await cos.headObject({ Bucket: COS_BUCKET, Region: COS_REGION, Key: key }).catch(() => null);
  if (!head) return res.status(400).json({ code: 1, message: '对象不存在或未上传成功' });

  if (size && Number(head.headers['content-length']) > Number(size) + 2048) {
    return res.status(400).json({ code: 1, message: '文件大小不匹配' });
  }

  // 兜底：public-read（如果你是私有桶，可保留签名访问，ACL 设置不影响读不到的问题）
  await cos.putObjectAcl({
    Bucket: COS_BUCKET,
    Region: COS_REGION,
    Key: key,
    ACL: 'public-read'
  }).catch(e => console.warn('putObjectAcl fail', e?.message));

  // === 关键：把 locationId 写入 users.json 的 lockingLocations（仅数字） ===
  // 说明：前端打卡时会把 locationId 一并传给 commit
  const locNum = Number(req.body?.locationId);
  let awardedPoints = 0;
  if (Number.isInteger(locNum)) {
    const users = readUsers();
    const idx = users.findIndex(u => String(u.id) === String(uid));
    if (idx !== -1) {
      const u = users[idx];
      u.lockingLocations = Array.isArray(u.lockingLocations) ? u.lockingLocations : [];
      u.unlockedLocations = Array.isArray(u.unlockedLocations) ? u.unlockedLocations : [];

      u.points = Number.isFinite(u.points) ? u.points : 0;

      // 已解锁则不再加入待审；未解锁也未待审时加入
      if (!u.unlockedLocations.includes(locNum) && !u.lockingLocations.includes(locNum)) {
        u.lockingLocations.push(locNum);
        // 首次拍照打卡加分：隐藏地点 +2，普通地点 +1（仅首次，不与 GPS 重复）
        const isHidden = locations.some(l => l.id === locNum && l.isHidden);
        awardedPoints = isHidden ? 2 : 1;
        u.points += awardedPoints;
      }
      u.updatedAt = Date.now();
      writeUsers(users);
    }
  }

  res.json({ code: 0, key, url: toUrl(key), awardedPoints });
});

// ==== D. 获取打卡状态 ====
router.get('/status', auth, (req, res) => {
  try {
    const user = getUserById(req.userId);
    if (!user) return res.status(404).json({ code: 1, message: '用户不存在' });

    const unlocked = Array.isArray(user.unlockedLocations) ? user.unlockedLocations : [];
    const locking  = Array.isArray(user.lockingLocations)  ? user.lockingLocations  : [];

    return res.json({
      code: 0,
      unlockedLocations: unlocked,
      lockingLocations : locking,
      unlockedCount: unlocked.length,
      lockingCount : locking.length,
      total: unlocked.length + locking.length
    });
  } catch (e) {
    console.error('[checkin/status] error:', e);
    return res.status(500).json({ code: 1, message: '获取打卡状态失败' });
  }
});


// ==== E. 地图 GPS 打卡（无需上传图片）====
router.post('/map', auth, (req, res) => {
  try {
    const { locationId, distance, method = 'geo' } = req.body || {};
    const locNum = Number(locationId);

    if (!Number.isInteger(locNum) || locNum <= 0) {
      return res.status(400).json({ code: 1, message: 'locationId 必须是正整数' });
    }

    const location = locations.find(l => l.id === locNum);
    if (!location) {
      return res.status(404).json({ code: 1, message: '地点不存在' });
    }

    const users = readUsers();
    const idx = users.findIndex(u => String(u.id) === String(req.userId));
    if (idx === -1) return res.status(404).json({ code: 1, message: '用户不存在' });

    const user = users[idx];
    user.unlockedLocations = Array.isArray(user.unlockedLocations) ? user.unlockedLocations : [];
    user.lockingLocations = Array.isArray(user.lockingLocations) ? user.lockingLocations : [];
    user.completedRoutes = Array.isArray(user.completedRoutes) ? user.completedRoutes : [];
    user.checkinRecords = Array.isArray(user.checkinRecords) ? user.checkinRecords : [];
    user.points = Number.isFinite(user.points) ? user.points : 0;

    const alreadyUnlocked = user.unlockedLocations.includes(locNum);
    const alreadyPending = user.lockingLocations.includes(locNum); // 已通过拍照打卡（已加分）

    // 未解锁时才写入积分与记录
    if (!alreadyUnlocked) {
      user.unlockedLocations.push(locNum);
      // 仅当该地点之前未通过拍照打卡时才加 GPS 的 1 分，避免与拍照重复加分
      if (!alreadyPending) {
        user.points += 1;
      }

      user.checkinRecords.push({
        locationId: locNum,
        distance: Number.isFinite(Number(distance)) ? Math.round(Number(distance) * 10) / 10 : null,
        method: String(method || 'geo').slice(0, 20),
        time: new Date().toISOString()
      });
    }

    // 路线完成判断（只要路线所有点都在 unlockedLocations 中即完成）
    const newlyCompletedRoutes = [];
    for (const route of routes) {
      if (user.completedRoutes.includes(route.id)) continue;
      if (!route.points || route.points.length === 0) continue;

      const allUnlocked = route.points.every(id => user.unlockedLocations.includes(id));
      if (allUnlocked) {
        user.completedRoutes.push(route.id);
        newlyCompletedRoutes.push(route.id);
      }
    }

    user.updatedAt = Date.now();
    writeUsers(users);

    return res.json({
      code: 0,
      data: {
        locationId: locNum,
        locationName: location.name,
        newlyUnlocked: !alreadyUnlocked,
        newlyCompletedRoutes,
        points: user.points,
        unlockedLocations: user.unlockedLocations,
        completedRoutes: user.completedRoutes,
        checkinRecords: user.checkinRecords.slice(-20) // 只返回最近 20 条
      }
    });
  } catch (e) {
    console.error('[checkin/map] error:', e);
    return res.status(500).json({ code: 1, message: '打卡失败' });
  }
});

// ================== 新增：取图接口 ==================

// 1) 多张列表：GET /checkin/photo/list?locationId=xxx
router.get('/photo/list', auth, async (req, res) => {
  try {
    const { locationId } = req.query || {};
    if (!locationId) return res.status(400).json({ code: 1, message: 'locationId required' });

    const prefix = getUserPrefix(req, locationId);
    const keys   = await listObjectsByPrefix(prefix, 1000);

    // 更安全：只返回 key；前端需要展示时再调 /photo/sign 换临时 URL
    const photos = keys.map(k => ({ key: k }));

    return res.json({ code: 0, data: { photos, count: photos.length } });
  } catch (e) {
    console.error('[checkin/photo/list] error:', e);
    return res.status(500).json({ code: 1, message: 'list failed' });
  }
});

// 2) 最新一张：GET /checkin/photo/latest?locationId=xxx
router.get('/photo/latest', auth, async (req, res) => {
  try {
    const { locationId } = req.query || {};
    if (!locationId) return res.status(400).json({ code: 1, message: 'locationId required' });

    const prefix = getUserPrefix(req, locationId);
    const keys   = await listObjectsByPrefix(prefix, 50);
    const latest = keys[0];

    if (!latest) return res.json({ code: 0, data: { url: '' } });

    // 若桶为私有读 -> 签名；若已设置 public-read 且允许公网直链 -> 可用 toPublicUrl(latest)
    const USE_SIGNED_URL = true;
    const url = USE_SIGNED_URL ? toSignedUrl(latest, 600) : toPublicUrl(latest);

    return res.json({ code: 0, data: { url, key: latest } });
  } catch (e) {
    console.error('[checkin/photo/latest] error:', e);
    return res.status(500).json({ code: 1, message: 'latest failed' });
  }
});

// 3) 签名直链：GET /checkin/photo/sign?key=...
router.get('/photo/sign', auth, async (req, res) => {
  try {
    const { key } = req.query || {};
    if (!key) return res.status(400).json({ code: 1, message: 'key required' });

    // 安全校验：必须属于该用户（checkin/ 或 Bottle/ 根目录）
    if (!ensureKeyOwned(req, key)) {
      return res.status(403).json({ code: 1, message: 'forbidden key' });
    }

    // 可选：存在性检查，避免签一个不存在的对象
    const head = await cos.headObject({ Bucket: COS_BUCKET, Region: COS_REGION, Key: key }).catch(() => null);
    if (!head) return res.status(404).json({ code: 1, message: 'object not exist' });

    const url = toSignedUrl(key, 600);
    return res.json({ code: 0, data: { url } });
  } catch (e) {
    console.error('[checkin/photo/sign] error:', e);
    return res.status(500).json({ code: 1, message: 'sign failed' });
  }
});

module.exports = router;
