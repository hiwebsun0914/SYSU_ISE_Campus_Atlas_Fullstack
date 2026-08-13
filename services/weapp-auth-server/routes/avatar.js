// routes/avatar.js
require('dotenv').config();

const router = require('express').Router();
const STS = require('qcloud-cos-sts');
const COS = require('cos-nodejs-sdk-v5');
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');

const multer = require('multer');

const {
  COS_BUCKET,
  COS_REGION,
  STS_DURATION = 300,
  PUBLIC_ASSET_DOMAIN
} = process.env;

const TENCENT_SECRET_ID = process.env.TENCENT_SECRET_ID || process.env.COS_SECRET_ID;
const TENCENT_SECRET_KEY = process.env.TENCENT_SECRET_KEY || process.env.COS_SECRET_KEY;

function isUsableConfig(value) {
  const text = String(value || '').trim();
  return Boolean(text) && !/^(your[-_ ]|example|replace[-_ ]|changeme|xxx)/i.test(text);
}

const cosConfigured = [COS_BUCKET, COS_REGION, TENCENT_SECRET_ID, TENCENT_SECRET_KEY].every(isUsableConfig);
const cos = cosConfigured
  ? new COS({ SecretId: TENCENT_SECRET_ID, SecretKey: TENCENT_SECRET_KEY })
  : null;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024, files: 1 }
});

// users.json 绝对路径（与主服务、资料接口保持同一数据源）
const USERS_FILE = path.resolve(process.env.USERS_FILE || path.join(__dirname, '..', 'users.json'));

function readUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    const raw = fs.readFileSync(USERS_FILE, 'utf8') || '[]';
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}
function toUrl(key) {
  if (!key) return null;
  const base = isUsableConfig(PUBLIC_ASSET_DOMAIN)
    ? String(PUBLIC_ASSET_DOMAIN).replace(/\/+$/, '')
    : `https://${COS_BUCKET}.cos.${COS_REGION}.myqcloud.com`;
  return `${base}/${encodeURI(key)}`;
}
function safeExt(ext = 'jpg') {
  const e = String(ext).replace('.', '').toLowerCase();
  return e === 'jpeg' ? 'jpg' : (['jpg', 'png', 'webp'].includes(e) ? e : 'jpg');
}
function buildAvatarKey(uid, ext = 'jpg') {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `UserImage/${uid}/${ts}_${rand}.${safeExt(ext)}`;
}

function requireCos(_req, res, next) {
  if (cosConfigured && cos) return next();
  return res.status(503).json({
    code: 1,
    errorCode: 'COS_NOT_CONFIGURED',
    message: '头像存储尚未配置，请联系管理员完善 COS 存储桶与密钥配置'
  });
}

function imageExtension(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

function putObject(params) {
  return new Promise((resolve, reject) => {
    cos.putObject(params, (error, data) => error ? reject(error) : resolve(data));
  });
}

/** 获取仅用于当前用户头像目录的短期 PUT 地址 */
router.post('/presign', auth, requireCos, (req, res) => {
  const key = buildAvatarKey(req.userId, req.body?.ext);
  cos.getObjectUrl(
    {
      Bucket: COS_BUCKET,
      Region: COS_REGION,
      Key: key,
      Method: 'PUT',
      Sign: true,
      Expires: 300
    },
    (error, data) => {
      if (error || !data?.Url) {
        console.error('[avatar/presign] error:', error || data);
        return res.status(500).json({ code: 1, message: '获取头像上传地址失败' });
      }
      return res.json({ code: 0, data: { key, putUrl: data.Url } });
    }
  );
});

/** 获取直传凭证（STS）+ 生成 key（用 policy 严格限目录） */
router.post('/init', auth, requireCos, (req, res) => {
  const { ext = 'jpg' } = req.body || {};
  const key = buildAvatarKey(req.userId, ext);

  const [bucketShort, appid] = String(COS_BUCKET).split(/-(?=[^-]+$)/);

  const policy = {
    version: '2.0',
    statement: [{
      effect: 'allow',
      principal: { qcs: ['*'] },
      action: [
        'name/cos:PutObject',
        'name/cos:PostObject',
        'name/cos:HeadObject',
        'name/cos:InitiateMultipartUpload',
        'name/cos:ListMultipartUploads',
        'name/cos:ListParts',
        'name/cos:UploadPart',
        'name/cos:CompleteMultipartUpload',
        'name/cos:AbortMultipartUpload'
      ],
      // 仅放行当前用户目录
      resource: [
        `qcs::cos:${COS_REGION}:uid/${appid}:${COS_BUCKET}/UserImage/${req.userId}/*`
      ]
    }]
  };

  STS.getCredential({
    secretId: TENCENT_SECRET_ID,
    secretKey: TENCENT_SECRET_KEY,
    durationSeconds: Number(STS_DURATION) || 300,
    policy
  }, (err, creds) => {
    if (err || !creds?.credentials) {
      console.error('[STS ERROR]', err || creds);
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
          expiredTime: creds.expiredTime,
        }
      }
    });
  });
});

/** 提交绑定：校验对象存在 + 兜底改 ACL 为 public-read + 落库 avatarKey/URL */
router.post('/commit', auth, requireCos, async (req, res) => {
  const { key, size } = req.body || {};
  if (!key || !key.startsWith(`UserImage/${req.userId}/`)) {
    return res.status(400).json({ code: 1, message: '非法 key' });
  }

  const head = await cos.headObject({ Bucket: COS_BUCKET, Region: COS_REGION, Key: key }).catch(() => null);
  if (!head) return res.status(400).json({ code: 1, message: '对象不存在或未上传成功' });

  const uploadedSize = Number(head.headers['content-length'] || 0);
  if (uploadedSize > 5 * 1024 * 1024) {
    return res.status(413).json({ code: 1, message: '头像图片不能超过 5 MB' });
  }
  if (size && uploadedSize > Number(size) + 1024) {
    return res.status(400).json({ code: 1, message: '文件大小不匹配' });
  }

  // 兜底：把头像对象改成 public-read，避免 403
  await cos.putObjectAcl({
    Bucket: COS_BUCKET,
    Region: COS_REGION,
    Key: key,
    ACL: 'public-read'
  }).catch(e => console.warn('putObjectAcl fail', e?.message));

  // 落库
  const users = readUsers();
  const idx = users.findIndex(u => String(u.id) === String(req.userId));
  if (idx === -1) return res.status(404).json({ code: 1, message: '用户不存在' });

  users[idx].avatarKey = key;
  users[idx].avatar = toUrl(key);
  users[idx].updatedAt = Date.now();
  writeUsers(users);

  res.json({ code: 0, avatar_key: key, avatar_url: users[idx].avatar });
});

/** 接收前端裁剪后的正方形头像，由服务端上传，避免浏览器直传所需的 COS CORS 配置。 */
router.post('/upload', auth, requireCos, (req, res) => {
  upload.single('avatar')(req, res, async error => {
    if (error?.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ code: 1, message: '裁剪后的头像不能超过 3 MB' });
    }
    if (error) return res.status(400).json({ code: 1, message: '头像文件读取失败' });
    if (!req.file?.buffer) return res.status(400).json({ code: 1, message: '请选择头像图片' });

    const ext = imageExtension(req.file.buffer);
    if (!ext) return res.status(400).json({ code: 1, message: '头像必须是 JPG、PNG 或 WebP 图片' });

    const key = buildAvatarKey(req.userId, ext);
    try {
      await putObject({
        Bucket: COS_BUCKET,
        Region: COS_REGION,
        Key: key,
        Body: req.file.buffer,
        ContentLength: req.file.size,
        ContentType: ext === 'jpg' ? 'image/jpeg' : `image/${ext}`,
        ACL: 'public-read'
      });

      const users = readUsers();
      const idx = users.findIndex(user => String(user.id) === String(req.userId));
      if (idx === -1) return res.status(404).json({ code: 1, message: '用户不存在' });

      users[idx].avatarKey = key;
      users[idx].avatar = toUrl(key);
      users[idx].updatedAt = Date.now();
      writeUsers(users);
      return res.json({ code: 0, avatar_key: key, avatar_url: users[idx].avatar });
    } catch (uploadError) {
      console.error('[avatar/upload] COS upload failed:', uploadError?.message || uploadError);
      return res.status(502).json({ code: 1, message: '头像上传到存储服务失败，请稍后重试' });
    }
  });
});

// if (upload) {
//   router.post('/upload', auth, upload.single('file'), async (req, res) => {
//     if (!req.file) return res.status(400).json({ code: 1, message: '未选择文件' });
//     const ext = (req.file.originalname.split('.').pop() || 'jpg').toLowerCase();
//     const key = buildAvatarKey(req.userId, ext);

//     await cos.putObject({
//       Bucket: COS_BUCKET,
//       Region: COS_REGION,
//       Key: key,
//       Body: req.file.buffer,
//       Headers: { 'x-cos-acl': 'public-read' }
//     });

//     const users = readUsers();
//     const idx = users.findIndex(u => u.id === req.userId);
//     users[idx].avatarKey = key;
//     users[idx].avatar = toUrl(key);
//     users[idx].updatedAt = Date.now();
//     writeUsers(users);

//     res.json({ code: 0, avatar_key: key, avatar_url: users[idx].avatar });
//   });
// }

module.exports = router;
