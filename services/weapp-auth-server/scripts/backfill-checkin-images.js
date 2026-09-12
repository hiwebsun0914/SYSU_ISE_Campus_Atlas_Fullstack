#!/usr/bin/env node
'use strict';

require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const COS = require('cos-nodejs-sdk-v5');
const sharp = require('sharp');
const { locations } = require('../data/locations');

const CACHE_CONTROL = 'public, max-age=31536000, immutable';
const apply = process.argv.includes('--apply');
const locationsOnly = process.argv.includes('--locations-only');
const usersFile = path.resolve(process.env.USERS_FILE || path.join(__dirname, '..', 'users.json'));
const { COS_BUCKET, COS_REGION, PUBLIC_ASSET_DOMAIN, TENCENT_SECRET_ID, TENCENT_SECRET_KEY } = process.env;

if (!COS_BUCKET || !COS_REGION || !TENCENT_SECRET_ID || !TENCENT_SECRET_KEY) {
  throw new Error('缺少 COS_BUCKET、COS_REGION、TENCENT_SECRET_ID 或 TENCENT_SECRET_KEY');
}

const cos = new COS({ SecretId: TENCENT_SECRET_ID, SecretKey: TENCENT_SECRET_KEY });
const publicBase = String(PUBLIC_ASSET_DOMAIN || `https://${COS_BUCKET}.cos.${COS_REGION}.myqcloud.com`).replace(/\/$/, '');
const stats = { checkins: 0, locations: 0, skipped: 0 };

const call = (method, params) => new Promise((resolve, reject) => {
  cos[method](params, (error, data) => error ? reject(error) : resolve(data));
});
const objectParams = key => ({ Bucket: COS_BUCKET, Region: COS_REGION, Key: key });
const toUrl = key => `${publicBase}/${encodeURI(key)}`;

function keyFromUrl(url) {
  try { return decodeURIComponent(new URL(url).pathname.replace(/^\//, '')); } catch { return ''; }
}

async function exists(key) {
  try { await call('headObject', objectParams(key)); return true; } catch { return false; }
}

async function locationPreviewNeedsRefresh(key) {
  try {
    const head = await call('headObject', objectParams(key));
    const bytes = Number(head?.headers?.['content-length'] || 0);
    const cacheControl = String(head?.headers?.['cache-control'] || '');
    return !bytes || bytes > 300 * 1024 || cacheControl !== CACHE_CONTROL;
  } catch { return true; }
}

async function hasLongCache(key) {
  try {
    const head = await call('headObject', objectParams(key));
    return String(head?.headers?.['cache-control'] || '') === CACHE_CONTROL;
  } catch { return false; }
}

async function readObject(key) {
  const data = await call('getObject', objectParams(key));
  return Buffer.isBuffer(data.Body) ? data.Body : Buffer.from(data.Body);
}

async function webpWithin(input, width, maxBytes, initialQuality) {
  let quality = initialQuality;
  let edge = width;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const output = await sharp(input, { failOn: 'none' })
      .rotate()
      .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .webp({ quality })
      .toBuffer();
    if (output.length <= maxBytes) return output;
    quality = Math.max(52, quality - 8);
    edge = Math.max(320, Math.round(edge * 0.84));
  }
  throw new Error(`转码后仍超过 ${maxBytes} 字节`);
}

async function uploadDerived(key, body) {
  if (!apply) return;
  await call('putObject', {
    ...objectParams(key), Body: body, ContentLength: body.length,
    ContentType: 'image/webp', CacheControl: CACHE_CONTROL, ACL: 'public-read'
  });
}

async function addLongCache(key, contentType) {
  if (await hasLongCache(key)) return;
  if (!apply) return;
  const copySource = `${COS_BUCKET}.cos.${COS_REGION}.myqcloud.com/${encodeURI(key)}`;
  await call('putObjectCopy', {
    ...objectParams(key), CopySource: copySource, MetadataDirective: 'Replaced',
    ContentType: contentType, CacheControl: CACHE_CONTROL, ACL: 'public-read'
  });
}

async function backfillCheckin(record) {
  const sourceKey = record.key || keyFromUrl(record.photo);
  if (!sourceKey || !/^checkin\//.test(sourceKey)) { stats.skipped += 1; return false; }
  const thumbnailKey = record.thumbnailKey || sourceKey.replace(/\.[^.]+$/, '_thumb.webp');
  if (!(await exists(thumbnailKey))) {
    const thumbnail = await webpWithin(await readObject(sourceKey), 480, 200 * 1024, 72);
    await uploadDerived(thumbnailKey, thumbnail);
    stats.checkins += 1;
  } else stats.skipped += 1;
  record.thumbnailKey = thumbnailKey;
  record.thumbnail = toUrl(thumbnailKey);
  return true;
}

async function backfillLocations() {
  async function backfillLocation(location) {
    const sourceKey = keyFromUrl(location.image);
    if (!sourceKey) { stats.skipped += 1; return; }
    const filename = path.posix.basename(sourceKey).replace(/\.[^.]+$/, '.webp');
    const previewKey = `Position/review-v1/${filename}`;
    if (await locationPreviewNeedsRefresh(previewKey)) {
      if (apply) {
        const source = await readObject(sourceKey);
        const preview = await webpWithin(source, 1200, 300 * 1024, 76);
        await uploadDerived(previewKey, preview);
      }
      stats.locations += 1;
    } else stats.skipped += 1;
    const contentType = /\.png$/i.test(sourceKey) ? 'image/png' : /\.webp$/i.test(sourceKey) ? 'image/webp' : 'image/jpeg';
    if (apply) await addLongCache(sourceKey, contentType);
  }
  for (let index = 0; index < locations.length; index += 4) {
    await Promise.all(locations.slice(index, index + 4).map(backfillLocation));
    console.log(`地点图进度 ${Math.min(index + 4, locations.length)}/${locations.length}`);
  }
}

async function main() {
  let users = [];
  if (!locationsOnly) {
    users = JSON.parse(fs.readFileSync(usersFile, 'utf8') || '[]');
    for (const user of users) {
      for (const record of user.pendingCheckins || []) await backfillCheckin(record);
      for (const record of user.checkinReviewRecords || []) await backfillCheckin(record);
    }
  }
  await backfillLocations();
  if (apply && !locationsOnly) {
    const temporary = `${usersFile}.thumbnail-backfill.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(users, null, 2), 'utf8');
    fs.renameSync(temporary, usersFile);
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', ...stats }, null, 2));
  if (!apply) console.log('检查完成；确认结果后添加 --apply 执行回填。');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
