// middleware/auth.js
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

/** ====== 用户库路径：向后兼容 ======
 * 1) 优先环境变量 USERS_FILE
 * 2) 其次 ../users.json（你原来的位置）
 * 3) 再次 ../data/users.json（我给的路由示例里常用）
 */
const CANDIDATE_FILES = [
  process.env.USERS_FILE && path.resolve(process.env.USERS_FILE),
  path.join(__dirname, '..', 'users.json'),
  path.join(__dirname, '..', 'data', 'users.json')
].filter(Boolean);

function resolveUsersFile() {
  for (const fp of CANDIDATE_FILES) {
    try { if (fp && fs.existsSync(fp)) return fp; } catch {}
  }
  // 默认仍回退到原来的路径
  return path.join(__dirname, '..', 'users.json');
}
const USERS_FILE = resolveUsersFile();

/* ========== 读库工具（保持原有签名） ========== */
function readUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    const raw = fs.readFileSync(USERS_FILE, 'utf8') || '[]';
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
function getUserById(id) {
  const numId = typeof id === 'string' ? Number(id) : id;
  return readUsers().find(u => u.id === numId);
}

/* ========== Token 提取 ========== */
function parseCookies(cookieStr = '') {
  const out = {};
  cookieStr.split(';').forEach(kv => {
    const i = kv.indexOf('=');
    if (i > -1) out[kv.slice(0, i).trim()] = decodeURIComponent(kv.slice(1 + i).trim());
  });
  return out;
}

// 从请求中提取 token（多种来源）
function getTokenFromReq(req) {
  // 1) 标准/自定义头
  const h =
    req.headers.authorization ||
    req.headers['x-auth-token'] ||
    req.headers['x-token'] ||
    '';

  if (h && /^bearer /i.test(h)) return h.slice(7).trim();
  if (h) return String(h).trim();

  // 2) Cookie: token=xxx
  if (req.headers.cookie) {
    const cookies = parseCookies(req.headers.cookie);
    if (cookies.token) return String(cookies.token).trim();
  }

  // 3) 查询串（仅调试）
  if (req.query && req.query.token) return String(req.query.token).trim();

  return null;
}

/* ========== 配置 ========== */
const VERIFY_LAST_TOKEN = String(process.env.VERIFY_LAST_TOKEN || '').toLowerCase() === 'true';
const CLOCK_SKEW = parseInt(process.env.JWT_CLOCK_SKEW || '5', 10); // 秒
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

/* ========== 响应工具 ========== */
function send401(res, msg) {
  return res.status(401).json({ code: 1, message: msg || '未授权' });
}

/* ========== 从 payload 取用户 ID（兼容 id / sub / userId） ========== */
function getUserIdFromPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  // 我给你的新版签发：{ sub, username, role }
  if (payload.sub != null) return payload.sub;
  // 旧版中间件使用：{ id }
  if (payload.id != null) return payload.id;
  // 其它备选
  if (payload.userId != null) return payload.userId;
  return null;
}

/**
 * 强认证：必须登录
 */
function auth(req, res, next) {
  // 允许 CORS 预检
  if (req.method === 'OPTIONS') return next();

  const token = getTokenFromReq(req);
  if (!token) return send401(res, '未登录');

  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      clockTolerance: CLOCK_SKEW // 单位秒
    });

    const uid = getUserIdFromPayload(payload);
    if (uid == null) return send401(res, '无效的令牌');

    const user = getUserById(uid);
    if (!user) return send401(res, '用户不存在或已被删除');

    // 可选：校验与库里最近一次 token 一致
    if (VERIFY_LAST_TOKEN && user.lastToken && user.lastToken !== token) {
      return send401(res, '登录状态已变更，请重新登录');
    }

    req.userId = user.id;
    req.user = user;
    req.role = user.role || 'visitor';
    next();
  } catch {
    return send401(res, '登录已过期或无效');
  }
}

/**
 * 弱认证：可不登录，登录了则注入 req.user/req.role
 */
function optionalAuth(req, res, next) {
  const token = getTokenFromReq(req);
  if (!token) return next();

  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      clockTolerance: CLOCK_SKEW
    });
    const uid = getUserIdFromPayload(payload);
    if (uid == null) return next();
    const user = getUserById(uid);
    if (user) {
      req.userId = user.id;
      req.user = user;
      req.role = user.role || 'visitor';
    }
  } catch {
    // 忽略错误，按未登录处理
  }
  next();
}

/**
 * 角色校验：例子 requireRole('admin')
 */
function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.role || (req.user && req.user.role) || 'visitor';
    if (!roles.includes(role)) {
      return res.status(403).json({ code: 1, message: '无权限' });
    }
    next();
  };
}

// 默认导出强认证；并导出辅助中间件
module.exports = auth;
module.exports.optionalAuth = optionalAuth;
module.exports.requireRole = requireRole;
