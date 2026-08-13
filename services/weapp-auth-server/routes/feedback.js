const crypto = require('crypto');
const express = require('express');
const COS = require('cos-nodejs-sdk-v5');
const multer = require('multer');

const auth = require('../middleware/auth');
const { readFeedback, writeFeedback } = require('../lib/feedbackStore');

const router = express.Router();
const MAX_IMAGES = 9;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const COS_BUCKET = String(process.env.COS_BUCKET || '').trim();
const COS_REGION = String(process.env.COS_REGION || '').trim();
const PUBLIC_ASSET_DOMAIN = String(process.env.PUBLIC_ASSET_DOMAIN || '').trim().replace(/\/+$/, '');
const cos = process.env.TENCENT_SECRET_ID && process.env.TENCENT_SECRET_KEY && COS_BUCKET && COS_REGION
  ? new COS({ SecretId: process.env.TENCENT_SECRET_ID, SecretKey: process.env.TENCENT_SECRET_KEY })
  : null;
const bucketBaseUrl = COS_BUCKET && COS_REGION ? `https://${COS_BUCKET}.cos.${COS_REGION}.myqcloud.com` : '';
const uploadMemory = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } });

const CATEGORIES = Object.freeze({
  suggestion: '功能建议',
  bug: '问题反馈',
  content: '内容纠错',
  other: '其他'
});

function cleanText(value, maxLength) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

function imageType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { ext: 'jpg', contentType: 'image/jpeg' };
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', contentType: 'image/png' };
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return { ext: 'webp', contentType: 'image/webp' };
  if (['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))) return { ext: 'gif', contentType: 'image/gif' };
  return null;
}

function userImagePrefix(userId) {
  return `feedback/${String(userId)}/`;
}

function imageUrl(key) {
  const base = PUBLIC_ASSET_DOMAIN || bucketBaseUrl;
  return base ? `${base}/${encodeURI(key)}` : '';
}

function uploadImage(req, res, next) {
  uploadMemory.single('file')(req, res, error => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ code: 1, message: '单张图片不能超过 10MB。' });
    return res.status(400).json({ code: 1, message: '图片读取失败，请重新选择。' });
  });
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
    images: Array.isArray(item.images) ? item.images : [],
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

router.post('/upload', auth, uploadImage, async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ code: 1, message: '请选择要上传的图片。' });
  const detected = imageType(file.buffer);
  if (!detected) return res.status(400).json({ code: 1, message: '图片格式不支持，请使用 JPG、PNG、WebP 或 GIF。' });
  if (!cos && !bucketBaseUrl) return res.status(503).json({ code: 1, message: '图片存储暂未配置，请稍后重试。' });

  const key = `${userImagePrefix(req.userId)}${Date.now()}-${crypto.randomUUID()}.${detected.ext}`;
  try {
    if (cos) {
      await new Promise((resolve, reject) => {
        cos.putObject({
          Bucket: COS_BUCKET,
          Region: COS_REGION,
          Key: key,
          Body: file.buffer,
          ContentType: detected.contentType
        }, error => error ? reject(error) : resolve());
      });
      await cos.putObjectAcl({ Bucket: COS_BUCKET, Region: COS_REGION, Key: key, ACL: 'public-read' })
        .catch(error => console.warn('[feedback/upload] ACL fail:', error?.message));
    } else {
      const response = await fetch(`${bucketBaseUrl}/${encodeURI(key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': detected.contentType },
        body: file.buffer
      });
      if (!response.ok) throw new Error(`COS PUT ${response.status}`);
    }
    return res.status(201).json({ code: 0, data: { key, url: imageUrl(key) } });
  } catch (error) {
    console.error('[POST /feedback/upload] error:', error);
    return res.status(502).json({ code: 1, message: '图片上传失败，请稍后重试。' });
  }
});

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
    const rawImages = Array.isArray(payload.images) ? payload.images : [];

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
    if (rawImages.length > MAX_IMAGES) {
      return res.status(400).json({ code: 1, errorCode: 'FEEDBACK_IMAGES_LIMIT', field: 'images', message: '最多上传 9 张图片。' });
    }
    const images = rawImages.map(item => ({ key: cleanText(item?.key, 500) }));
    if (images.some(item =>
      !item.key.startsWith(userImagePrefix(req.userId)) ||
      item.key.includes('..') ||
      !/\.(?:jpe?g|png|webp|gif)$/i.test(item.key)
    )) {
      return res.status(400).json({ code: 1, errorCode: 'FEEDBACK_IMAGE_INVALID', field: 'images', message: '反馈图片地址无效，请重新上传。' });
    }
    images.forEach(item => { item.url = imageUrl(item.key); });

    const now = Date.now();
    const record = {
      id: crypto.randomUUID(),
      userId: req.userId,
      username: req.user?.username || '',
      category,
      categoryName: CATEGORIES[category],
      content,
      contact,
      images,
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

router._test = { CATEGORIES, MAX_IMAGES, cleanText, imageType, publicFeedback };

module.exports = router;
