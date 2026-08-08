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

// 北京时间（UTC+8）的日期，格式 YYYY-MM-DD，用于“每天”的投票与限额
function beijingDay(ts = Date.now()) {
  return new Date(Number(ts) + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

// 用户“真实姓名”作为投票身份（防止同一个人注册多个账号刷票）
function realNameOfUser(u) {
  return String((u && (u.realName || u.phone || u.username)) || '').trim();
}

// 一条投票记录的“身份键”：优先用注册时的真实姓名
function voteKey(v, usersById) {
  if (v && v.name) return String(v.name).trim();
  const u = usersById && usersById[String(v && v.userId)];
  return u ? realNameOfUser(u) : String((v && v.userId) || '');
}

// 一份投稿的“归属键”：按作者真实姓名归属（防止同名账号绕过限投）
function ownerKey(s, usersById) {
  if (s && s.realName) return String(s.realName).trim();
  const u = usersById && usersById[String(s && s.userId)];
  if (u) return realNameOfUser(u);
  return String((s && s.username) || '').trim();
}

// 统计某“真实姓名”在某天总共投出的票数（跨所有账号与作品）
function countUserVotesToday(list, myKey, day, usersById) {
  let n = 0;
  for (const s of list) {
    if (!Array.isArray(s.votes)) continue;
    for (const v of s.votes) {
      if (voteKey(v, usersById) === myKey && v.day === day) n += 1;
    }
  }
  return n;
}

// 构造“当前查看者”上下文（用于投票状态与限额）
function buildViewerContext(userId) {
  if (userId == null) return null;
  const users = readUsers();
  const me = users.find(u => u.id === userId);
  const usersById = users.reduce((m, u) => { m[String(u.id)] = u; return m; }, {});
  return {
    userId,
    myKey: realNameOfUser(me),
    usersById
  };
}

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
function publicView(s, withUser = false, viewer = null) {
  const votes = Array.isArray(s.votes) ? s.votes : [];
  const today = beijingDay();
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
    likeCount: votes.length,
    votedToday: viewer != null && votes.some(v => voteKey(v, viewer.usersById) === viewer.myKey && v.day === today),
    appealReason: s.appealReason || '',
    appealTime: s.appealTime || 0,
    appealStatus: s.appealStatus || '',
    appealResult: s.appealResult || '',
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
      maxVotesPerDay: awards.maxVotesPerDay,
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
  const usersById = users.reduce((m, u) => { m[String(u.id)] = u; return m; }, {});
  const myKey = realNameOfUser(me);

  // 防止重复提交：同一真实姓名同一奖项已有 已通过 / 审核中 / 申诉中 的作品
  const active = readSubmissions().find(s =>
    ownerKey(s, usersById) === myKey &&
    s.category === category &&
    (s.status === 'pending' || s.status === 'approved' || (s.status === 'rejected' && s.appealStatus === 'pending'))
  );
  if (active) {
    const stateText = active.status === 'approved'
      ? '已通过'
      : active.status === 'pending'
        ? '审核中'
        : '申诉中';
    return res.json({
      code: 2,
      message: `你已提交过${cat.name}（${stateText}）。每个奖项每人最多投稿 1 个作品，请确认是否选择了正确的类别，或前往删除原有作品后再提交。`,
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
    realName: realNameOfUser(me),
    avatar: me.avatar || '',
    status: 'pending',
    featured: false,
    votes: [],
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
  const viewer = buildViewerContext(req.userId);
  const page = list.slice(0, limit).map(s => publicView(s, true, viewer));
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
    .map(s => publicView(s, true, buildViewerContext(_req.userId)));
  res.json({ code: 0, list });
});

// ====== 6c. 投票 / 取消当天投票（仅已通过作品，必须登录） ======
// POST /submissions/:id/vote  { action: 'vote' | 'unvote' }
// 规则：每个用户每天最多投 maxVotesPerDay 票；同一作品每天最多 1 票；
// 再次点击同一作品 = 取消当天的投票；第二天可重新投票。
router.post('/:id/vote', auth, (req, res) => {
  const list = readSubmissions();
  const item = list.find(s => String(s.id) === String(req.params.id));
  if (!item) return res.status(404).json({ code: 1, message: '作品不存在' });
  if (item.status !== 'approved') {
    return res.json({ code: 1, message: '作品通过审核后才能投票' });
  }

  const day = beijingDay();
  const maxVotesPerDay = awards.maxVotesPerDay || 3;
  const users = readUsers();
  const me = users.find(u => u.id === req.userId);
  if (!me) return res.status(401).json({ code: 1, message: '用户不存在' });
  const usersById = users.reduce((m, u) => { m[String(u.id)] = u; return m; }, {});
  const myKey = realNameOfUser(me);
  let votes = Array.isArray(item.votes) ? item.votes : [];
  const idx = votes.findIndex(v => voteKey(v, usersById) === myKey && v.day === day);
  const action = String(req.body?.action || 'vote');

  if (action === 'unvote') {
    // 取消当天投票
    if (idx !== -1) votes.splice(idx, 1);
  } else {
    if (idx !== -1) {
      // 已投过当天 → 再次点击 = 取消当天投票
      votes.splice(idx, 1);
    } else {
      const usedToday = countUserVotesToday(list, myKey, day, usersById);
      if (usedToday >= maxVotesPerDay) {
        return res.json({ code: 3, message: `每天最多投 ${maxVotesPerDay} 票，明天再来吧` });
      }
      votes.push({ userId: req.userId, name: myKey, day, ts: Date.now() });
    }
  }

  item.votes = votes;
  item.updatedAt = Date.now();
  writeSubmissions(list);

  const votedToday = votes.some(v => voteKey(v, usersById) === myKey && v.day === day);
  const usedToday = countUserVotesToday(list, myKey, day, usersById);
  res.json({
    code: 0,
    likeCount: votes.length,
    votedToday,
    usedToday,
    remaining: Math.max(0, maxVotesPerDay - usedToday)
  });
});

// ====== 6d. 今日剩余票数 ======
// GET /submissions/votes/quota
router.get('/votes/quota', auth, (_req, res) => {
  const day = beijingDay();
  const users = readUsers();
  const me = users.find(u => u.id === _req.userId);
  if (!me) return res.status(401).json({ code: 1, message: '用户不存在' });
  const usersById = users.reduce((m, u) => { m[String(u.id)] = u; return m; }, {});
  const usedToday = countUserVotesToday(readSubmissions(), realNameOfUser(me), day, usersById);
  const maxVotesPerDay = awards.maxVotesPerDay || 3;
  res.json({
    code: 0,
    data: {
      maxVotesPerDay,
      usedToday,
      remaining: Math.max(0, maxVotesPerDay - usedToday)
    }
  });
});

// ====== 6e. 投稿详情（仅本人） ======
// GET /submissions/:id
router.get('/:id', auth, (req, res) => {
  const item = readSubmissions().find(s => String(s.id) === String(req.params.id));
  if (!item) return res.status(404).json({ code: 1, message: '投稿不存在' });
  if (String(item.userId) !== String(req.userId)) {
    return res.status(403).json({ code: 1, message: '只能查看自己的投稿' });
  }
  res.json({ code: 0, data: { submission: publicView(item, true, buildViewerContext(req.userId)) } });
});

// ====== 6f. 提交申诉（仅被驳回的投稿） ======
// POST /submissions/:id/appeal  { reason }
router.post('/:id/appeal', auth, (req, res) => {
  const list = readSubmissions();
  const item = list.find(s => String(s.id) === String(req.params.id));
  if (!item) return res.status(404).json({ code: 1, message: '投稿不存在' });
  if (String(item.userId) !== String(req.userId)) {
    return res.status(403).json({ code: 1, message: '只能操作自己的投稿' });
  }
  if (item.status !== 'rejected') {
    return res.json({ code: 1, message: '只有被驳回的投稿可以申诉' });
  }
  if (item.appealStatus === 'pending') {
    return res.json({ code: 1, message: '申诉处理中，请耐心等待' });
  }

  const reason = String(req.body?.reason || '').trim();
  if (!reason) return res.json({ code: 1, message: '请填写申诉理由' });
  if (reason.length > 300) return res.json({ code: 1, message: '申诉理由最多 300 个字' });

  item.appealReason = reason;
  item.appealTime = Date.now();
  item.appealStatus = 'pending';
  item.appealResult = '';
  item.updatedAt = Date.now();
  writeSubmissions(list);

  res.json({ code: 0, message: '申诉已提交，等待管理员复核', data: { submission: publicView(item, true, buildViewerContext(req.userId)) } });
});

// ====== 7. 删除投稿（仅自己；任何状态都可删除，删除后无法找回） ======
// DELETE /submissions/:id
router.delete('/:id', auth, (req, res) => {
  const list = readSubmissions();
  const idx = list.findIndex(s => String(s.id) === String(req.params.id));
  if (idx === -1) return res.status(404).json({ code: 1, message: '投稿不存在' });
  if (String(list[idx].userId) !== String(req.userId)) {
    return res.status(403).json({ code: 1, message: '只能操作自己的投稿' });
  }

  // 尽力删除云端图片（失败不影响记录删除）
  const item = list[idx];
  if (cos && Array.isArray(item.images)) {
    item.images.forEach(img => {
      if (img && img.key) {
        cos.deleteObject({ Bucket: COS_BUCKET, Region: COS_REGION, Key: img.key }, () => {});
      }
    });
  }

  list.splice(idx, 1);
  writeSubmissions(list);
  res.json({ code: 0, message: '已删除，删除后无法找回' });
});

module.exports = router;
module.exports._test = { beijingDay, countUserVotesToday, realNameOfUser, voteKey, ownerKey };
