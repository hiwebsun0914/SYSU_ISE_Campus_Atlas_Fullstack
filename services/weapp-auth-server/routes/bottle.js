// routes/bottle.js
require('dotenv').config();
const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');

const BOTTLE_FILE = path.join(__dirname, '..', 'bottles.json');
const USERS_FILE  = path.join(__dirname, '..', 'users.json');

/* ---------- 通用读写 ---------- */
function readRaw(file) {
  try {
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, 'utf8') || '';
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}
function readUsers() {
  const u = readRaw(USERS_FILE);
  return Array.isArray(u) ? u : [];
}
function writeUsers(arr) {
  writeJSON(USERS_FILE, arr);
}
function isAdminUser(user) {
  return user && (user.role === 'admin' || user.role === 'super' || user.role === 'owner');
}

/* ---------- bottles.json 统一结构与迁移 ---------- */
// 目标结构：{ bottles: [ { id, ownerId, ownerName, ownerAvatar, text, photo, uploadTime, picks:[{userId,pickTime}] } ] }
function upgradeBottleShape(b) {
  if (!Array.isArray(b.picks)) b.picks = [];
  if (b.pickedBy && !b.picks.some(p => p.userId === b.pickedBy)) {
    b.picks.push({ userId: b.pickedBy, pickTime: b.pickTime || Date.now() });
  }
  delete b.pickedBy;
  delete b.pickTime;
  return b;
}
function getBottleDB() {
  let db = readRaw(BOTTLE_FILE);
  if (!db) {
    db = { bottles: [] };
    writeJSON(BOTTLE_FILE, db);
    return db;
  }
  if (Array.isArray(db)) db = { bottles: db };
  if (typeof db !== 'object' || !Array.isArray(db.bottles)) db = { bottles: [] };
  db.bottles = db.bottles.map(upgradeBottleShape);
  writeJSON(BOTTLE_FILE, db); // 回写一次，统一结构
  return db;
}

/* ---------- 扔瓶子 ---------- */
/**
 * POST /bottle/throw
 * body: { text?: string, photo: string }  // 兼容 photo | url | photoUrl
 */
router.post('/throw', auth, (req, res) => {
  try {
    const body  = req.body || {};
    const photo = String(body.photo || body.url || body.photoUrl || '').trim();
    const text  = String(body.text || '').slice(0, 120);
    if (!photo) return res.status(400).json({ code: 1, message: '缺少图片地址 photo' });

    const users = readUsers();
    const me = users.find(x => x.id === req.userId);
    if (!me) return res.status(404).json({ code: 1, message: '用户不存在' });

    // 头像兜底
    const avatarFromKey = me.avatarKey
      ? (
          process.env.PUBLIC_ASSET_DOMAIN
            ? `${process.env.PUBLIC_ASSET_DOMAIN}/${encodeURI(me.avatarKey)}`
            : (process.env.COS_BUCKET && process.env.COS_REGION
                ? `https://${process.env.COS_BUCKET}.cos.${process.env.COS_REGION}.myqcloud.com/${encodeURI(me.avatarKey)}`
                : (me.avatar || ''))
        )
      : (me.avatar || '');

    const db = getBottleDB();
    const id = Date.now();

    const item = {
      id,
      ownerId: me.id,
      ownerName: me.username || '匿名',
      ownerAvatar: avatarFromKey,
      text,
      photo,
      uploadTime: Date.now(),
      picks: []
    };

    db.bottles.unshift(item);
    writeJSON(BOTTLE_FILE, db);

    me.bottlesThrow = Array.isArray(me.bottlesThrow) ? me.bottlesThrow : [];
    me.bottlesThrow.push(id);
    writeUsers(users);

    return res.json({ code: 0, bottle: item });
  } catch (e) {
    console.error('[bottle/throw] error:', e);
    return res.status(500).json({ code: 1, message: '扔瓶失败' });
  }
});

/* ---------- 捞瓶子（多人可捡） ---------- */
/**
 * POST /bottle/pick
 * 策略：按时间新→旧，选第一条「不是我扔的」且「我还没捡过」的瓶子；记录这次 pick
 */
router.post('/pick', auth, (req, res) => {
  try {
    const users = readUsers();
    const me = users.find(x => String(x.id) === String(req.userId));
    if (!me) return res.status(404).json({ code: 1, message: '用户不存在' });

    const db = getBottleDB();
    db.bottles = Array.isArray(db.bottles) ? db.bottles : [];

    // 当场补齐 picks 数组，避免后续 push 报错
    for (const b of db.bottles) {
      if (!Array.isArray(b.picks)) b.picks = [];
    }

    // 可捡候选：不是自己扔的 & 我没捡过
    const eligibleIdxs = db.bottles.reduce((arr, b, i) => {
      const minePicked = b.picks.some(p => String(p.userId) === String(me.id));
      if (String(b.ownerId) !== String(me.id) && !minePicked) arr.push(i);
      return arr;
    }, []);

    if (eligibleIdxs.length === 0) {
      return res.json({ code: 0, bottle: null, message: '暂无可捡的瓶子' });
    }

    // 随机挑一只
    const idx = eligibleIdxs[Math.floor(Math.random() * eligibleIdxs.length)];
    const now = Date.now();

    db.bottles[idx].picks.push({ userId: me.id, pickTime: now });
    writeJSON(BOTTLE_FILE, db);

    me.bottlesReceived = Array.isArray(me.bottlesReceived) ? me.bottlesReceived : [];
    if (!me.bottlesReceived.includes(db.bottles[idx].id)) {
      me.bottlesReceived.unshift(db.bottles[idx].id);
    }
    me.updatedAt = now;
    writeUsers(users);

    // 前端习惯用 pickTime 展示本次捡取时间，这里带上 now
    return res.json({ code: 0, bottle: { ...db.bottles[idx], pickTime: now } });
  } catch (e) {
    console.error('[bottle/pick] error:', e);
    return res.status(500).json({ code: 1, message: '捞取失败' });
  }
});


/* ---------- 我捡到的 ---------- */
/**
 * GET /bottle/my-picked
 * 根据 bottles.picks 过滤出 “我捡过” 的瓶子，带上我的 pickTime，按 pickTime 倒序
 */
// routes/bottle.js
// 顶部确保：const express = require('express'); const router = express.Router();

router.get('/my-picked', auth, (req, res) => {
  try {
    const meId = String(req.userId);
    const db = (typeof getBottleDB === 'function' ? getBottleDB() : {}) || {};
    const bottles = Array.isArray(db.bottles) ? db.bottles : [];

    // 汇总“我捡过的”，对同一瓶子取我最新的一次 pickTime
    const mineAll = bottles
      .map(b => {
        let myLatestPickTime = null;

        if (Array.isArray(b.picks) && b.picks.length) {
          for (const p of b.picks) {
            if (String(p.userId) === meId) {
              const t = Number(p.pickTime || 0);
              if (!Number.isNaN(t)) {
                myLatestPickTime = myLatestPickTime == null ? t : Math.max(myLatestPickTime, t);
              }
            }
          }
        }

        if (myLatestPickTime == null && String(b.pickedBy) === meId) {
          const t = Number(b.pickTime || 0);
          if (!Number.isNaN(t)) myLatestPickTime = t;
        }

        if (myLatestPickTime == null) return null;

        return {
          id: b.id,
          ownerId: b.ownerId,
          ownerName: b.ownerName || '',
          ownerAvatar: b.ownerAvatar || '',
          text: b.text || '',
          photo: b.photo || '',
          uploadTime: Number(b.uploadTime || 0),
          pickTime: myLatestPickTime,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b.pickTime || 0) - (a.pickTime || 0));

    const q = req.query || {};
    const hasPaging = q.limit !== undefined || q.offset !== undefined;

    // 旧行为：不带分页参数，返回全量
    if (!hasPaging) {
      return res.json({ code: 0, list: mineAll });
    }

    // 新行为：分页
    const DEFAULT_LIMIT = 6;
    const MAX_LIMIT = 50;

    let limit = parseInt(q.limit, 10);
    if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_LIMIT;
    limit = Math.min(limit, MAX_LIMIT);

    let offset = parseInt(q.offset, 10);
    if (!Number.isFinite(offset) || offset < 0) offset = 0;

    const total = mineAll.length;
    if (offset > total) offset = total;

    const page = mineAll.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return res.json({
      code: 0,
      list: page,
      hasMore,
      total,
      offset,
      limit,
      nextOffset: Math.min(offset + limit, total),
    });
  } catch (e) {
    console.error('[bottle/my-picked] error:', e);
    return res.status(500).json({ code: 1, message: '获取捡拾列表失败' });
  }
});

// 文件末尾确保：module.exports = router;


/* ============================================================
   ===============       后台管理接口       ====================
   ============================================================ */

/**
 * GET /admin/bottles?status=all|picked|unpicked
 * 返回：{ code:0, list:[...], stat:{all,picked,unpicked}, users:[{id,username}] }
 */
router.get('/admin/bottles', auth, (req, res) => {
  try {
    const users = readUsers();
    const me = users.find(x => x.id === req.userId);
    if (!isAdminUser(me)) return res.status(403).json({ code: 1, message: '无权限' });

    const db = getBottleDB();
    const status = String(req.query.status || 'all');

    const list = db.bottles.map(b => ({ ...b, uploadTime: b.uploadTime || 0 }));

    const all = list.length;
    const picked = list.filter(b => Array.isArray(b.picks) && b.picks.length > 0).length;
    const unpicked = all - picked;

    const filtered = list.filter(b => {
      if (status === 'picked')   return b.picks && b.picks.length > 0;
      if (status === 'unpicked') return !(b.picks && b.picks.length > 0);
      return true; // all
    });

    const usersLite = users.map(u => ({ id: u.id, username: u.username || '' }));

    return res.json({ code: 0, list: filtered, stat: { all, picked, unpicked }, users: usersLite });
  } catch (e) {
    console.error('[admin/bottles] error:', e);
    return res.status(500).json({ code: 1, message: '获取漂流瓶失败' });
  }
});

/**
 * 内部工具：按 id 删除，并同步清理 users.json 引用
 */
function deleteBottleById(idNum) {
  const db = getBottleDB();
  const idx = db.bottles.findIndex(b => Number(b.id) === idNum);
  if (idx === -1) return { changed: false };

  db.bottles.splice(idx, 1);
  writeJSON(BOTTLE_FILE, db);

  const users = readUsers();
  let touched = false;
  users.forEach(u => {
    if (Array.isArray(u.bottlesThrow)) {
      const before = u.bottlesThrow.length;
      u.bottlesThrow = u.bottlesThrow.filter(x => Number(x) !== idNum);
      if (u.bottlesThrow.length !== before) touched = true;
    }
    if (Array.isArray(u.bottlesReceived)) {
      const before2 = u.bottlesReceived.length;
      u.bottlesReceived = u.bottlesReceived.filter(x => Number(x) !== idNum);
      if (u.bottlesReceived.length !== before2) touched = true;
    }
  });
  if (touched) writeUsers(users);

  return { changed: true };
}

/**
 * DELETE /admin/bottles/:id  —— 与前端优先路径适配（204 无 body）
 */
router.delete('/admin/bottles/:id', auth, (req, res) => {
  try {
    const users = readUsers();
    const me = users.find(x => x.id === req.userId);
    if (!isAdminUser(me)) return res.status(403).json({ code: 1, message: '无权限' });

    const idNum = Number(req.params.id);
    if (!idNum) return res.status(400).json({ code: 1, message: '无效的 id' });

    const { changed } = deleteBottleById(idNum);
    if (!changed) return res.status(404).json({ code: 1, message: '记录不存在' });

    return res.status(204).end();
  } catch (e) {
    console.error('[admin/bottles/:id DELETE] error:', e);
    return res.status(500).json({ code: 1, message: '删除失败' });
  }
});

/**
 * POST /admin/bottles/:id/delete  —— 兜底路径（200 { code:0 }）
 */
router.post('/admin/bottles/:id/delete', auth, (req, res) => {
  try {
    const users = readUsers();
    const me = users.find(x => x.id === req.userId);
    if (!isAdminUser(me)) return res.status(403).json({ code: 1, message: '无权限' });

    const idNum = Number(req.params.id);
    if (!idNum) return res.status(400).json({ code: 1, message: '无效的 id' });

    const { changed } = deleteBottleById(idNum);
    if (!changed) return res.status(404).json({ code: 1, message: '记录不存在' });

    return res.json({ code: 0 });
  } catch (e) {
    console.error('[admin/bottles/:id/delete POST] error:', e);
    return res.status(500).json({ code: 1, message: '删除失败' });
  }
});

module.exports = router;
