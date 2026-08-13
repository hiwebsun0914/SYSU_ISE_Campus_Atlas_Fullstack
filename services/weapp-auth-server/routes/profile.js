const express = require('express');
const fs = require('fs');
const path = require('path');

const auth = require('../middleware/auth');
const { effectiveRole } = require('../lib/roles');

const router = express.Router();
const USERS_FILE = path.resolve(process.env.USERS_FILE || path.join(__dirname, '..', 'users.json'));

const MAIN_TYPES = Object.freeze({
  GROW: '长期积累型',
  SIDE: '兴趣拓展型',
  DONE: '目标完成型',
  DDL: '临期爆发型',
  HOST: '主动组织型',
  SYNC: '同伴同行型',
  TRY: '新鲜体验型',
  PING: '随性探索型'
});

const SUB_TYPES = Object.freeze({
  STAY: '慢节奏停留型',
  MAPS: '地标收集型',
  RUN: '路线探索型',
  LENS: '视觉观察型',
  WIKI: '维基百科型',
  BASE: '熟悉地点型'
});

const BADGES = Object.freeze({
  ddlIgniter: 'DDL 点火器',
  groupStarter: '小组开场键',
  fixedSeat: '固定座位拥有者',
  mealCaller: '饭搭子召集令',
  aiVerifier: 'AI 二次核验员',
  detour: '回宿舍绕路选手',
  photoKeeper: '私人相册管理员'
});

function readUsers() {
  const raw = fs.readFileSync(USERS_FILE, 'utf8') || '[]';
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('USERS_FILE must contain an array');
  return parsed;
}

function writeUsers(users) {
  const dir = path.dirname(USERS_FILE);
  fs.mkdirSync(dir, { recursive: true });
  const tempFile = `${USERS_FILE}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(users, null, 2), 'utf8');
  fs.renameSync(tempFile, USERS_FILE);
}

function cleanText(value, maxLength) {
  return normalizedText(value).slice(0, maxLength);
}

function normalizedText(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

function visibleLength(value) {
  return Array.from(String(value || '')).length;
}

function sendValidation(res, field, message, errorCode = 'PROFILE_INVALID') {
  return res.status(400).json({ code: 1, errorCode, field, message });
}

function publicProfile(user) {
  const publicAssetDomain = String(process.env.PUBLIC_ASSET_DOMAIN || '').replace(/\/+$/, '');
  const avatar = user.avatarKey && publicAssetDomain
    ? `${publicAssetDomain}/${encodeURI(user.avatarKey)}`
    : (user.avatar || '');
  return {
    id: user.id,
    username: user.username || '',
    realName: user.realName || '',
    studentId: user.studentId || '',
    phone: user.phone || '',
    bio: user.bio || '',
    avatar,
    role: effectiveRole(user),
    personality: user.personality || null,
    updatedAt: user.updatedAt || 0
  };
}

router.put('/profile', auth, (req, res) => {
  try {
    const payload = req.body && typeof req.body === 'object' ? req.body : {};
    const updates = {};

    if (Object.prototype.hasOwnProperty.call(payload, 'username')) {
      const username = normalizedText(payload.username);
      if (visibleLength(username) < 2 || visibleLength(username) > 24) {
        return sendValidation(res, 'username', '昵称需要 2-24 个字符。');
      }
      updates.username = username;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'realName')) {
      const realName = normalizedText(payload.realName);
      const users = readUsers();
      const currentUser = users.find(user => String(user.id) === String(req.userId));
      if (!currentUser) return res.status(404).json({ code: 1, message: '用户不存在' });
      if (realName !== normalizedText(currentUser.realName)) {
        return sendValidation(res, 'realName', '姓名已在注册时确认，无法在个人主页修改。', 'REAL_NAME_LOCKED');
      }
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'studentId')) {
      const studentId = normalizedText(payload.studentId);
      if (studentId && !/^[A-Za-z0-9_-]{6,24}$/.test(studentId)) {
        return sendValidation(res, 'studentId', '学号需为 6-24 位字母、数字、下划线或连字符。');
      }
      updates.studentId = studentId;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'phone')) {
      const phone = normalizedText(payload.phone);
      if (phone && !/^[0-9+()\-\s]{5,30}$/.test(phone)) {
        return sendValidation(res, 'phone', '联系电话格式不正确，请仅使用数字、空格和常用电话符号。');
      }
      updates.phone = phone;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'bio')) {
      const bio = normalizedText(payload.bio);
      if (visibleLength(bio) > 160) {
        return sendValidation(res, 'bio', '个人简介最多 160 个字符，请精简后再保存。');
      }
      updates.bio = bio;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'avatar')) {
      const avatar = normalizedText(payload.avatar);
      if (visibleLength(avatar) > 500) {
        return sendValidation(res, 'avatar', '头像地址最多 500 个字符。');
      }
      if (avatar && !/^https?:\/\/[^\s]+$/i.test(avatar)) {
        return sendValidation(res, 'avatar', '头像地址需要以 http:// 或 https:// 开头。');
      }
      updates.avatar = avatar;
      if (avatar) updates.avatarKey = null;
    }

    if (Object.keys(updates).length === 0) {
      return sendValidation(res, 'profile', '没有可保存的资料变更。');
    }

    const users = readUsers();
    const index = users.findIndex(user => String(user.id) === String(req.userId));
    if (index === -1) return res.status(404).json({ code: 1, message: '用户不存在' });

    if (updates.username && users.some((user, idx) => idx !== index && user.username === updates.username)) {
      return sendValidation(res, 'username', '这个昵称已被使用，请换一个昵称。', 'USERNAME_TAKEN');
    }

    if (updates.studentId && users.some((user, idx) => idx !== index && user.studentId === updates.studentId)) {
      return sendValidation(res, 'studentId', '这个学号已绑定其他账户，请核对后重试。', 'STUDENT_ID_TAKEN');
    }

    users[index] = {
      ...users[index],
      ...updates,
      updatedAt: Date.now()
    };
    writeUsers(users);

    return res.json({
      code: 0,
      message: '资料已更新',
      data: { userInfo: publicProfile(users[index]) }
    });
  } catch (error) {
    console.error('[PUT /user/profile] error:', error);
    return res.status(503).json({ code: 1, errorCode: 'PROFILE_STORE_UNAVAILABLE', message: '暂时无法保存资料，请稍后重试。' });
  }
});

router.put('/personality', auth, (req, res) => {
  try {
    const payload = req.body && typeof req.body === 'object' ? req.body : {};
    const mainCode = cleanText(payload.mainCode, 8).toUpperCase();
    const requestedSubCode = cleanText(payload.subCode, 8).toUpperCase();
    const subCode = requestedSubCode === 'TREE' ? 'STAY' : requestedSubCode;

    if (!MAIN_TYPES[mainCode] || !SUB_TYPES[subCode]) {
      return sendValidation(res, 'personality', 'ISETI 结果无效，请重新完成测试。', 'PERSONALITY_INVALID');
    }

    const badgeCodes = Array.isArray(payload.badges)
      ? [...new Set(payload.badges.map(code => cleanText(code, 32)).filter(code => BADGES[code]))].slice(0, 3)
      : [];

    const personality = {
      testId: 'PLACE',
      version: 2,
      mainCode,
      mainName: MAIN_TYPES[mainCode],
      subCode,
      subName: SUB_TYPES[subCode],
      badges: badgeCodes.map(code => ({ code, name: BADGES[code] })),
      placeId: null,
      placeName: '',
      line: '',
      task: '',
      completedAt: Date.now()
    };

    const users = readUsers();
    const index = users.findIndex(user => String(user.id) === String(req.userId));
    if (index === -1) return res.status(404).json({ code: 1, message: '用户不存在' });

    users[index].personality = personality;
    users[index].updatedAt = personality.completedAt;
    writeUsers(users);

    return res.json({ code: 0, message: 'ISETI 结果已保存', data: { personality } });
  } catch (error) {
    console.error('[PUT /user/personality] error:', error);
    return res.status(503).json({ code: 1, errorCode: 'PROFILE_STORE_UNAVAILABLE', message: '暂时无法保存测试结果，请稍后重试。' });
  }
});

router._test = { cleanText, normalizedText, visibleLength, MAIN_TYPES, SUB_TYPES, BADGES };

module.exports = router;
