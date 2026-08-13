const crypto = require('crypto');
const express = require('express');
const fs = require('fs');
const path = require('path');

const auth = require('../middleware/auth');

const router = express.Router();
const FEEDBACK_FILE = path.resolve(process.env.FEEDBACK_FILE || path.join(__dirname, '..', 'feedback.json'));

const CATEGORIES = Object.freeze({
  suggestion: '功能建议',
  bug: '问题反馈',
  content: '内容纠错',
  other: '其他'
});

function ensureStore() {
  fs.mkdirSync(path.dirname(FEEDBACK_FILE), { recursive: true });
  if (!fs.existsSync(FEEDBACK_FILE)) fs.writeFileSync(FEEDBACK_FILE, '[]', 'utf8');
}

function readFeedback() {
  ensureStore();
  const raw = fs.readFileSync(FEEDBACK_FILE, 'utf8') || '[]';
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('FEEDBACK_FILE must contain an array');
  return parsed;
}

function writeFeedback(list) {
  ensureStore();
  const tempFile = `${FEEDBACK_FILE}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(list, null, 2), 'utf8');
  fs.renameSync(tempFile, FEEDBACK_FILE);
}

function cleanText(value, maxLength) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

function publicFeedback(item) {
  return {
    id: item.id,
    category: item.category,
    categoryName: item.categoryName,
    content: item.content,
    contact: item.contact || '',
    status: item.status || 'submitted',
    reply: item.reply || '',
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

router.get('/mine', auth, (req, res) => {
  try {
    const list = readFeedback()
      .filter(item => String(item.userId) === String(req.userId))
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
      .map(publicFeedback);
    return res.json({ code: 0, list });
  } catch (error) {
    console.error('[GET /feedback/mine] error:', error);
    return res.status(503).json({ code: 1, errorCode: 'FEEDBACK_STORE_UNAVAILABLE', message: '暂时无法读取反馈记录，请稍后重试。' });
  }
});

router.post('/', auth, (req, res) => {
  try {
    const payload = req.body && typeof req.body === 'object' ? req.body : {};
    const category = cleanText(payload.category, 24);
    const rawContent = String(payload.content ?? '').trim();
    const content = cleanText(rawContent, 1000);
    const contact = cleanText(payload.contact, 100);

    if (!CATEGORIES[category]) {
      return res.status(400).json({ code: 1, errorCode: 'FEEDBACK_CATEGORY_INVALID', field: 'category', message: '请选择有效的反馈类型。' });
    }
    if (Array.from(content).length < 5) {
      return res.status(400).json({ code: 1, errorCode: 'FEEDBACK_CONTENT_SHORT', field: 'content', message: '反馈内容至少需要 5 个字符，请补充具体情况。' });
    }
    if (Array.from(rawContent).length > 1000) {
      return res.status(400).json({ code: 1, errorCode: 'FEEDBACK_CONTENT_LONG', field: 'content', message: '反馈内容最多 1000 个字符，请精简后提交。' });
    }
    if (!contact) {
      return res.status(400).json({ code: 1, errorCode: 'FEEDBACK_CONTACT_REQUIRED', field: 'contact', message: '请填写微信号。' });
    }

    const now = Date.now();
    const record = {
      id: crypto.randomUUID(),
      userId: req.userId,
      username: req.user?.username || '',
      category,
      categoryName: CATEGORIES[category],
      content,
      contact,
      status: 'submitted',
      reply: '',
      createdAt: now,
      updatedAt: now
    };

    const list = readFeedback();
    list.push(record);
    writeFeedback(list);

    return res.status(201).json({ code: 0, message: '反馈已提交', data: { feedback: publicFeedback(record) } });
  } catch (error) {
    console.error('[POST /feedback] error:', error);
    return res.status(503).json({ code: 1, errorCode: 'FEEDBACK_STORE_UNAVAILABLE', message: '暂时无法提交反馈，请稍后重试。' });
  }
});

router._test = { CATEGORIES, cleanText, publicFeedback };

module.exports = router;
