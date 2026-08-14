const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const COS = require('cos-nodejs-sdk-v5');

const auth = require('../middleware/auth');

const STORE_FILE = path.resolve(
  process.env.FUTURE_CARDS_FILE || path.join(__dirname, '..', 'future_cards.json')
);
const MODE_LIMITS = Object.freeze({ expectation: 500, letter: 500 });
const TEMPLATES = new Set(['sysu-editorial', 'lake-morning', 'engineering-blueprint']);
const FONTS = new Set(['song', 'sans', 'hand']);
const SIZES = new Set(['small', 'medium', 'large']);
const ALIGNS = new Set(['left', 'center']);
const SIGNATURE_MODES = new Set(['default', 'nickname', 'custom']);
function readPositiveLimit(name, fallback) {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.max(1, Math.floor(value));
}

const WRITE_LIMIT = readPositiveLimit('FUTURE_CARD_WRITE_LIMIT', 30);
const BODY_LIMIT = readPositiveLimit('FUTURE_CARD_BODY_LIMIT', 16 * 1024);
const WRITE_WINDOW_MS = 60 * 1000;
const writeWindows = new Map();
const COS_BUCKET = process.env.COS_BUCKET;
const COS_REGION = process.env.COS_REGION;
const PUBLIC_ASSET_DOMAIN = process.env.PUBLIC_ASSET_DOMAIN;
const COS_SECRET_ID = process.env.COS_SECRET_ID || process.env.TENCENT_SECRET_ID;
const COS_SECRET_KEY = process.env.COS_SECRET_KEY || process.env.TENCENT_SECRET_KEY;
const IMAGE_LIMIT_BYTES = readPositiveLimit('FUTURE_CARD_IMAGE_LIMIT', 8 * 1024 * 1024);

function publicAssetBase() {
  return (PUBLIC_ASSET_DOMAIN || (
    COS_BUCKET && COS_REGION ? `https://${COS_BUCKET}.cos.${COS_REGION}.myqcloud.com` : ''
  )).replace(/\/+$/, '');
}

function publicUrlForKey(key) {
  const base = publicAssetBase();
  if (!base || !key) return null;
  return `${base}/${String(key).split('/').map(encodeURIComponent).join('/')}`;
}

function createPublicBucketClient(fetchImpl = globalThis.fetch) {
  if (!COS_BUCKET || !COS_REGION || !publicAssetBase() || typeof fetchImpl !== 'function') return null;
  return {
    async putObject({ Key, Body, ContentType }) {
      const response = await fetchImpl(publicUrlForKey(Key), {
        method: 'PUT',
        headers: { 'Content-Type': ContentType || 'application/octet-stream' },
        body: Body
      });
      if (!response || !response.ok) {
        const status = response?.status || 'NO_RESPONSE';
        throw new Error(`public bucket upload failed: ${status}`);
      }
    },
    async deleteObject({ Key }) {
      const response = await fetchImpl(publicUrlForKey(Key), { method: 'DELETE' });
      if (response && !response.ok && response.status !== 404) {
        throw new Error(`public bucket delete failed: ${response.status}`);
      }
    },
    getObjectUrl({ Key }) {
      return publicUrlForKey(Key);
    }
  };
}

function createDefaultCosClient(fetchImpl = globalThis.fetch) {
  if (COS_BUCKET && COS_REGION && COS_SECRET_ID && COS_SECRET_KEY) {
    return new COS({ SecretId: COS_SECRET_ID, SecretKey: COS_SECRET_KEY });
  }
  return createPublicBucketClient(fetchImpl);
}

const cos = createDefaultCosClient();

class ApiError extends Error {
  constructor(status, errorCode, message) {
    super(message);
    this.status = status;
    this.errorCode = errorCode;
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeContent(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

function visibleLength(value) {
  const text = String(value || '').normalize('NFC').replace(/\r\n?/g, '\n');
  const segmenter = global.Intl && Intl.Segmenter
    ? new Intl.Segmenter('zh-CN', { granularity: 'grapheme' })
    : null;
  const parts = segmenter
    ? [...segmenter.segment(text)].map(item => item.segment)
    : Array.from(text);
  return parts.filter(part => !/^\s+$/u.test(part)).length;
}

function moderationFingerprint(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('zh-CN')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g, '')
    .replace(/[\p{White_Space}\p{Punctuation}\p{Symbol}]+/gu, '');
}

function loadSensitiveWords() {
  const chunks = [];
  if (process.env.SENSITIVE_WORDS) chunks.push(process.env.SENSITIVE_WORDS);
  if (process.env.SENSITIVE_WORDS_FILE) {
    const configuredPath = path.resolve(process.env.SENSITIVE_WORDS_FILE);
    try {
      chunks.push(fs.readFileSync(configuredPath, 'utf8'));
    } catch (error) {
      console.error('[future-cards] sensitive dictionary unavailable:', error.code || 'READ_FAILED');
    }
  }
  if (!chunks.length) chunks.push('自杀,暴恐,诈骗,赌博');
  return chunks
    .join('\n')
    .split(/[,\r\n]+/)
    .map(word => moderationFingerprint(word.trim()))
    .filter(Boolean);
}

function contentRejected(content) {
  if (/<\s*\/?\s*[a-z][^>]*>/iu.test(content)) return true;
  const fingerprint = moderationFingerprint(content);
  return loadSensitiveWords().some(word => fingerprint.includes(word));
}

function ensureStore() {
  if (fs.existsSync(STORE_FILE)) return;
  fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });
  writeStore({ cards: [] });
}

function readStore() {
  ensureStore();
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
  } catch (error) {
    console.error('[future-cards] store read failed:', error.code || 'INVALID_JSON');
    throw new ApiError(503, 'STORE_UNAVAILABLE', '信笺暂时无法读取，请稍后重试');
  }
  if (!isPlainObject(parsed) || !Array.isArray(parsed.cards)) {
    throw new ApiError(503, 'STORE_UNAVAILABLE', '信笺存储格式异常，请联系管理员');
  }
  return parsed;
}

function writeStore(store) {
  fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });
  const temporary = `${STORE_FILE}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(store, null, 2), { encoding: 'utf8', flag: 'wx' });
    fs.renameSync(temporary, STORE_FILE);
  } catch (error) {
    try { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); } catch {}
    console.error('[future-cards] store write failed:', error.code || 'WRITE_FAILED');
    throw new ApiError(503, 'STORE_UNAVAILABLE', '信笺暂时无法保存，本地草稿仍然保留');
  }
}

function validatePayload(body, user) {
  if (!isPlainObject(body)) {
    throw new ApiError(400, 'INVALID_STYLE', '请求格式不正确');
  }
  const mode = typeof body.mode === 'string' ? body.mode : '';
  if (!Object.prototype.hasOwnProperty.call(MODE_LIMITS, mode)) {
    throw new ApiError(400, 'INVALID_MODE', '请选择有效的内容类型');
  }

  if (typeof body.content !== 'string') {
    throw new ApiError(400, 'CONTENT_EMPTY', '请先写下内容');
  }
  const content = normalizeContent(body.content);
  const length = visibleLength(content);
  if (!length) throw new ApiError(400, 'CONTENT_EMPTY', '请先写下内容');
  if (length > MODE_LIMITS[mode]) {
    throw new ApiError(400, 'CONTENT_TOO_LONG', `当前内容最多 ${MODE_LIMITS[mode]} 个可见字符`);
  }
  if (contentRejected(content)) {
    throw new ApiError(400, 'CONTENT_REJECTED', '内容未通过安全检查，请调整表达后重试');
  }

  const styleInput = isPlainObject(body.style) ? body.style : {};
  const templateId = typeof body.templateId === 'string'
    ? body.templateId
    : styleInput.templateId;
  const fontId = styleInput.fontId;
  const size = styleInput.size;
  const align = styleInput.align;
  const signatureMode = styleInput.signatureMode;
  if (!TEMPLATES.has(templateId) || !FONTS.has(fontId) || !SIZES.has(size)
    || !ALIGNS.has(align) || !SIGNATURE_MODES.has(signatureMode)) {
    throw new ApiError(400, 'INVALID_STYLE', '卡片样式不在允许范围内');
  }

  const nickname = typeof user?.username === 'string' ? user.username.trim() : '';
  const customSignature = normalizeContent(styleInput.signatureText);
  if (signatureMode === 'custom') {
    const signatureLength = visibleLength(customSignature);
    if (!signatureLength || signatureLength > 24) {
      throw new ApiError(400, 'INVALID_SIGNATURE', '署名需要 1 至 24 个可见字符');
    }
    if (contentRejected(customSignature)) {
      throw new ApiError(400, 'CONTENT_REJECTED', '署名未通过安全检查，请调整后重试');
    }
  }
  const signatureText = signatureMode === 'custom'
    ? customSignature
    : (signatureMode === 'nickname' && nickname ? Array.from(nickname).slice(0, 24).join('') : '一名智工新生');
  return {
    mode,
    content,
    templateId,
    style: {
      fontId,
      size,
      align,
      signatureMode,
      signatureText
    }
  };
}

function sendError(res, error) {
  if (error instanceof ApiError) {
    return res.status(error.status).json({ code: 1, errorCode: error.errorCode, message: error.message });
  }
  console.error('[future-cards] unhandled route error:', error?.code || error?.name || 'UNKNOWN');
  return res.status(500).json({ code: 1, errorCode: 'STORE_UNAVAILABLE', message: '服务暂时不可用，请稍后重试' });
}

function enforceBodyLimit(req, res, next) {
  const declared = Number(req.get('content-length') || 0);
  let actual = 0;
  try { actual = Buffer.byteLength(JSON.stringify(req.body || {}), 'utf8'); } catch { actual = BODY_LIMIT + 1; }
  if (declared > BODY_LIMIT || actual > BODY_LIMIT) {
    return res.status(413).json({ code: 1, errorCode: 'CONTENT_TOO_LONG', message: '请求内容过大' });
  }
  return next();
}

function writeRateLimit(req, res, next) {
  const now = Date.now();
  const key = `${String(req.userId)}:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
  const current = writeWindows.get(key);
  if (!current || now - current.startedAt >= WRITE_WINDOW_MS) {
    writeWindows.set(key, { startedAt: now, count: 1 });
    return next();
  }
  current.count += 1;
  if (current.count > WRITE_LIMIT) {
    return res.status(429).json({ code: 1, errorCode: 'RATE_LIMITED', message: '操作过于频繁，请稍后重试' });
  }
  return next();
}

function ownCard(store, id, userId) {
  return store.cards.find(card => card.id === id && String(card.ownerId) === String(userId));
}

function imageKeyFor(userId, cardId) {
  const random = crypto.randomBytes(6).toString('hex');
  return `FutureCard/${String(userId)}/${String(cardId)}/${Date.now()}_${random}.png`;
}

function signedImageUrl(key, client = cos) {
  if (!client || !key || typeof client.getObjectUrl !== 'function') return null;
  try {
    return client.getObjectUrl({
      Bucket: COS_BUCKET,
      Region: COS_REGION,
      Key: key,
      Sign: true,
      Expires: 600
    });
  } catch {
    return null;
  }
}

function cardForResponse(card, client = cos) {
  const output = { ...card };
  if (card.imageKey) output.imageUrl = signedImageUrl(card.imageKey, client);
  return output;
}

function requireCos(client) {
  if (!client) throw new ApiError(503, 'COS_UNAVAILABLE', '图片存储服务暂不可用，请稍后重试');
  return client;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function cleanupObject(client, key, label) {
  if (!client || !key || typeof client.deleteObject !== 'function') return;
  try {
    const result = client.deleteObject({ Bucket: COS_BUCKET, Region: COS_REGION, Key: key });
    if (result && typeof result.catch === 'function') {
      result.catch(error => console.warn(`[future-cards] ${label} cleanup failed:`, error?.code || error?.message));
    }
  } catch (error) {
    console.warn(`[future-cards] ${label} cleanup failed:`, error?.code || error?.message);
  }
}

function registerRoutes(router, cosClient) {
  router.use((req, _res, next) => {
    req.futureCardsCos = cosClient;
    next();
  });

  router.get('/', auth, (req, res) => {
    try {
      const store = readStore();
      const cards = store.cards
        .filter(card => String(card.ownerId) === String(req.userId))
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      return res.json({ code: 0, data: { cards: cards.map(card => cardForResponse(card, req.futureCardsCos)) } });
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.get('/:id', auth, (req, res) => {
    try {
      const store = readStore();
      const card = ownCard(store, String(req.params.id || ''), req.userId);
      if (!card) throw new ApiError(404, 'CARD_NOT_FOUND', '信笺不存在');
      return res.json({ code: 0, data: { card: cardForResponse(card, req.futureCardsCos) } });
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.post('/', auth, enforceBodyLimit, writeRateLimit, (req, res) => {
    try {
      const validated = validatePayload(req.body, req.user);
      const store = readStore();
      const timestamp = new Date().toISOString();
      const card = {
        id: crypto.randomUUID(),
        ownerId: req.userId,
        ...validated,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      store.cards.unshift(card);
      writeStore(store);
      return res.status(201).json({ code: 0, data: { card: cardForResponse(card, req.futureCardsCos) } });
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.patch('/:id', auth, enforceBodyLimit, writeRateLimit, (req, res) => {
    try {
      const validated = validatePayload(req.body, req.user);
      const store = readStore();
      const card = ownCard(store, String(req.params.id || ''), req.userId);
      if (!card) throw new ApiError(404, 'CARD_NOT_FOUND', '信笺不存在');
      Object.assign(card, validated, { updatedAt: new Date().toISOString() });
      writeStore(store);
      return res.json({ code: 0, data: { card: cardForResponse(card, req.futureCardsCos) } });
    } catch (error) {
      return sendError(res, error);
    }
  });

  const imageRawParser = express.raw({ type: 'image/png', limit: IMAGE_LIMIT_BYTES });
  function parseImageBody(req, res, next) {
    return imageRawParser(req, res, error => {
      if (!error) return next();
      if (error.type === 'entity.too.large' || error.status === 413) {
        return sendError(res, new ApiError(413, 'IMAGE_TOO_LARGE', '图片大小超过限制'));
      }
      return sendError(res, new ApiError(400, 'INVALID_IMAGE', '仅支持非空 PNG 图片'));
    });
  }

  router.post('/:id/image', auth, writeRateLimit, parseImageBody, async (req, res) => {
    let uploadedKey = '';
    try {
      const contentType = String(req.get('content-type') || '').split(';')[0].trim().toLowerCase();
      const body = Buffer.isBuffer(req.body) ? req.body : null;
      if (contentType !== 'image/png' || !body?.length || body.length < PNG_SIGNATURE.length
        || !body.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
        throw new ApiError(400, 'INVALID_IMAGE', '仅支持非空 PNG 图片');
      }
      if (body.length > IMAGE_LIMIT_BYTES) {
        throw new ApiError(413, 'IMAGE_TOO_LARGE', '图片大小超过限制');
      }

      const store = readStore();
      const card = ownCard(store, String(req.params.id || ''), req.userId);
      if (!card) throw new ApiError(404, 'CARD_NOT_FOUND', '信笺不存在');

      const client = requireCos(req.futureCardsCos);
      uploadedKey = imageKeyFor(req.userId, card.id);
      try {
        await client.putObject({
          Bucket: COS_BUCKET,
          Region: COS_REGION,
          Key: uploadedKey,
          Body: body,
          ContentType: 'image/png'
        });
      } catch (uploadError) {
        console.error('[future-cards] image upload failed:', uploadError?.code || uploadError?.message || uploadError);
        throw new ApiError(502, 'IMAGE_UPLOAD_FAILED', '图片上传失败，请稍后重试');
      }

      // Re-read after the asynchronous upload so a concurrent PATCH is retained.
      const latestStore = readStore();
      const latestCard = ownCard(latestStore, String(req.params.id || ''), req.userId);
      if (!latestCard) throw new ApiError(404, 'CARD_NOT_FOUND', '信笺不存在');

      const previousKey = latestCard.imageKey;
      const now = new Date().toISOString();
      latestCard.imageKey = uploadedKey;
      latestCard.imageUpdatedAt = now;
      latestCard.updatedAt = now;
      writeStore(latestStore);
      uploadedKey = '';

      if (previousKey && previousKey !== latestCard.imageKey) {
        cleanupObject(client, previousKey, 'old image');
      }

      return res.status(201).json({ code: 0, data: { card: cardForResponse(latestCard, client) } });
    } catch (error) {
      cleanupObject(req.futureCardsCos, uploadedKey, 'image');
      return sendError(res, error);
    }
  });

  router.delete('/:id', auth, writeRateLimit, (req, res) => {
    try {
      const store = readStore();
      const index = store.cards.findIndex(card => (
        card.id === String(req.params.id || '') && String(card.ownerId) === String(req.userId)
      ));
      if (index === -1) throw new ApiError(404, 'CARD_NOT_FOUND', '信笺不存在');
      const [{ id, imageKey }] = store.cards.splice(index, 1);
      writeStore(store);
      cleanupObject(req.futureCardsCos, imageKey, 'deleted image');
      return res.json({ code: 0, data: { id } });
    } catch (error) {
      return sendError(res, error);
    }
  });

  router._test = {
    MODE_LIMITS,
    BODY_LIMIT,
    IMAGE_LIMIT_BYTES,
    readPositiveLimit,
    normalizeContent,
    visibleLength,
    moderationFingerprint,
    contentRejected,
    validatePayload,
    imageKeyFor,
    cardForResponse
  };
  return router;
}

function createFutureCardsRouter(options = {}) {
  const client = Object.prototype.hasOwnProperty.call(options, 'cosClient')
    ? options.cosClient
    : createDefaultCosClient(options.fetchImpl);
  return registerRoutes(express.Router(), client);
}

const router = createFutureCardsRouter();
router.createFutureCardsRouter = createFutureCardsRouter;
module.exports = router;
