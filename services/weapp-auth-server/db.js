const path = require('path')
const sqlite3 = require('sqlite3').verbose()
const fs = require('fs')

const DB_DIR = path.join(__dirname, 'data')
const DB_FILE = path.join(DB_DIR, 'users.sqlite')

// 确保 data 目录存在
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true })
}

const db = new sqlite3.Database(DB_FILE)

/**
 * 序列化 JSON 字段
 */
function toJson(value) {
  return JSON.stringify(value || [])
}

/**
 * 反序列化 JSON 字段
 */
function fromJson(value, defaultValue = []) {
  if (!value) return defaultValue
  try {
    return JSON.parse(value)
  } catch {
    return defaultValue
  }
}

/**
 * 初始化数据库表
 */
function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      openId TEXT UNIQUE,
      nickName TEXT,
      avatarUrl TEXT,
      role TEXT DEFAULT 'visitor',
      points INTEGER DEFAULT 0,
      unlockedLocations TEXT DEFAULT '[]',
      lockingLocations TEXT DEFAULT '[]',
      completedRoutes TEXT DEFAULT '[]',
      checkinRecords TEXT DEFAULT '[]',
      bottlesThrow TEXT DEFAULT '[]',
      bottlesReceived TEXT DEFAULT '[]',
      lastToken TEXT DEFAULT '',
      lastLogin INTEGER,
      createdAt INTEGER,
      updatedAt INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_users_openId ON users(openId);
    CREATE INDEX IF NOT EXISTS idx_users_id ON users(id);
  `)
}

initDb()

/**
 * 将数据库行转换为与旧 users.json 兼容的用户对象
 */
function rowToUser(row) {
  return {
    id: row.id,
    openId: row.openId,
    nickName: row.nickName || '',
    avatarUrl: row.avatarUrl || '',
    role: row.role || 'visitor',
    points: row.points || 0,
    unlockedLocations: fromJson(row.unlockedLocations),
    lockingLocations: fromJson(row.lockingLocations),
    completedRoutes: fromJson(row.completedRoutes),
    checkinRecords: fromJson(row.checkinRecords),
    bottlesThrow: fromJson(row.bottlesThrow),
    bottlesReceived: fromJson(row.bottlesReceived),
    lastToken: row.lastToken || '',
    lastLogin: row.lastLogin,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/**
 * 获取所有用户（兼容旧 readUsers）
 */
function readUsers() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM users ORDER BY createdAt DESC', (err, rows) => {
      if (err) return reject(err)
      resolve(rows.map(rowToUser))
    })
  })
}

/**
 * 保存所有用户（兼容旧 writeUsers）
 * 注意：SQLite 中采用 upsert 单条写入，而不是全量覆盖
 */
async function writeUsers(users) {
  if (!Array.isArray(users)) return
  for (const user of users) {
    await upsertUser(user)
  }
}

/**
 * 根据 ID 获取用户
 */
function getUserById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
      if (err) return reject(err)
      resolve(row ? rowToUser(row) : null)
    })
  })
}

/**
 * 根据 openId 获取用户
 */
function getUserByOpenId(openId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE openId = ?', [openId], (err, row) => {
      if (err) return reject(err)
      resolve(row ? rowToUser(row) : null)
    })
  })
}

/**
 * 创建用户
 */
function createUser(user) {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO users (
        id, openId, nickName, avatarUrl, role, points,
        unlockedLocations, lockingLocations, completedRoutes, checkinRecords,
        bottlesThrow, bottlesReceived, lastToken,
        lastLogin, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    const params = [
      user.id,
      user.openId,
      user.nickName || '',
      user.avatarUrl || '',
      user.role || 'visitor',
      user.points || 0,
      toJson(user.unlockedLocations),
      toJson(user.lockingLocations),
      toJson(user.completedRoutes),
      toJson(user.checkinRecords),
      toJson(user.bottlesThrow),
      toJson(user.bottlesReceived),
      user.lastToken || '',
      user.lastLogin,
      user.createdAt,
      user.updatedAt,
    ]
    db.run(sql, params, function (err) {
      if (err) return reject(err)
      resolve(rowToUser(user))
    })
  })
}

/**
 * 更新或插入用户（upsert）
 */
function upsertUser(user) {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO users (
        id, openId, nickName, avatarUrl, role, points,
        unlockedLocations, lockingLocations, completedRoutes, checkinRecords,
        bottlesThrow, bottlesReceived, lastToken,
        lastLogin, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        openId = excluded.openId,
        nickName = excluded.nickName,
        avatarUrl = excluded.avatarUrl,
        role = excluded.role,
        points = excluded.points,
        unlockedLocations = excluded.unlockedLocations,
        lockingLocations = excluded.lockingLocations,
        completedRoutes = excluded.completedRoutes,
        checkinRecords = excluded.checkinRecords,
        bottlesThrow = excluded.bottlesThrow,
        bottlesReceived = excluded.bottlesReceived,
        lastToken = excluded.lastToken,
        lastLogin = excluded.lastLogin,
        updatedAt = excluded.updatedAt
    `
    const params = [
      user.id,
      user.openId,
      user.nickName || '',
      user.avatarUrl || '',
      user.role || 'visitor',
      user.points || 0,
      toJson(user.unlockedLocations),
      toJson(user.lockingLocations),
      toJson(user.completedRoutes),
      toJson(user.checkinRecords),
      toJson(user.bottlesThrow),
      toJson(user.bottlesReceived),
      user.lastToken || '',
      user.lastLogin,
      user.createdAt,
      user.updatedAt,
    ]
    db.run(sql, params, function (err) {
      if (err) return reject(err)
      resolve(rowToUser(user))
    })
  })
}

/**
 * 关闭数据库连接
 */
function closeDb() {
  db.close()
}

module.exports = {
  db,
  initDb,
  readUsers,
  writeUsers,
  getUserById,
  getUserByOpenId,
  createUser,
  upsertUser,
  closeDb,
}
