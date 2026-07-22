// app.js — 登录/注册 + 头像直传 COS + 角色/打卡/漂流瓶 + 访问日志 + /api 兼容
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const auth = require('./middleware/auth');        // 解析 JWT -> req.userId
const avatarRouter = require('./routes/avatar');  // 头像上传
const checkinRouter = require('./routes/checkin');// 打卡/通用上传
const bottleRouter  = require('./routes/bottle');
const adminRouter   = require('./routes/admin');
const gallery       = require('./data/gallery');
const locations     = require('./data/locations');

// === 新增：COS SDK 与配置（用于列目录 + 生成签名 URL） ===
const COS = require('cos-nodejs-sdk-v5');

const app = express();
const {
  PORT = 3000,
  JWT_SECRET = 'dev-secret',
  COS_BUCKET,
  COS_REGION,
  PUBLIC_ASSET_DOMAIN,
  // 新增
  COS_SECRET_ID,
  COS_SECRET_KEY
} = process.env;

// 若未配置将不会影响其他功能，但 /checkin/photo* 接口将不可用
const cos = (COS_SECRET_ID && COS_SECRET_KEY && COS_BUCKET && COS_REGION)
  ? new COS({ SecretId: COS_SECRET_ID, SecretKey: COS_SECRET_KEY })
  : null;

/* ========= 反代环境下拿真实 IP ========= */
app.set('trust proxy', true);

/* ========= 基础中间件 ========= */
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

/* ========= /api 前缀兼容（Nginx 若未去掉前缀，后端自行剥离） ========= */
app.use('/api', (req, _res, next) => {
  req.url = req.url.replace(/^\/api(\/|$)/, '/');
  next();
});

/* ========= 访问日志（时间、IP、方法、URL、状态、耗时、UA、userId） ========= */
const LOG_DIR = path.join(__dirname, 'logs');
const ACCESS_LOG = path.join(LOG_DIR, 'access.log');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function getBearerUserId(req) {
  try {
    const raw = req.get('Authorization') || '';
    const token = raw.replace(/^Bearer\s+/i, '');
    if (!token) return null;
    const payload = jwt.verify(token, JWT_SECRET);
    return payload && payload.id ? payload.id : null;
  } catch {
    return null;
  }
}

function nowInBeijingISO() {
  const d = new Date();
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).formatToParts(d);

  const get = t => parts.find(p => p.type === t)?.value || '00';
  const yyyy = get('year');
  const mm   = get('month');
  const dd   = get('day');
  const hh   = get('hour');
  const mi   = get('minute');
  const ss   = get('second');
  const ms   = String(d.getMilliseconds()).padStart(3, '0');

  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}.${ms}+08:00`;
}

app.use((req, res, next) => {
  const start = Date.now();
  const xff = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip  = xff || req.ip || req.socket?.remoteAddress || '';

  res.on('finish', () => {
    const line = JSON.stringify({
      time: nowInBeijingISO(),
      ip,
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      length: Number(res.get('content-length') || 0),
      cost_ms: Date.now() - start,
      userId: req.userId || getBearerUserId(req),
      ua: req.headers['user-agent'] || ''
    }) + '\n';

    fs.appendFile(ACCESS_LOG, line, err => {
      if (err) console.error('[access-log] write fail:', err);
    });
  });

  next();
});

/* ========= 子路由 ========= */
app.use('/avatar',  avatarRouter);
app.use('/checkin', checkinRouter);
app.use('/bottle',  bottleRouter);
app.use('/admin',   auth, adminOnly, adminRouter);

/* ========= 文件路径 ========= */
const USERS_FILE   = path.join(__dirname, 'users.json');
const BOTTLES_FILE = path.join(__dirname, 'bottles.json');

/* ========= 常量 ========= */
const DEFAULT_AVATAR = 'https://sysuzngcxy-1322240898.cos.ap-guangzhou.myqcloud.com/NumberImage.png';
const DEFAULT_ROLE   = 'visitor'; // visitor | admin
// —— 登录/注册错误码（前端已按这些码处理）——
const ERR_USER_NOT_FOUND = 1001;
const ERR_BAD_PASSWORD   = 1002;
const ERR_USERNAME_TAKEN = 1003;

/* ========= 初始化存储 ========= */
function ensureFile(file, fallbackJson = '[]') {
  try {
    if (!fs.existsSync(file)) fs.writeFileSync(file, fallbackJson, 'utf8');
  } catch (e) {
    console.error('初始化文件失败：', file, e);
    process.exit(1);
  }
}
ensureFile(USERS_FILE, '[]');
ensureFile(BOTTLES_FILE, '[]');

/* ========= 通用读写 ========= */
function readUsers() {
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf8') || '[]';
    return JSON.parse(raw);
  } catch (e) {
    console.error('读取 users.json 失败：', e);
    return [];
  }
}
function writeUsers(list) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (e) {
    console.error('写入 users.json 失败：', e);
  }
}
function readBottles() {
  try {
    const raw = fs.readFileSync(BOTTLES_FILE, 'utf8') || '[]';
    return JSON.parse(raw);
  } catch (e) {
    console.error('读取 bottles.json 失败：', e);
    return [];
  }
}
function writeBottles(list) {
  try {
    fs.writeFileSync(BOTTLES_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (e) {
    console.error('写入 bottles.json 失败：', e);
  }
}

function findUserById(id) {
  return readUsers().find(u => u.id === id);
}
function toAvatarUrl(key) {
  if (!key) return null;
  const base = PUBLIC_ASSET_DOMAIN ||
    (COS_BUCKET && COS_REGION ? `https://${COS_BUCKET}.cos.${COS_REGION}.myqcloud.com` : '');
  return base ? `${base}/${encodeURI(key)}` : null;
}
function issueTokenAndPersist(user) {
  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
  const users = readUsers();
  const idx = users.findIndex(u => u.id === user.id);
  if (idx !== -1) {
    users[idx].lastToken = token;
    users[idx].updatedAt = Date.now();
    writeUsers(users);
  }
  return token;
}

// 统一成功响应（发 token + 返回 userInfo）
function respondSuccess(res, user) {
  const token = issueTokenAndPersist(user);
  const effectiveAvatar = user.avatarKey
    ? toAvatarUrl(user.avatarKey)
    : (user.avatar || DEFAULT_AVATAR);

  return res.json({
    code: 0,
    token,
    userInfo: {
      id: user.id,
      username: user.username,
      avatar: effectiveAvatar,
      phone: user.phone || '',
      role: user.role || DEFAULT_ROLE
    }
  });
}

// 创建用户（哈希密码 + 默认字段）
function createUser({ username, passwordPlain, phone }) {
  const hashedPassword = bcrypt.hashSync(passwordPlain, 8);
  const now = Date.now();
  return {
    id: now,
    username,
    password: hashedPassword,
    phone: phone || '',
    avatar: DEFAULT_AVATAR,
    avatarKey: null,
    role: DEFAULT_ROLE,
    unlockedLocations: [],
    lockingLocations: [],
    bottlesThrow: [],
    bottlesReceived: [],
    lastToken: '',
    createdAt: now,
    updatedAt: now
  };
}

/* ========= 新增：COS 辅助函数 ========= */

// 生成公开直链（桶或 CDN 是“公有读”时建议设置 PUBLIC_ASSET_DOMAIN）
function toPublicUrlByKey(key) {
  if (!key) return null;
  const base = PUBLIC_ASSET_DOMAIN ||
    (COS_BUCKET && COS_REGION ? `https://${COS_BUCKET}.cos.${COS_REGION}.myqcloud.com` : '');
  return base ? `${base}/${encodeURI(key)}` : null;
}

// 生成临时签名下载链接（桶为私有读时使用）
function signedUrlByKey(key, expiresSec = 600) {
  return new Promise(resolve => {
    if (!cos) return resolve(null);
    cos.getObjectUrl({
      Bucket: COS_BUCKET,
      Region: COS_REGION,
      Key: key,
      Sign: true,
      Expires: expiresSec
    }, (err, data) => resolve(err ? null : data && data.Url));
  });
}

// 统一返回“可访问”的 URL：优先走 PUBLIC 域名；否则回落到临时签名
async function toAccessibleUrl(key) {
  if (!key) return null;
  if (PUBLIC_ASSET_DOMAIN) return toPublicUrlByKey(key);
  // 没有 PUBLIC 域名时，用签名 URL；如果 cos 未配置则退回直链（可能 403）
  return await signedUrlByKey(key) || toPublicUrlByKey(key);
}

// 列出某个前缀下所有对象 Key（自动翻页）
async function listAllKeys(prefix) {
  if (!cos) return [];
  const keys = [];
  let Marker = '';
  while (true) {
    const data = await new Promise(resolve => {
      cos.getBucket({
        Bucket: COS_BUCKET,
        Region: COS_REGION,
        Prefix: prefix,
        Marker,
        'max-keys': 1000
      }, (err, ret) => resolve(err ? null : ret));
    });
    if (!data || !Array.isArray(data.Contents)) break;
    data.Contents.forEach(it => it && it.Key && keys.push(it.Key));
    if (!data.IsTruncated) break;
    Marker = data.NextMarker || '';
    if (!Marker) break;
  }
  return keys;
}

// 根据路径规则寻找“当前用户在指定地点的最新一张图”
// 规则：checkin/{userId}__{username}/{locationId}/{timestamp_random.ext}
async function findLatestCheckinKey(user, locationId) {
  if (!user || !locationId) return null;
  const id   = user.id;
  const name = (user.username || '').trim();
  const exts = /\.(png|jpe?g|webp|gif|bmp)$/i;

  // A. 先尝试“精确用户名”的前缀
  const prefixA = `checkin/${id}__${name}/${locationId}/`;
  let keys = await listAllKeys(prefixA);
  keys = keys.filter(k => exts.test(k))
             // 文件名以时间戳开头，字符串倒序≈时间倒序
             .sort((a, b) => b.localeCompare(a));
  if (keys[0]) return keys[0];

  // B. 用户名变更的宽松匹配：checkin/{id}__*
  const prefixB = `checkin/${id}__`;
  let keysB = await listAllKeys(prefixB);
  keysB = keysB
    .filter(k => k.startsWith(`checkin/${id}__`))
    .filter(k => {
      const parts = k.split('/');
      // parts: ["checkin", "{id}__{name}", "{locationId}", "{filename}"]
      return parts[2] == String(locationId);
    })
    .filter(k => exts.test(k))
    .sort((a, b) => b.localeCompare(a));
  return keysB[0] || null;
}

/* ========= 健康检查 ========= */
app.get('/health', (_req, res) => res.json({ ok: true, time: Date.now() }));

/* ========= 公开数据 ========= */
app.get('/home/gallery', (_req, res) => {
  const images = (gallery.images || []).slice(0, 6);
  res.json({ code: 0, data: { images } });
});

app.get('/locations', (_req, res) => {
  res.json({ code: 0, data: { locations: locations.locations || [] } });
});

/* ========= 排行榜（补回此路由！） ========= */
app.get('/rank/list', (_req, res) => {
  try {
    const users = readUsers();
    const list = users.map(u => {
      const unlocked = Array.isArray(u.unlockedLocations) ? u.unlockedLocations.length : 0;
      const locking  = Array.isArray(u.lockingLocations)  ? u.lockingLocations.length  : 0;
      const avatar   = u.avatarKey ? toAvatarUrl(u.avatarKey) : (u.avatar || DEFAULT_AVATAR);
      return {
        userId: u.id,
        username: u.username || '匿名用户',
        avatar,
        unlocked,
        locking,
        count: unlocked + locking,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt
      };
    })
    .sort((a, b) =>
      (b.unlocked - a.unlocked) ||
      (b.locking  - a.locking)  ||
      String(a.username).localeCompare(String(b.username), 'zh')
    )
    .map((it, idx) => ({ ...it, rank: idx + 1 }));

    res.json({ code: 0, list });
  } catch (e) {
    console.error('[rank/list] error:', e);
    res.status(500).json({ code: 1, message: '排行榜计算失败' });
  }
});

/* ========= 严格登录 / 注册 / 账号存在性 ========= */

// 是否存在该用户名（前端 safeCheckUserExists 用）
app.get('/auth/user_exists', (req, res) => {
  const username = (req.query.username || '').toString().trim();
  if (!username) return res.json({ code: 1, message: '缺少用户名' });
  const users = readUsers();
  const exists = !!users.find(u => u.username === username);
  return res.json({ code: 0, exists, data: { exists } });
});

// 严格登录：账号不存在返回 1001，不会自动创建
app.post('/auth/login', (req, res) => {
  let { username, password } = req.body || {};
  username = typeof username === 'string' ? username.trim() : '';
  password = typeof password === 'string' ? password.trim() : '';
  if (!username || !password) {
    return res.json({ code: 1, message: '用户名或密码不能为空' });
  }
  const users = readUsers();
  const user = users.find(u => u.username === username);
  if (!user) return res.json({ code: ERR_USER_NOT_FOUND, message: '账号不存在' });

  const ok = bcrypt.compareSync(password, user.password);
  if (!ok) return res.json({ code: ERR_BAD_PASSWORD, message: '密码错误' });

  return respondSuccess(res, user);
});

// 明确注册：重名返回 1003
app.post('/auth/register', (req, res) => {
  let { username, password, phone = '' } = req.body || {};
  username = typeof username === 'string' ? username.trim() : '';
  password = typeof password === 'string' ? password.trim() : '';
  phone    = typeof phone    === 'string' ? phone.trim()    : '';
  if (!username || !password) {
    return res.json({ code: 1, message: '用户名或密码不能为空' });
  }
  const users = readUsers();
  const exists = users.find(u => u.username === username);
  if (exists) return res.json({ code: ERR_USERNAME_TAKEN, message: '用户名已存在' });

  const newUser = createUser({ username, passwordPlain: password, phone });
  users.push(newUser); writeUsers(users);
  return respondSuccess(res, newUser);
});

/* ========= 登录 / 注册（兼容旧端；新端请优先用 /auth/*） ========= */
app.post('/login_or_register', (req, res) => {
  let { username, password, phone = '', mode, allowCreate, registerIfNotExist } = req.body || {};
  username = typeof username === 'string' ? username.trim() : '';
  password = typeof password === 'string' ? password.trim() : '';
  phone    = typeof phone    === 'string' ? phone.trim()    : '';

  if (!username || !password) {
    return res.json({ code: 1, message: '用户名或密码不能为空' });
  }

  // 归一化意图
  const isLoginExplicit =
    (String(mode).toLowerCase() === 'login') ||
    (allowCreate === false) ||
    (registerIfNotExist === false);

  const isRegisterExplicit =
    (String(mode).toLowerCase() === 'register') ||
    (allowCreate === true) ||
    (registerIfNotExist === true);

  const users  = readUsers();
  const exists = users.find(u => u.username === username);

  // —— 明确“登录” —— 不存在就明确报错
  if (isLoginExplicit) {
    if (!exists) {
      return res.json({ code: ERR_USER_NOT_FOUND, message: '账号不存在' });
    }
    const ok = bcrypt.compareSync(password, exists.password);
    if (!ok) {
      return res.json({ code: ERR_BAD_PASSWORD, message: '密码错误' });
    }
    return respondSuccess(res, exists);
  }

  // —— 明确“注册” —— 重名就报错
  if (isRegisterExplicit) {
    if (exists) {
      return res.json({ code: ERR_USERNAME_TAKEN, message: '用户名已存在' });
    }
    const newUser = createUser({ username, passwordPlain: password, phone });
    users.push(newUser);
    writeUsers(users);
    return respondSuccess(res, newUser);
  }

  // —— 旧端兼容：不带任何控制参数 => 维持“自动注册”的旧行为 —— 
  if (!exists) {
    const newUser = createUser({ username, passwordPlain: password, phone });
    users.push(newUser);
    writeUsers(users);
    return respondSuccess(res, newUser);
  }

  // 旧逻辑登录分支（旧端习惯 code:1 表示密码错，这里保留）
  const ok = bcrypt.compareSync(password, exists.password);
  if (!ok) return res.json({ code: 1, message: '密码错误' });
  return respondSuccess(res, exists);
});

/* ========= 当前用户信息 ========= */
app.get('/auth/me', auth, (req, res) => {
  const u = findUserById(req.userId);
  if (!u) return res.status(401).json({ code: 1, message: '用户不存在或已被删除' });
  const effectiveAvatar = u.avatarKey ? toAvatarUrl(u.avatarKey) : (u.avatar || DEFAULT_AVATAR);
  res.json({
    code: 0,
    userInfo: {
      id: u.id,
      username: u.username,
      avatar: effectiveAvatar,
      phone: u.phone || '',
      role: u.role || DEFAULT_ROLE,
      unlockedLocations: u.unlockedLocations || [],
      lockingLocations: u.lockingLocations || [],
      bottlesThrow: u.bottlesThrow || [],
      bottlesReceived: u.bottlesReceived || [],
      createdAt: u.createdAt,
      updatedAt: u.updatedAt
    }
  });
});

/* ========= 个人资料更新 ========= */
app.put('/user/profile', auth, (req, res) => {
  const { phone, username } = req.body || {};
  const users = readUsers();
  const idx = users.findIndex(u => u.id === req.userId);
  if (idx === -1) return res.status(404).json({ code: 1, message: '用户不存在' });

  if (typeof phone === 'string') users[idx].phone = phone.trim();
  if (typeof username === 'string' && username.trim()) users[idx].username = username.trim();
  users[idx].updatedAt = Date.now();
  writeUsers(users);

  return res.json({ code: 0, message: '更新成功' });
});

/* ========= 打卡解锁 ========= */
app.post('/user/unlock', auth, (req, res) => {
  const lid = Number((req.body || {}).locationId);
  if (!Number.isInteger(lid)) {
    return res.json({ code: 1, message: 'locationId 必须为 number/整数' });
  }

  const users = readUsers();
  const idx = users.findIndex(u => u.id === req.userId);
  if (idx === -1) return res.status(404).json({ code: 1, message: '用户不存在' });

  const u = users[idx];
  const toNumSet = (arr = []) => new Set(arr.map(n => Number(n)).filter(n => Number.isInteger(n)));
  const unlocked = toNumSet(u.unlockedLocations);
  const locking  = toNumSet(u.lockingLocations);

  locking.delete(lid);
  unlocked.add(lid);

  u.unlockedLocations = Array.from(unlocked);
  u.lockingLocations  = Array.from(locking);
  u.updatedAt = Date.now();
  writeUsers(users);

  return res.json({
    code: 0,
    unlockedLocations: u.unlockedLocations,
    lockingLocations : u.lockingLocations
  });
});

/* ========= 新增：查询“我在某地点最新打卡图片” ========= */
/**
 * 兼容两个地址：
 *  GET /checkin/photo          ?locationId=7
 *  GET /checkin/photo/latest   ?locationId=7
 * 返回：
 *  { code:0, url:"...", data:{ url:"...", key:"..." } }
 * 若无图片：{ code:0, url:null, data:{ url:null } }
 */
async function handleLatestMyCheckin(req, res) {
  try {
    if (!cos || !COS_BUCKET || !COS_REGION) {
      return res.status(500).json({ code: 1, message: 'COS 未配置，无法查询打卡图片' });
    }
    const lid = Number(req.query.locationId);
    if (!Number.isInteger(lid)) {
      return res.json({ code: 1, message: 'locationId 必须为整数' });
    }
    const me = findUserById(req.userId);
    if (!me) return res.status(401).json({ code: 1, message: '未登录或用户不存在' });

    const key = await findLatestCheckinKey(me, lid);
    if (!key) return res.json({ code: 0, url: null, data: { url: null } });

    const url = await toAccessibleUrl(key); // 自动选择公有直链或临时签名
    return res.json({ code: 0, url, data: { url, key } });
  } catch (e) {
    console.error('[checkin/photo] error:', e);
    return res.status(500).json({ code: 1, message: '查询失败' });
  }
}

app.get('/checkin/photo',        auth, handleLatestMyCheckin);
app.get('/checkin/photo/latest', auth, handleLatestMyCheckin);

/* ========= 漂流瓶 ========= */
app.post('/bottle/throw', auth, (req, res) => {
  const { text = '', photo } = req.body || {};
  if (!photo || typeof photo !== 'string') {
    return res.json({ code: 1, message: '缺少图片地址 photo' });
  }
  if (text.length > 120) {
    return res.json({ code: 1, message: '文字最多 120 字' });
  }

  const users = readUsers();
  const meIdx = users.findIndex(u => u.id === req.userId);
  if (meIdx === -1) return res.status(404).json({ code: 1, message: '用户不存在' });

  const bottles = readBottles();

  const id = Date.now();
  const now = Date.now();
  const one = {
    id,
    ownerId: req.userId,
    text: String(text || ''),
    photo: String(photo),
    uploadTime: now,
    pickedBy: null,
    pickTime: null
  };
  bottles.push(one);
  writeBottles(bottles);

  users[meIdx].bottlesThrow = users[meIdx].bottlesThrow || [];
  users[meIdx].bottlesThrow.push(id);
  users[meIdx].updatedAt = now;
  writeUsers(users);

  return res.json({ code: 0, bottle: one });
});

app.post('/bottle/pick', auth, (req, res) => {
  const users = readUsers();
  const meIdx = users.findIndex(u => String(u.id) === String(req.userId));
  if (meIdx === -1) return res.status(404).json({ code: 1, message: '用户不存在' });

  const bottles = readBottles();

  // 所有可捡候选（未被任何人捡过，且不是自己扔的）
  const candidateIdxs = bottles.reduce((arr, b, i) => {
    if (!b.pickedBy && String(b.ownerId) !== String(req.userId)) arr.push(i);
    return arr;
  }, []);

  if (candidateIdxs.length === 0) {
    return res.json({ code: 0, bottle: null, message: '暂无可捡的瓶子' });
  }

  // 随机挑一只；若并发被抢，再尝试一次
  function pickRandomIndex(excludeIdx = null) {
    const pool = excludeIdx == null
      ? candidateIdxs
      : candidateIdxs.filter(i => i !== excludeIdx);
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  let chosenIdx = pickRandomIndex();
  // 并发保护：再次确认还未被捡
  if (chosenIdx == null || bottles[chosenIdx].pickedBy) {
    const retryIdx = pickRandomIndex(chosenIdx);
    if (retryIdx == null || bottles[retryIdx].pickedBy) {
      return res.json({ code: 0, bottle: null, message: '手慢了，换一个试试' });
    }
    chosenIdx = retryIdx;
  }

  const now = Date.now();
  bottles[chosenIdx].pickedBy = req.userId;
  bottles[chosenIdx].pickTime = now;
  writeBottles(bottles);

  const chosen = bottles[chosenIdx];
  users[meIdx].bottlesReceived = Array.isArray(users[meIdx].bottlesReceived) ? users[meIdx].bottlesReceived : [];
  if (!users[meIdx].bottlesReceived.includes(chosen.id)) {
    users[meIdx].bottlesReceived.unshift(chosen.id);
  }
  users[meIdx].updatedAt = now;
  writeUsers(users);

  return res.json({ code: 0, bottle: chosen });
});


// app.js
app.get('/bottle/my-picked', auth, (req, res) => {
  try {
    const meId = String(req.userId);
    const all = (typeof readBottles === 'function' ? readBottles() : []) || [];

    // 汇总“我捡过的”，对同一瓶子取我最新的一次 pickTime
    const mineAll = all
      .map(b => {
        let myLatestPickTime = null;

        // 新结构：picks[]
        if (Array.isArray(b.picks) && b.picks.length) {
          for (const p of b.picks) {
            if (String(p.userId) === meId) {
              const t = Number(p.pickTime || 0);
              if (!Number.isNaN(t)) {
                myLatestPickTime = myLatestPickTime == null ? t : Math.max(myLatestPickTime, t);
              }
            }
          }
        }

        // 旧结构回退：pickedBy/pickTime
        if (myLatestPickTime == null && String(b.pickedBy) === meId) {
          const t = Number(b.pickTime || 0);
          if (!Number.isNaN(t)) myLatestPickTime = t;
        }

        if (myLatestPickTime == null) return null;

        return {
          id: b.id,
          ownerId: b.ownerId,
          ownerName: b.ownerName || '',
          ownerAvatar: b.ownerAvatar || '',
          text: b.text || '',
          photo: b.photo || '',
          uploadTime: Number(b.uploadTime || 0),
          pickTime: myLatestPickTime,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b.pickTime || 0) - (a.pickTime || 0)); // 最近拾取在前

    const q = req.query || {};
    const hasPaging = q.limit !== undefined || q.offset !== undefined;

    // 旧行为：不带分页参数，返回全量
    if (!hasPaging) {
      return res.json({ code: 0, list: mineAll });
    }

    // 新行为：分页
    const DEFAULT_LIMIT = 6;
    const MAX_LIMIT = 50;

    let limit = parseInt(q.limit, 10);
    if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_LIMIT;
    limit = Math.min(limit, MAX_LIMIT);

    let offset = parseInt(q.offset, 10);
    if (!Number.isFinite(offset) || offset < 0) offset = 0;

    const total = mineAll.length;
    if (offset > total) offset = total;

    const page = mineAll.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return res.json({
      code: 0,
      list: page,
      hasMore,
      total,
      offset,
      limit,
      nextOffset: Math.min(offset + limit, total),
    });
  } catch (e) {
    console.error('[GET /bottle/my-picked] error:', e);
    return res.status(500).json({ code: 1, message: 'server error' });
  }
});


app.get('/bottle/my-throw', auth, (_req, res) => {
  const bottles = readBottles()
    .filter(b => b.ownerId === _req.userId)
    .sort((a, b) => (b.uploadTime || 0) - (a.uploadTime || 0));
  return res.json({ code: 0, list: bottles });
});

app.get('/bottle/quota', auth, (req, res) => {
  const u = findUserById(req.userId);
  if (!u) return res.status(401).json({ code: 1, message: '未登录' });
  const quota = Array.isArray(u.unlockedLocations) ? u.unlockedLocations.length : 0;
  return res.json({ code: 0, quota });
});

/* ========= 管理端 ========= */
function adminOnly(req, res, next) {
  const u = findUserById(req.userId);
  if (!u) return res.status(401).json({ code: 1, message: '未登录' });
  if ((u.role || DEFAULT_ROLE) !== 'admin') {
    return res.status(403).json({ code: 1, message: '无管理员权限' });
  }
  next();
}

app.get('/admin/users', auth, adminOnly, (_req, res) => {
  const users = readUsers().map(u => ({
    id: u.id,
    username: u.username,
    phone: u.phone || '',
    role: u.role || DEFAULT_ROLE,
    unlockedLocations: u.unlockedLocations || [],
    lockingLocations: u.lockingLocations || [],
    bottlesThrow: u.bottlesThrow || [],
    bottlesReceived: u.bottlesReceived || [],
    createdAt: u.createdAt,
    updatedAt: u.updatedAt
  }));
  res.json({ code: 0, users });
});

/* ========= 兜底与错误 ========= */
app.use((req, res) => res.status(404).json({ code: 1, message: 'Not Found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ code: 1, message: '服务器错误' });
});

/* ========= 启动 ========= */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running at http://0.0.0.0:${PORT}`);
});
