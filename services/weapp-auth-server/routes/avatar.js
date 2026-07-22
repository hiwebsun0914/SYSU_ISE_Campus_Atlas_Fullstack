// routes/avatar.js
require('dotenv').config();

const router = require('express').Router();
const STS = require('qcloud-cos-sts');
const COS = require('cos-nodejs-sdk-v5');
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');

// 可选的表单上传支持（没有安装 multer 也不会报错）
let multer; try { multer = require('multer'); } catch (e) { multer = null; }
// const upload = multer ? multer({ storage: multer.memoryStorage() }) : null;

const {
  COS_BUCKET,
  COS_REGION,
  TENCENT_SECRET_ID,
  TENCENT_SECRET_KEY,
  STS_DURATION = 300,
  PUBLIC_ASSET_DOMAIN
} = process.env;

const cos = new COS({ SecretId: TENCENT_SECRET_ID, SecretKey: TENCENT_SECRET_KEY });

// users.json 绝对路径
const USERS_FILE = path.join(__dirname, '..', 'users.json');

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
  const base = PUBLIC_ASSET_DOMAIN || `https://${COS_BUCKET}.cos.${COS_REGION}.myqcloud.com`;
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

/** 获取直传凭证（STS）+ 生成 key（用 policy 严格限目录） */
router.post('/init', auth, (req, res) => {
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
router.post('/commit', auth, async (req, res) => {
  const { key, size } = req.body || {};
  if (!key || !key.startsWith(`UserImage/${req.userId}/`)) {
    return res.status(400).json({ code: 1, message: '非法 key' });
  }

  const head = await cos.headObject({ Bucket: COS_BUCKET, Region: COS_REGION, Key: key }).catch(() => null);
  if (!head) return res.status(400).json({ code: 1, message: '对象不存在或未上传成功' });

  if (size && Number(head.headers['content-length']) > Number(size) + 1024) {
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
  const idx = users.findIndex(u => u.id === req.userId);
  if (idx === -1) return res.status(404).json({ code: 1, message: '用户不存在' });

  users[idx].avatarKey = key;
  users[idx].avatar = toUrl(key);
  users[idx].updatedAt = Date.now();
  writeUsers(users);

  res.json({ code: 0, avatar_key: key, avatar_url: users[idx].avatar });
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
