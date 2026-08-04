const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const auth = require('../middleware/auth');

const router = express.Router();
const STORE_FILE = path.resolve(
  process.env.FUTURE_CARDS_FILE || path.join(__dirname, '..', 'future_cards.json')
);
const MODE_LIMITS = Object.freeze({ expectation: 60, letter: 500 });
const TEMPLATES = new Set(['sysu-editorial', 'lake-morning', 'engineering-blueprint']);
const FONTS = new Set(['song', 'sans', 'hand']);
const SIZES = new Set(['small', 'medium', 'large']);
const ALIGNS = new Set(['left', 'center']);
const SIGNATURE_MODES = new Set(['default', 'nickname']);
const WRITE_LIMIT = Math.max(1, Number(process.env.FUTURE_CARD_WRITE_LIMIT || 30));
const BODY_LIMIT = Math.max(1024, Number(process.env.FUTURE_CARD_BODY_LIMIT || 16 * 1024));
const WRITE_WINDOW_MS = 60 * 1000;
const writeWindows = new Map();

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
  return {
    mode,
    content,
    templateId,
    style: {
      fontId,
      size,
      align,
      signatureMode,
      signatureText: signatureMode === 'nickname' && nickname ? nickname.slice(0, 24) : '一名智工新生'
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

router.get('/', auth, (req, res) => {
  try {
    const store = readStore();
    const cards = store.cards
      .filter(card => String(card.ownerId) === String(req.userId))
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    return res.json({ code: 0, data: { cards } });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/:id', auth, (req, res) => {
  try {
    const store = readStore();
    const card = ownCard(store, String(req.params.id || ''), req.userId);
    if (!card) throw new ApiError(404, 'CARD_NOT_FOUND', '信笺不存在');
    return res.json({ code: 0, data: { card } });
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
    return res.status(201).json({ code: 0, data: { card } });
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
    return res.json({ code: 0, data: { card } });
  } catch (error) {
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
    const [{ id }] = store.cards.splice(index, 1);
    writeStore(store);
    return res.json({ code: 0, data: { id } });
  } catch (error) {
    return sendError(res, error);
  }
});

router._test = {
  MODE_LIMITS,
  normalizeContent,
  visibleLength,
  moderationFingerprint,
  contentRejected,
  validatePayload
};

module.exports = router;

