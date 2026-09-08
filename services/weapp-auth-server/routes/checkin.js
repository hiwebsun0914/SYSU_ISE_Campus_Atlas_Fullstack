// routes/checkin.js
require('dotenv').config();

const router = require('express').Router();
const COS = require('cos-nodejs-sdk-v5');
const STS = require('qcloud-cos-sts');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');
const { getLocation } = require('../lib/locationSettings');
const { deferLegacyPendingPoints } = require('../lib/checkinPoints');

// ==== 环境变量 ====
const {
  COS_BUCKET, COS_REGION, PUBLIC_ASSET_DOMAIN,
  TENCENT_SECRET_ID, TENCENT_SECRET_KEY,
  STS_DURATION = 300
} = process.env;

const CHECKIN_MAIN_MAX_BYTES = 2 * 1024 * 1024;
const CHECKIN_THUMBNAIL_MAX_BYTES = 200 * 1024;
const CHECKIN_IMAGE_CONTENT_TYPE = 'image/webp';
const CHECKIN_JPEG_CONTENT_TYPE = 'image/jpeg';
const CHECKIN_TEMP_MAX_BYTES = 20 * 1024 * 1024;
const FALLBACK_RATE_WINDOW_MS = 60_000;
const FALLBACK_RATE_MAX = 2;
const FALLBACK_MAX_CONCURRENCY = 2;
const fallbackAttempts = new Map();
let activeFallbacks = 0;
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

// ==== COS 实例 ====
const cos = new COS({ SecretId: TENCENT_SECRET_ID, SecretKey: TENCENT_SECRET_KEY });

// ==== users.json 读取 ====
const USERS_FILE = path.resolve(process.env.USERS_FILE || path.join(__dirname, '..', 'users.json'));
function readUsers() {
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf8') || '[]';
    const users = JSON.parse(raw);
    if (deferLegacyPendingPoints(users)) {
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    }
    return users;
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

function normalizeUserCheckins(user) {
  user.unlockedLocations = Array.isArray(user.unlockedLocations) ? user.unlockedLocations.map(Number) : [];
  user.lockingLocations = Array.isArray(user.lockingLocations) ? user.lockingLocations.map(Number) : [];
  user.pendingCheckins = Array.isArray(user.pendingCheckins) ? user.pendingCheckins : [];
  user.checkinReviewRecords = Array.isArray(user.checkinReviewRecords) ? user.checkinReviewRecords : [];
  user.points = Number.isFinite(Number(user.points)) ? Number(user.points) : 0;
  return user;
}

function publicReviewRecords(user) {
  return [...user.checkinReviewRecords]
    .sort((a, b) => Number(b.reviewedAt || b.appealedAt || 0) - Number(a.reviewedAt || a.appealedAt || 0))
    .slice(0, 50)
    .map(item => ({
      locationId: Number(item.locationId),
      status: item.status,
      note: item.note || '',
      photo: item.photo || (item.key ? toUrl(item.key) : ''),
      key: item.key || '',
      thumbnail: item.thumbnail || (item.thumbnailKey ? toUrl(item.thumbnailKey) : ''),
      thumbnailKey: item.thumbnailKey || '',
      submittedAt: Number(item.submittedAt || 0),
      reviewedAt: Number(item.reviewedAt || 0),
      appealStatus: item.appealStatus || '',
      appealReason: item.appealReason || '',
      appealedAt: Number(item.appealedAt || 0)
    }));
}

/** 待审核打卡记录的公开视图（含照片直链，供“我的投稿记录”页展示） */
function publicPendingCheckins(user) {
  return user.pendingCheckins.map(item => ({
    locationId: Number(item.locationId),
    photo: item.photo || (item.key ? toUrl(item.key) : ''),
    key: item.key || '',
    thumbnail: item.thumbnail || (item.thumbnailKey ? toUrl(item.thumbnailKey) : ''),
    thumbnailKey: item.thumbnailKey || '',
    submittedAt: Number(item.submittedAt || 0),
    appealStatus: item.appealStatus || '',
    appealReason: item.appealReason || ''
  }));
}

function checkSubmissionAvailability(req, res) {
  const locationId = Number(req.body?.locationId);
  const location = Number.isInteger(locationId) && locationId > 0 ? getLocation(locationId) : null;
  // 已下线（retired）的打卡点同样拒绝新提交，但历史记录不受影响
  if (!location || location.retired) {
    res.status(400).json({ code: 1, message: '打卡地点无效' });
    return null;
  }
  const user = getUserById(req.userId);
  if (!user) {
    res.status(404).json({ code: 1, message: '用户不存在' });
    return null;
  }
  normalizeUserCheckins(user);
  if (user.unlockedLocations.includes(locationId)) {
    res.status(409).json({ code: 1, errorCode: 'CHECKIN_ALREADY_APPROVED', message: '该地点已经打卡成功，无需重复提交' });
    return null;
  }
  if (user.lockingLocations.includes(locationId)) {
    res.status(409).json({ code: 1, errorCode: 'CHECKIN_REVIEW_PENDING', message: '该地点正在审核中，请等待审核结果后再操作' });
    return null;
  }
  return { user, locationId };
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

// checkin/<uid>__<slug>/<locationId>/<ts_rand>.<ext>
function buildKey(req, ext = 'jpg', variant = '') {
  const u = req.user?.username
    ? { username: req.user.username }
    : getUserById(req.userId) || {};
  const uid = req.userId;
  const slug = safeSlug(u.username || 'user');
  const loc = (req.body?.locationId || 'general').toString();
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const suffix = variant ? `_${variant}` : '';
  return `checkin/${uid}__${slug}/${loc}/${ts}_${rand}${suffix}.${safeExt(ext)}`;
}

function headSize(head) {
  return Number(head?.headers?.['content-length'] || head?.headers?.['Content-Length'] || 0);
}

function headType(head) {
  return String(head?.headers?.['content-type'] || head?.headers?.['Content-Type'] || '').split(';')[0].toLowerCase();
}

function validateUploadedImage(head, { maxBytes, expectedSize, label, requireWebp = false, requireType = '' }) {
  const actualSize = headSize(head);
  if (!actualSize) return `${label}为空或无法读取大小`;
  if (actualSize > maxBytes) return `${label}超过大小上限`;
  if (expectedSize && Math.abs(actualSize - Number(expectedSize)) > 2048) return `${label}大小不匹配`;
  const expectedType = requireType || (requireWebp ? CHECKIN_IMAGE_CONTENT_TYPE : '');
  if (expectedType && headType(head) && headType(head) !== expectedType) return `${label}图片格式不匹配`;
  return '';
}

function optimizedContentType(ext) {
  return safeExt(ext) === 'webp' ? CHECKIN_IMAGE_CONTENT_TYPE : CHECKIN_JPEG_CONTENT_TYPE;
}

function callCos(method, params) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (error, data) => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve(data);
    };
    const result = cos[method](params, done);
    if (result && typeof result.then === 'function') result.then(data => done(null, data), done);
  });
}

async function webpWithinReviewLimit(input, steps, maxBytes) {
  for (const { edge, quality } of steps) {
    const output = await sharp(input, { failOn: 'none', limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .webp({ quality })
      .toBuffer();
    if (output.length > 0 && output.length <= maxBytes) return output;
  }
  throw new Error('SERVER_IMAGE_PROCESSING_FAILED');
}

function consumeFallbackAttempt(userId) {
  const now = Date.now();
  const recent = (fallbackAttempts.get(String(userId)) || []).filter(time => now - time < FALLBACK_RATE_WINDOW_MS);
  if (recent.length >= FALLBACK_RATE_MAX) return false;
  recent.push(now);
  fallbackAttempts.set(String(userId), recent);
  return true;
}

function deleteTemporaryObject(key, context) {
  callCos('deleteObject', { Bucket: COS_BUCKET, Region: COS_REGION, Key: key })
    .catch(error => console.warn(`[checkin] ${context} temporary cleanup failed:`, key, error?.code || error?.message || error));
}

async function cleanupExpiredTemporaryObjects(now = Date.now()) {
  const cutoff = now - 24 * 60 * 60 * 1000;
  try {
    const listed = await callCos('getBucket', { Bucket: COS_BUCKET, Region: COS_REGION, Prefix: 'checkin-temp/', MaxKeys: 1000 });
    const expired = (listed.Contents || []).filter(item => new Date(item.LastModified).getTime() < cutoff);
    await Promise.all(expired.map(item => callCos('deleteObject', { Bucket: COS_BUCKET, Region: COS_REGION, Key: item.Key })
      .catch(error => console.warn('[checkin] expired temporary cleanup failed:', item.Key, error?.code || error?.message || error))));
    if (expired.length) console.log(`[checkin] removed ${expired.length} expired temporary image(s)`);
  } catch (error) {
    console.warn('[checkin] temporary lifecycle scan failed:', error?.code || error?.message || error);
  }
}

if (COS_BUCKET && COS_REGION && TENCENT_SECRET_ID && TENCENT_SECRET_KEY) {
  const cleanupTimer = setInterval(() => cleanupExpiredTemporaryObjects(), 60 * 60 * 1000);
  cleanupTimer.unref?.();
}

async function applyImmutableMetadata(key, contentType) {
  const copySource = `${COS_BUCKET}.cos.${COS_REGION}.myqcloud.com/${encodeURI(key)}`;
  await cos.putObjectCopy({
    Bucket: COS_BUCKET,
    Region: COS_REGION,
    Key: key,
    CopySource: copySource,
    MetadataDirective: 'Replaced',
    ContentType: contentType || CHECKIN_IMAGE_CONTENT_TYPE,
    CacheControl: IMMUTABLE_CACHE_CONTROL,
    ACL: 'public-read'
  });
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
  return [`checkin/${uid}__${slug}/`];
}
// 校验某 key 是否属于当前用户的打卡目录
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
  if (!checkSubmissionAvailability(req, res)) return;
  const requestedExt = safeExt(req.body?.ext || 'jpg');
  const optimizedExt = requestedExt === 'webp' ? 'webp' : 'jpg';
  const contentType = optimizedContentType(optimizedExt);
  const key = buildKey(req, optimizedExt, 'main');
  const thumbnailKey = key.replace(new RegExp(`_main\\.${optimizedExt}$`), `_thumb.${optimizedExt}`);
  const sign = targetKey => new Promise((resolve, reject) => {
    cos.getObjectUrl(
      { Bucket: COS_BUCKET, Region: COS_REGION, Key: targetKey, Method: 'PUT', Sign: true, Expires: 300 },
      (err, data) => err || !data?.Url ? reject(err || new Error('missing signed URL')) : resolve(data.Url)
    );
  });

  Promise.all([sign(key), sign(thumbnailKey)])
    .then(([putUrl, thumbnailPutUrl]) => res.json({
      code: 0,
      data: {
        // Legacy aliases keep an older web client able to upload its single image.
        key,
        putUrl,
        main: { key, putUrl, contentType },
        thumbnail: { key: thumbnailKey, putUrl: thumbnailPutUrl, contentType },
        limits: { mainBytes: CHECKIN_MAIN_MAX_BYTES, thumbnailBytes: CHECKIN_THUMBNAIL_MAX_BYTES }
      }
    }))
    .catch(error => {
      console.error('[PRESIGN ERROR]', error);
      res.status(500).json({ code: 1, message: '预签名失败' });
    });
});

// Browser-side decoding can fail on very large photos or memory-constrained
// WebViews. In that case only, upload the camera file to a private temporary key
// and let the server create review-safe derivatives without lowering below 1280px.
router.post('/fallback/presign', auth, (req, res) => {
  if (!checkSubmissionAvailability(req, res)) return;
  const ext = safeExt(req.body?.ext || 'jpg');
  const sourceType = ext === 'png' ? 'image/png' : ext === 'webp' ? CHECKIN_IMAGE_CONTENT_TYPE : CHECKIN_JPEG_CONTENT_TYPE;
  const size = Number(req.body?.size || 0);
  if (!size || size > CHECKIN_TEMP_MAX_BYTES) {
    return res.status(400).json({ code: 1, message: '照片处理失败，请重新拍摄' });
  }
  const normalKey = buildKey(req, ext, 'source');
  const key = normalKey.replace(/^checkin\//, 'checkin-temp/');
  cos.getObjectUrl(
    { Bucket: COS_BUCKET, Region: COS_REGION, Key: key, Method: 'PUT', Sign: true, Expires: 300, Headers: { 'x-cos-acl': 'private' } },
    (error, data) => {
      if (error || !data?.Url) return res.status(500).json({ code: 1, message: '预签名失败' });
      return res.json({ code: 0, data: { key, putUrl: data.Url, contentType: sourceType, headers: { 'x-cos-acl': 'private' }, maxBytes: CHECKIN_TEMP_MAX_BYTES } });
    }
  );
});

router.post('/fallback/process', auth, async (req, res) => {
  if (!checkSubmissionAvailability(req, res)) return;
  if (!consumeFallbackAttempt(req.userId)) {
    res.set('Retry-After', '60');
    return res.status(429).json({ code: 1, errorCode: 'CHECKIN_PROCESS_RATE_LIMITED', message: '照片处理失败，请稍后重试' });
  }
  if (activeFallbacks >= FALLBACK_MAX_CONCURRENCY) {
    res.set('Retry-After', '10');
    return res.status(503).json({ code: 1, errorCode: 'CHECKIN_PROCESS_BUSY', message: '照片处理失败，请稍后重试' });
  }
  const key = String(req.body?.key || '');
  const uid = req.userId;
  const slug = getUserSlug(req);
  if (!key.startsWith(`checkin-temp/${uid}__${slug}/`) || !/_source\.(?:png|webp|jpe?g)$/i.test(key)) {
    return res.status(400).json({ code: 1, message: '非法临时图片 key' });
  }

  activeFallbacks += 1;
  try {
    const head = await callCos('headObject', { Bucket: COS_BUCKET, Region: COS_REGION, Key: key });
    const sourceError = validateUploadedImage(head, {
      maxBytes: CHECKIN_TEMP_MAX_BYTES,
      expectedSize: req.body?.size,
      label: '临时照片'
    });
    if (sourceError) return res.status(400).json({ code: 1, message: sourceError });

    const object = await callCos('getObject', { Bucket: COS_BUCKET, Region: COS_REGION, Key: key });
    const input = Buffer.isBuffer(object.Body) ? object.Body : Buffer.from(object.Body || []);
    const main = await webpWithinReviewLimit(input, [
      { edge: 1600, quality: 78 },
      { edge: 1440, quality: 68 },
      { edge: 1280, quality: 58 },
      { edge: 1280, quality: 48 },
      { edge: 1280, quality: 38 }
    ], CHECKIN_MAIN_MAX_BYTES);
    const thumbnail = await webpWithinReviewLimit(input, [
      { edge: 480, quality: 72 },
      { edge: 400, quality: 60 },
      { edge: 320, quality: 50 }
    ], CHECKIN_THUMBNAIL_MAX_BYTES);
    const mainKey = key.replace(/^checkin-temp\//, 'checkin/').replace(/_source\.[^.]+$/, '_main.webp');
    const thumbnailKey = mainKey.replace(/_main\.webp$/, '_thumb.webp');
    const upload = (derivedKey, body) => callCos('putObject', {
      Bucket: COS_BUCKET,
      Region: COS_REGION,
      Key: derivedKey,
      Body: body,
      ContentLength: body.length,
      ContentType: CHECKIN_IMAGE_CONTENT_TYPE,
      CacheControl: IMMUTABLE_CACHE_CONTROL,
      ACL: 'public-read'
    });
    await Promise.all([upload(mainKey, main), upload(thumbnailKey, thumbnail)]);
    return res.json({
      code: 0,
      data: {
        main: { key: mainKey, size: main.length },
        thumbnail: { key: thumbnailKey, size: thumbnail.length },
        mime: CHECKIN_IMAGE_CONTENT_TYPE,
        temporaryKey: key
      }
    });
  } catch (error) {
    console.error('[checkin/fallback/process] error:', error?.code || error?.message || error);
    return res.status(422).json({ code: 1, message: '照片处理失败，请重新拍摄' });
  } finally {
    activeFallbacks -= 1;
  }
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
  const { key, size, thumbnailKey, thumbnailSize, mime, temporaryKey } = req.body || {};
  const uid = req.userId;
  const slug = safeSlug(req.user?.username || 'user');

  const ownedPrefix = `checkin/${uid}__${slug}/`;

  if (!key || !key.startsWith(ownedPrefix)) {
    return res.status(400).json({ code: 1, message: '非法 key' });
  }
  if (thumbnailKey && (!thumbnailKey.startsWith(ownedPrefix) || !/_thumb\.(?:webp|jpe?g)$/i.test(thumbnailKey))) {
    return res.status(400).json({ code: 1, message: '非法缩略图 key' });
  }

  const currentUser = getUserById(uid);
  if (currentUser) {
    normalizeUserCheckins(currentUser);
    const existing = currentUser.pendingCheckins.find(item => item.key === key);
    if (existing) {
      if (temporaryKey && temporaryKey.startsWith(`checkin-temp/${uid}__${slug}/`)) deleteTemporaryObject(temporaryKey, 'idempotent commit');
      return res.json({ code: 0, key, url: existing.photo || toUrl(key), thumbnail: existing.thumbnail || '', awardedPoints: 0, reviewStatus: 'pending', idempotent: true });
    }
  }

  const availability = checkSubmissionAvailability(req, res);
  if (!availability) return;

  const head = await cos.headObject({ Bucket: COS_BUCKET, Region: COS_REGION, Key: key }).catch(() => null);
  if (!head) return res.status(400).json({ code: 1, message: '对象不存在或未上传成功' });
  const submittedMime = String(mime || '').toLowerCase();
  const optimizedMime = [CHECKIN_IMAGE_CONTENT_TYPE, CHECKIN_JPEG_CONTENT_TYPE].includes(submittedMime) ? submittedMime : '';
  if (thumbnailKey && !optimizedMime) {
    return res.status(400).json({ code: 1, message: '图片格式不支持' });
  }
  const mainError = validateUploadedImage(head, {
    maxBytes: CHECKIN_MAIN_MAX_BYTES,
    expectedSize: size,
    label: '打卡图片',
    requireType: optimizedMime
  });
  if (mainError) return res.status(400).json({ code: 1, message: mainError });

  let thumbnailHead = null;
  if (thumbnailKey) {
    thumbnailHead = await cos.headObject({ Bucket: COS_BUCKET, Region: COS_REGION, Key: thumbnailKey }).catch(() => null);
    if (!thumbnailHead) return res.status(400).json({ code: 1, message: '缩略图不存在或未上传成功' });
    const thumbnailError = validateUploadedImage(thumbnailHead, {
      maxBytes: CHECKIN_THUMBNAIL_MAX_BYTES,
      expectedSize: thumbnailSize,
      label: '缩略图',
      requireType: optimizedMime
    });
    if (thumbnailError) return res.status(400).json({ code: 1, message: thumbnailError });
  }


  try {
    await Promise.all([
      applyImmutableMetadata(key, headType(head) || optimizedMime || CHECKIN_JPEG_CONTENT_TYPE),
      thumbnailKey ? applyImmutableMetadata(thumbnailKey, headType(thumbnailHead) || optimizedMime || CHECKIN_IMAGE_CONTENT_TYPE) : Promise.resolve()
    ]);
  } catch (error) {
    console.error('[checkin/commit] cache metadata error:', error?.code || error?.message || error);
    return res.status(502).json({ code: 1, message: '图片缓存配置失败，请重试' });
  }

  // === 关键：把 locationId 写入 users.json 的 lockingLocations（仅数字） ===
  // 说明：前端打卡时会把 locationId 一并传给 commit
  const locNum = Number(req.body?.locationId);
  if (Number.isInteger(locNum)) {
    const users = readUsers();
    const idx = users.findIndex(u => String(u.id) === String(uid));
    if (idx !== -1) {
      const u = users[idx];
      normalizeUserCheckins(u);

      // 已解锁则不再加入待审；未解锁也未待审时加入
      if (!u.unlockedLocations.includes(locNum) && !u.lockingLocations.includes(locNum)) {
        u.lockingLocations.push(locNum);
      }
      if (!u.unlockedLocations.includes(locNum)) {
        const pending = {
          locationId: locNum,
          key,
          photo: toUrl(key),
          thumbnailKey: thumbnailKey || '',
          thumbnail: thumbnailKey ? toUrl(thumbnailKey) : '',
          submittedAt: Date.now(),
          pointsDeferred: true,
          appealStatus: ''
        };
        const pendingIndex = u.pendingCheckins.findIndex(item => Number(item.locationId) === locNum);
        if (pendingIndex === -1) u.pendingCheckins.push(pending);
        else u.pendingCheckins[pendingIndex] = pending;
      }
      u.updatedAt = Date.now();
      writeUsers(users);
    }
  }

  res.json({
    code: 0,
    key,
    url: toUrl(key),
    thumbnail: thumbnailKey ? toUrl(thumbnailKey) : '',
    awardedPoints: 0,
    reviewStatus: 'pending',
    message: '照片已提交审核，审核通过后计入积分'
  });
  if (temporaryKey && temporaryKey.startsWith(`checkin-temp/${uid}__${slug}/`)) deleteTemporaryObject(temporaryKey, 'committed');
});

router._test = {
  CHECKIN_MAIN_MAX_BYTES,
  CHECKIN_THUMBNAIL_MAX_BYTES,
  CHECKIN_IMAGE_CONTENT_TYPE,
  IMMUTABLE_CACHE_CONTROL,
  validateUploadedImage,
  cleanupExpiredTemporaryObjects
};

// ==== D. 获取打卡状态 ====
router.get('/status', auth, (req, res) => {
  try {
    const user = getUserById(req.userId);
    if (!user) return res.status(404).json({ code: 1, message: '用户不存在' });

    normalizeUserCheckins(user);
    const unlocked = user.unlockedLocations;
    const locking  = user.lockingLocations;

    return res.json({
      code: 0,
      unlockedLocations: unlocked,
      lockingLocations : locking,
      pendingCheckins: publicPendingCheckins(user),
      checkinReviewRecords: publicReviewRecords(user),
      unlockedCount: unlocked.length,
      lockingCount : locking.length,
      total: unlocked.length + locking.length
    });
  } catch (e) {
    console.error('[checkin/status] error:', e);
    return res.status(500).json({ code: 1, message: '获取打卡状态失败' });
  }
});


// ==== E. 地图 GPS 打卡（已关闭即时计分）====
// 规则：所有打卡统一走「50 米范围内拍照上传 → 审核通过」流程，
// 本接口不再直接加分，避免绕过审核刷分；仅保留状态提示能力。
router.post('/map', auth, (req, res) => {
  try {
    const { locationId } = req.body || {};
    const locNum = Number(locationId);

    if (!Number.isInteger(locNum) || locNum <= 0) {
      return res.status(400).json({ code: 1, message: 'locationId 必须是正整数' });
    }

    const location = getLocation(locNum);
    if (!location) {
      return res.status(404).json({ code: 1, message: '地点不存在' });
    }

    const users = readUsers();
    const user = users.find(u => String(u.id) === String(req.userId));
    if (!user) return res.status(404).json({ code: 1, message: '用户不存在' });

    normalizeUserCheckins(user);

    if (user.lockingLocations.includes(locNum)) {
      return res.status(409).json({
        code: 1,
        errorCode: 'CHECKIN_REVIEW_PENDING',
        message: '该地点的照片正在审核中，暂时不能重复打卡'
      });
    }

    if (user.unlockedLocations.includes(locNum)) {
      return res.status(409).json({
        code: 1,
        errorCode: 'CHECKIN_ALREADY_APPROVED',
        message: '该地点已打卡成功，无需重复打卡'
      });
    }

    return res.status(403).json({
      code: 1,
      errorCode: 'CHECKIN_PHOTO_REQUIRED',
      message: '请在打卡点 50 米范围内拍照上传，审核通过后即可获得积分'
    });
  } catch (e) {
    console.error('[checkin/map] error:', e);
    return res.status(500).json({ code: 1, message: '打卡失败' });
  }
});

// ==== F. 对被驳回的照片打卡发起申诉 ====
router.post('/appeal', auth, (req, res) => {
  const locationId = Number(req.body?.locationId);
  const reason = String(req.body?.reason || '').normalize('NFC').trim().slice(0, 500);
  if (!Number.isInteger(locationId) || locationId <= 0) {
    return res.status(400).json({ code: 1, message: '打卡地点无效' });
  }
  if (Array.from(reason).length < 4) {
    return res.status(400).json({ code: 1, errorCode: 'CHECKIN_APPEAL_REASON_SHORT', message: '请填写至少 4 个字符的申诉说明' });
  }

  const users = readUsers();
  const index = users.findIndex(user => String(user.id) === String(req.userId));
  if (index === -1) return res.status(404).json({ code: 1, message: '用户不存在' });
  const user = normalizeUserCheckins(users[index]);
  if (user.unlockedLocations.includes(locationId)) {
    return res.status(409).json({ code: 1, message: '该地点已经审核通过' });
  }
  if (user.lockingLocations.includes(locationId)) {
    return res.status(409).json({ code: 1, errorCode: 'CHECKIN_REVIEW_PENDING', message: '该地点已有审核或申诉正在处理中' });
  }

  const rejected = [...user.checkinReviewRecords]
    .reverse()
    .find(item => Number(item.locationId) === locationId && item.status === 'rejected');
  if (!rejected) return res.status(404).json({ code: 1, message: '没有可申诉的驳回记录' });
  if (!rejected.photo && !rejected.key) {
    return res.status(409).json({ code: 1, errorCode: 'CHECKIN_APPEAL_PHOTO_MISSING', message: '历史驳回记录没有保留照片，请重新打卡提交' });
  }

  rejected.appealStatus = 'pending';
  rejected.appealReason = reason;
  rejected.appealedAt = Date.now();
  user.lockingLocations.push(locationId);
  user.pendingCheckins.push({
    locationId,
    key: rejected.key || '',
    photo: rejected.photo || (rejected.key ? toUrl(rejected.key) : ''),
    submittedAt: Number(rejected.submittedAt || rejected.reviewedAt || Date.now()),
    pointsDeferred: true,
    appealStatus: 'pending',
    appealReason: reason,
    appealedAt: rejected.appealedAt
  });
  user.updatedAt = Date.now();
  writeUsers(users);

  return res.json({ code: 0, message: '申诉已提交，请等待管理员复核', data: { locationId, appealStatus: 'pending' } });
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

// 2) 历史照片：GET /checkin/photo/history
// 返回当前用户在 COS 中保存过的全部打卡照片，兼容早期记录没有保存 photo URL 的情况。
router.get('/photo/history', auth, async (req, res) => {
  try {
    // 实际目录格式是 checkin/<uid>__<slug>/，保持与上传和其它取图接口一致。
    const userPrefix = `checkin/${req.userId}__${getUserSlug(req)}/`;
    const keys = await listObjectsByPrefix(userPrefix, 1000);
    const photos = keys.map(key => {
      const parts = String(key).split('/');
      const locationId = Number(parts[2]);
      const filename = parts[3] || '';
      const timestampMatch = filename.match(/^(\d{10,})_/);
      return {
        key,
        url: toSignedUrl(key, 600),
        locationId: Number.isInteger(locationId) ? locationId : 0,
        uploadedAt: timestampMatch ? Number(timestampMatch[1]) : 0
      };
    });
    return res.json({ code: 0, data: { photos, count: photos.length } });
  } catch (e) {
    console.error('[checkin/photo/history] error:', e);
    return res.status(500).json({ code: 1, message: 'history failed' });
  }
});

// 3) 最新一张：GET /checkin/photo/latest?locationId=xxx
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

// 4) 签名直链：GET /checkin/photo/sign?key=...
router.get('/photo/sign', auth, async (req, res) => {
  try {
    const { key } = req.query || {};
    if (!key) return res.status(400).json({ code: 1, message: 'key required' });

    // 安全校验：必须属于该用户的打卡根目录
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
