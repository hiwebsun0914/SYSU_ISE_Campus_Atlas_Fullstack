// routes/submissions.js
// 第六部分：最佳创意奖 / 最佳摄影奖 投稿接口
// 用户端：投稿（预签名上传 → 确认上传 → 创建投稿记录）、我的投稿、公开作品展示
require('dotenv').config();

const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const COS = require('cos-nodejs-sdk-v5');
const auth = require('../middleware/auth');
const { optionalAuth } = require('../middleware/auth');
const awards = require('../data/awards');
const locationsData = require('../data/locations');

// ====== 环境配置 ======
const {
  COS_BUCKET,
  COS_REGION,
  TENCENT_SECRET_ID,
  TENCENT_SECRET_KEY,
  PUBLIC_ASSET_DOMAIN
} = process.env;

const cos = (TENCENT_SECRET_ID && TENCENT_SECRET_KEY && COS_BUCKET && COS_REGION)
  ? new COS({ SecretId: TENCENT_SECRET_ID, SecretKey: TENCENT_SECRET_KEY })
  : null;

// ====== 数据文件 ======
const SUBMISSIONS_FILE = path.resolve(
  process.env.SUBMISSIONS_FILE || path.join(__dirname, '..', 'submissions.json')
);
const USERS_FILE = path.resolve(
  process.env.USERS_FILE || path.join(__dirname, '..', 'users.json')
);

function ensureFile(file, fallback = '[]') {
  try {
    if (!fs.existsSync(file)) fs.writeFileSync(file, fallback, 'utf8');
  } catch (e) {
    console.error('[submissions] ensureFile fail:', file, e);
  }
}

function readSubmissions() {
  ensureFile(SUBMISSIONS_FILE);
  try {
    const raw = fs.readFileSync(SUBMISSIONS_FILE, 'utf8') || '[]';
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('[submissions] read fail:', e);
    return [];
  }
}

function writeSubmissions(list) {
  try {
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (e) {
    console.error('[submissions] write fail:', e);
  }
}

function readUsers() {
  ensureFile(USERS_FILE);
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8') || '[]');
  } catch {
    return [];
  }
}

// ====== 工具 ======
const safeSlug = (s = '') =>
  String(s).trim().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '')
    .slice(0, 40);

const safeExt = (e = 'jpg') => {
  const ext = String(e).replace('.', '').toLowerCase();
  if (ext === 'jpeg') return 'jpg';
  return ['jpg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg';
};

const contentTypeOf = (ext) => {
  const map = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
  return map[String(ext).toLowerCase()] || 'image/jpeg';
};

const toUrl = (key) => {
  const base = PUBLIC_ASSET_DOMAIN ||
    (COS_BUCKET && COS_REGION ? `https://${COS_BUCKET}.cos.${COS_REGION}.myqcloud.com` : '');
  return base ? `${base}/${encodeURI(key)}` : '';
};

const validLocationIds = () => {
  const ids = new Set();
  (locationsData.locations || []).forEach(l => {
    const n = Number(l.id);
    if (Number.isInteger(n)) ids.add(n);
  });
  return ids;
};

function categoryById(id) {
  return (awards.categories || []).find(c => c.id === id) || null;
}

function winnerLabelOf(rank) {
  if (!rank) return '';
  return (awards.winnerRanks || []).find(r => r.id === rank)?.label || '';
}

function userPrefix(req) {
  const slug = safeSlug(req.user?.username || 'user');
  return `Award/${req.userId}__${slug}/`;
}

function buildKey(req, ext = 'jpg') {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${userPrefix(req)}${ts}_${rand}.${safeExt(ext)}`;
}

function findById(id) {
  return readSubmissions().find(s => String(s.id) === String(id));
}

// 保留投稿记录中用户可读信息
function publicView(s, withUser = false, viewerId = null) {
  const likes = Array.isArray(s.likes) ? s.likes : [];
  const base = {
    id: s.id,
    category: s.category,
    categoryName: s.categoryName,
    title: s.title || '',
    description: s.description || '',
    locationId: s.locationId,
    locationName: s.locationName || '',
    images: Array.isArray(s.images) ? s.images.map(img => ({
      key: img.key,
      url: img.url || toUrl(img.key)
    })) : [],
    status: s.status || 'pending',
    featured: !!s.featured,
    winnerRank: s.winnerRank || '',
    winnerLabel: winnerLabelOf(s.winnerRank),
    likeCount: likes.length,
    likedByMe: viewerId != null && likes.some(id => String(id) === String(viewerId)),
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    reviewedAt: s.reviewedAt || 0,
    reviewNote: s.reviewNote || ''
  };
  if (withUser) {
    base.userId = s.userId;
    base.username = s.username || '';
    base.avatar = s.avatar || '';
  }
  return base;
}

// ====== 1. 投稿规则 / 奖项信息（公开） ======
// GET /submissions/meta
router.get('/meta', (_req, res) => {
  res.json({
    code: 0,
    data: {
      deadline: awards.deadline,
      perUserPerCategory: awards.perUserPerCategory,
      maxImagesPerWork: awards.maxImagesPerWork,
      maxImageMB: awards.maxImageMB,
      allowedImageTypes: awards.allowedImageTypes,
      categories: awards.categories
    }
  });
});

// ====== 2. 预签名上传地址 ======
// POST /submissions/presign  { ext }
// 图片将上传到 COS 的 Award/<uid>__<username>/ 目录下
router.post('/presign', auth, (req, res) => {
  if (!cos) {
    return res.status(500).json({ code: 1, message: 'COS 未配置，无法上传图片' });
  }
  const ext = String(req.body?.ext || 'jpg').replace('.', '').toLowerCase();
  const key = buildKey(req, ext);

  cos.getObjectUrl(
    { Bucket: COS_BUCKET, Region: COS_REGION, Key: key, Method: 'PUT', Sign: true, Expires: 300 },
    (err, data) => {
      if (err || !data?.Url) {
        console.error('[submissions/presign] error:', err || data);
        return res.status(500).json({ code: 1, message: '获取上传地址失败' });
      }
      res.json({ code: 0, data: { key, putUrl: data.Url, contentType: contentTypeOf(ext) } });
    }
  );
});

// ====== 3. 确认上传（校验文件存在并设置公开读） ======
// POST /submissions/commit  { key, size }
router.post('/commit', auth, async (req, res) => {
  if (!cos) {
    return res.status(500).json({ code: 1, message: 'COS 未配置，无法确认上传' });
  }
  const { key, size } = req.body || {};
  if (!key || !String(key).startsWith(userPrefix(req))) {
    return res.status(400).json({ code: 1, message: '非法的图片地址' });
  }

  const head = await cos.headObject({ Bucket: COS_BUCKET, Region: COS_REGION, Key: key }).catch(() => null);
  if (!head) return res.status(400).json({ code: 1, message: '图片尚未上传成功' });

  if (size && Number(head.headers['content-length']) > Number(size) + 2048) {
    return res.status(400).json({ code: 1, message: '图片大小不匹配' });
  }

  await cos.putObjectAcl({
    Bucket: COS_BUCKET,
    Region: COS_REGION,
    Key: key,
    ACL: 'public-read'
  }).catch(e => console.warn('[submissions/commit] ACL fail', e?.message));

  res.json({ code: 0, data: { key, url: toUrl(key) } });
});

// ====== 4. 创建投稿 ======
// POST /submissions  { category, title, description, locationId, images: [{key}] }
router.post('/', auth, (req, res) => {
  const body = req.body || {};
  const category = String(body.category || '');
  const cat = categoryById(category);
  if (!cat) {
    return res.json({ code: 1, message: '请选择正确的奖项类别' });
  }

  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim();
  if (!title) return res.json({ code: 1, message: '请填写作品名称' });
  if (title.length > 30) return res.json({ code: 1, message: '作品名称最多 30 个字' });
  if (!description) return res.json({ code: 1, message: '请填写作品说明' });
  if (description.length > 500) return res.json({ code: 1, message: '作品说明最多 500 个字' });

  const locationId = Number(body.locationId);
  if (!Number.isInteger(locationId) || !validLocationIds().has(locationId)) {
    return res.json({ code: 1, message: '请选择对应的打卡点' });
  }

  const rawImages = Array.isArray(body.images) ? body.images : [];
  if (rawImages.length < 1) return res.json({ code: 1, message: '请至少上传一张作品图片' });
  if (rawImages.length > awards.maxImagesPerWork) {
    return res.json({ code: 1, message: `每份作品最多上传 ${awards.maxImagesPerWork} 张图片` });
  }

  // 图片 key 必须属于当前用户
  const prefix = userPrefix(req);
  const images = rawImages.map(img => {
    const key = typeof img === 'string' ? img : (img && img.key);
    return { key: String(key || ''), url: toUrl(key) };
  });
  if (!images.every(img => img.key.startsWith(prefix))) {
    return res.status(400).json({ code: 1, message: '包含非本人上传的图片' });
  }

  const users = readUsers();
  const me = users.find(u => u.id === req.userId);
  if (!me) return res.status(401).json({ code: 1, message: '用户不存在' });

  // 防止重复提交：同一用户同一奖项已有待审核/已通过的作品
  const active = readSubmissions().find(s =>
    String(s.userId) === String(req.userId) &&
    s.category === category &&
    (s.status === 'pending' || s.status === 'approved')
  );
  if (active) {
    return res.json({
      code: 2,
      message: `你已提交过${cat.name}，每人限投 ${awards.perUserPerCategory} 份`,
      data: { existingId: active.id }
    });
  }

  const now = Date.now();
  const locName = (locationsData.locations || []).find(l => Number(l.id) === locationId)?.name || '';
  const record = {
    id: `${now}_${Math.random().toString(36).slice(2, 8)}`,
    category,
    categoryName: cat.name,
    title,
    description,
    locationId,
    locationName: locName,
    images,
    userId: req.userId,
    username: me.username || '匿名用户',
    avatar: me.avatar || '',
    status: 'pending',
    featured: false,
    createdAt: now,
    updatedAt: now,
    reviewedAt: 0,
    reviewNote: ''
  };

  const list = readSubmissions();
  list.push(record);
  writeSubmissions(list);

  res.json({ code: 0, message: '投稿成功，等待审核', data: { submission: publicView(record, true) } });
});

// ====== 5. 我的投稿 ======
// GET /submissions/mine
router.get('/mine', auth, (_req, res) => {
  const list = readSubmissions()
    .filter(s => String(s.userId) === String(_req.userId))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .map(s => publicView(s, true));
  res.json({ code: 0, list });
});

// ====== 6. 公开作品展示（仅已通过） ======
// GET /submissions?category=creative|photography&featured=1&limit=20
router.get('/', optionalAuth, (req, res) => {
  const q = req.query || {};
  let list = readSubmissions().filter(s => s.status === 'approved');

  if (q.category) list = list.filter(s => s.category === String(q.category));
  if (String(q.featured) === '1' || String(q.featured) === 'true') {
    list = list.filter(s => !!s.featured);
  }

  list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  const limit = Math.min(Number(q.limit) || 50, 200);
  const page = list.slice(0, limit).map(s => publicView(s, true, req.userId));
  res.json({ code: 0, list: page, total: list.length });
});

// ====== 6b. 获奖结果公示（仅已通过且已设置获奖等级） ======
// GET /submissions/winners
router.get('/winners', optionalAuth, (_req, res) => {
  const list = readSubmissions()
    .filter(s => s.status === 'approved' && s.winnerRank)
    .sort((a, b) => {
      const orderA = (awards.winnerRanks || []).findIndex(r => r.id === a.winnerRank);
      const orderB = (awards.winnerRanks || []).findIndex(r => r.id === b.winnerRank);
      return (orderA === -1 ? 99 : orderA) - (orderB === -1 ? 99 : orderB);
    })
    .map(s => publicView(s, true, _req.userId));
  res.json({ code: 0, list });
});

// ====== 6c. 点赞 / 取消点赞（仅已通过作品，登录用户） ======
// POST /submissions/:id/like  { action: 'like' | 'unlike' }
router.post('/:id/like', auth, (req, res) => {
  const list = readSubmissions();
  const item = list.find(s => String(s.id) === String(req.params.id));
  if (!item) return res.status(404).json({ code: 1, message: '作品不存在' });
  if (item.status !== 'approved') {
    return res.json({ code: 1, message: '作品通过审核后才能点赞' });
  }

  const action = String(req.body?.action || 'like');
  let likes = Array.isArray(item.likes) ? item.likes : [];
  const already = likes.some(id => String(id) === String(req.userId));

  if (action === 'like' && !already) likes.push(req.userId);
  if (action === 'unlike' && already) likes = likes.filter(id => String(id) !== String(req.userId));

  item.likes = likes;
  item.updatedAt = Date.now();
  writeSubmissions(list);

  res.json({
    code: 0,
    likeCount: likes.length,
    likedByMe: likes.some(id => String(id) === String(req.userId))
  });
});

// ====== 7. 撤销投稿（仅自己、仅待审核） ======
// DELETE /submissions/:id
router.delete('/:id', auth, (req, res) => {
  const list = readSubmissions();
  const idx = list.findIndex(s => String(s.id) === String(req.params.id));
  if (idx === -1) return res.status(404).json({ code: 1, message: '投稿不存在' });
  if (String(list[idx].userId) !== String(req.userId)) {
    return res.status(403).json({ code: 1, message: '只能操作自己的投稿' });
  }
  if (list[idx].status !== 'pending') {
    return res.json({ code: 1, message: '已审核的投稿不能撤销' });
  }
  list.splice(idx, 1);
  writeSubmissions(list);
  res.json({ code: 0, message: '已撤销投稿' });
});

module.exports = router;
