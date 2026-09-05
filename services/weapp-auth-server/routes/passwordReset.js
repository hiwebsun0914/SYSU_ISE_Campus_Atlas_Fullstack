'use strict';
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { isIP } = require('net');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const { effectiveRole } = require('../lib/roles');
const router = express.Router();
const usersFile = path.resolve(process.env.USERS_FILE || path.join(__dirname, '../users.json'));
const day = 24 * 60 * 60 * 1000;
const read = () => JSON.parse(fs.readFileSync(usersFile, 'utf8'));
function write(users) {
  const tmp = usersFile + '.reset-tmp';
  fs.writeFileSync(tmp, JSON.stringify(users, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, usersFile);
}
const hash = token => crypto.createHash('sha256').update(token).digest('hex');
function status(r) {
  return ['pending', 'approved'].includes(r.status) && r.expiresAt <= Date.now() ? 'expired' : r.status;
}
function owner(req, res, next) {
  if (effectiveRole(req.user) !== 'owner') return res.status(403).json({ code: 1, message: '仅超级管理员可以审批密码重置' });
  next();
}
const attempts = new Map();
function rateLimit(req, res, next) {
  const now = Date.now();
  for (const [key, item] of attempts) if (item.until <= now) attempts.delete(key);
  // 只接受本机 Nginx 覆盖写入的 X-Real-IP，不使用全局 trust proxy 下可伪造的 X-Forwarded-For。
  const peer = req.socket.remoteAddress || 'unknown';
  const localProxy = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(peer);
  const realIP = req.get('X-Real-IP');
  const key = localProxy && realIP && isIP(realIP) ? realIP : peer;
  const item = attempts.get(key) || { count: 0, until: now + 10 * 60 * 1000 };
  item.count++;
  attempts.set(key, item);
  if (item.count > 20) return res.status(429).json({ code: 1, message: '请求过于频繁，请 10 分钟后再试' });
  next();
}
router.post('/requests', rateLimit, (req, res) => {
  const fields = ['username', 'realName', 'studentId', 'note'];
  const data = {};
  for (const field of fields) {
    const value = req.body?.[field];
    if (typeof value !== 'string' || !value.trim() || value.length > (field === 'note' ? 500 : 100)) {
      return res.status(400).json({ code: 1, message: '请完整填写账户名、姓名、学号和申请说明，并检查长度' });
    }
    data[field] = value.trim();
  }
  const users = read();
  const user = users.find(u => u.username === data.username);
  // 无此账号、受保护账号与重复申请均返回相同提示，避免泄露账号状态。
  const id = crypto.randomBytes(8).toString('hex');
  if (user && effectiveRole(user) !== 'owner') {
    const requests = user.passwordResetRequests || [];
    const blocked = requests.some(r => ['pending', 'approved'].includes(status(r)) || Date.now() - r.createdAt < 600000);
    if (!blocked) {
      requests.push({ id, ...data, status: 'pending', createdAt: Date.now(), expiresAt: Date.now() + day });
      user.passwordResetRequests = requests;
      write(users);
    }
  }
  res.json({ code: 0, id, message: '申请已接收，请通过微信联系管理员，提供申请编号和账户名。如曾提交申请，管理员会核对已有记录。' });
});
router.get('/requests', auth, owner, (_req, res) => {
  const list = read().flatMap(u => (u.passwordResetRequests || []).map(r => {
    const { tokenHash, ...safe } = r;
    return { ...safe, status: status(r), userId: u.id, username: u.username, registeredRealName: u.realName || '', registeredStudentId: u.studentId || '' };
  })).sort((a, b) => b.createdAt - a.createdAt);
  res.set('Cache-Control', 'no-store').json({ code: 0, list });
});
router.post('/requests/:id/decision', auth, owner, (req, res) => {
  const { action, note } = req.body || {};
  if (!['approve', 'reject', 'reissue'].includes(action) || typeof note !== 'string' || !note.trim() || note.length > 500) {
    return res.status(400).json({ code: 1, message: '请选择处理方式并填写核实备注或拒绝原因（最多 500 字）' });
  }
  const users = read();
  const user = users.find(u => (u.passwordResetRequests || []).some(r => r.id === req.params.id));
  if (!user) return res.status(404).json({ code: 1, message: '申请不存在' });
  if (effectiveRole(user) === 'owner') return res.status(400).json({ code: 1, message: '超级管理员账号须单独人工恢复' });
  const r = user.passwordResetRequests.find(r => r.id === req.params.id);
  const current = status(r);
  const allowed = action === 'reissue' ? (r.status === 'approved' && ['approved', 'expired'].includes(current)) : current === 'pending';
  if (!allowed) return res.status(409).json({ code: 1, message: '申请状态已变更，请刷新后重试' });
  if (action === 'reissue' && user.passwordResetRequests.some(other => other !== r && ['pending', 'approved'].includes(status(other)))) {
    return res.status(409).json({ code: 1, message: '已有新的申请，请处理最新申请' });
  }
  let token;
  if (action === 'reject') {
    r.status = 'rejected';
    delete r.tokenHash;
  } else {
    token = crypto.randomBytes(32).toString('hex');
    r.status = 'approved';
    r.tokenHash = hash(token);
    r.expiresAt = Date.now() + 30 * 60 * 1000;
  }
  r.reviewedBy = req.userId;
  r.reviewedAt = Date.now();
  r.reviewNote = note.trim();
  r.audit = [...(r.audit || []), { action, by: req.userId, at: r.reviewedAt, note: r.reviewNote }];
  write(users);
  const base = process.env.PASSWORD_RESET_PUBLIC_URL || 'https://sysuzgxytj.top';
  res.set('Cache-Control', 'no-store').json({ code: 0, message: action === 'reject' ? '申请已拒绝，请通过微信告知原因' : '已批准，请将链接发给已核实的本人', link: token ? `${base.replace(/\/$/, '')}/#/reset-password?token=${token}` : undefined });
});
router.post('/complete', rateLimit, (req, res) => {
  const { token, password } = req.body || {};
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return res.status(400).json({ code: 1, message: '重置链接无效或已过期，请微信联系管理员' });
  if (typeof password !== 'string' || password !== password.trim() || password.length < 8 || Buffer.byteLength(password) > 72) return res.status(400).json({ code: 1, message: '密码至少 8 个字符、最多 72 字节，首尾不能有空格' });
  const users = read();
  const digest = hash(token);
  const user = users.find(u => (u.passwordResetRequests || []).some(r => r.tokenHash === digest && status(r) === 'approved'));
  if (!user || effectiveRole(user) === 'owner') return res.status(400).json({ code: 1, message: '重置链接无效或已过期，请微信联系管理员' });
  const r = user.passwordResetRequests.find(r => r.tokenHash === digest);
  user.password = bcrypt.hashSync(password, 8);
  user.tokenVersion = (Number(user.tokenVersion) || 0) + 1;
  delete user.lastToken;
  user.updatedAt = Date.now();
  r.status = 'completed';
  r.completedAt = Date.now();
  delete r.tokenHash;
  write(users); // 密码与凭证消费在同一次原子写入中完成。
  res.set('Cache-Control', 'no-store').json({ code: 0, message: '密码已重置，请使用新密码重新登录' });
});
router.use((err, _req, res, _next) => {
  res.status(500).json({ code: 1, message: '操作未完成，请稍后重试或联系管理员' });
});
module.exports = router;
