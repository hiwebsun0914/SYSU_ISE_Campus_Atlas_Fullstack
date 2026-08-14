#!/usr/bin/env node
/**
 * 一次性补分：隐藏打卡点在 1.5 分规则上线前审核通过的记录只发了 1 分，
 * 本脚本为每条此类记录补发差额（+0.5），并同步修正记录中的 pointsAwarded。
 * 通过 pointsBackfilled 标记保证可重复执行而不重复加分。
 *
 * 用法：node backfill-hidden-points-20260814.js [--apply]
 * 默认只读演练；加 --apply 才真正写回。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { getLocation } = require('./lib/locationSettings');

const USERS_FILE = path.resolve(process.env.USERS_FILE || path.join(__dirname, 'users.json'));
const APPLY = process.argv.includes('--apply');

const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8') || '[]');
let fixedRecords = 0;
let totalDiff = 0;
const details = [];

for (const user of users) {
  if (!Array.isArray(user.checkinRecords)) continue;
  user.points = Number.isFinite(Number(user.points)) ? Number(user.points) : 0;

  for (const record of user.checkinRecords) {
    if (record.pointsBackfilled === true) continue;
    const location = getLocation(Number(record.locationId));
    if (!location || !location.isHidden) continue;

    const expected = Number(location.points);
    const awarded = Number(record.pointsAwarded);
    if (!Number.isFinite(awarded) || !Number.isFinite(expected) || awarded >= expected) continue;

    const diff = Math.round((expected - awarded) * 100) / 100;
    user.points = Math.round((user.points + diff) * 100) / 100;
    record.pointsAwarded = expected;
    record.pointsBackfilled = true;
    fixedRecords += 1;
    totalDiff = Math.round((totalDiff + diff) * 100) / 100;
    details.push(`${user.username} | 地点 ${record.locationId} ${location.name} | ${awarded} → ${expected}（+${diff}）| 用户总分 → ${user.points}`);
  }
}

console.log(APPLY ? '=== 执行模式 ===' : '=== 演练模式（不写回） ===');
details.forEach(line => console.log(line));
console.log(`共补正 ${fixedRecords} 条记录，补发 ${totalDiff} 分`);

if (APPLY && fixedRecords > 0) {
  const tempFile = `${USERS_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(users, null, 2), 'utf8');
  fs.renameSync(tempFile, USERS_FILE);
  console.log('已原子写回', USERS_FILE);
}
