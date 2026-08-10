'use strict';

const fs = require('fs');
const path = require('path');
const baseLocationData = require('../data/locations');

const DEFAULT_POINTS = 1;

function settingsFile() {
  return path.resolve(
    process.env.LOCATION_SETTINGS_FILE || path.join(__dirname, '..', 'location-settings.json')
  );
}

function readSettings() {
  const file = settingsFile();
  try {
    if (!fs.existsSync(file)) return {};
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8') || '{}');
    return parsed && !Array.isArray(parsed) && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.error('[locations] read settings fail:', error);
    return {};
  }
}

function writeSettings(settings) {
  const file = settingsFile();
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tempFile = `${file}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(settings, null, 2), 'utf8');
  fs.renameSync(tempFile, file);
}

function baseLocations() {
  return Array.isArray(baseLocationData.locations) ? baseLocationData.locations : [];
}

function getLocations() {
  const settings = readSettings();
  return baseLocations().map(location => {
    const override = settings[String(location.id)] || {};
    return {
      ...location,
      ...override,
      id: Number(location.id),
      points: Number.isInteger(Number(override.points))
        ? Number(override.points)
        : DEFAULT_POINTS
    };
  });
}

function getLocation(id) {
  const locationId = Number(id);
  return getLocations().find(item => Number(item.id) === locationId) || null;
}

function stripUnsafeHtml(value) {
  return String(value || '')
    .replace(/<(script|style|iframe|object|embed|form)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|style|iframe|object|embed|form)\b[^>]*\/?\s*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '')
    .trim();
}

function validatePatch(input = {}) {
  const patch = {};

  if (Object.prototype.hasOwnProperty.call(input, 'name')) {
    const name = String(input.name || '').trim();
    if (!name || name.length > 80) throw new Error('地点名称需为 1–80 个字符');
    patch.name = name;
  }

  if (Object.prototype.hasOwnProperty.call(input, 'position')) {
    const position = String(input.position || '').trim();
    if (position.length > 120) throw new Error('地点位置最多 120 个字符');
    patch.position = position;
  }

  if (Object.prototype.hasOwnProperty.call(input, 'description')) {
    const description = stripUnsafeHtml(input.description);
    if (description.length > 20000) throw new Error('地点介绍最多 20000 个字符');
    patch.description = description;
  }

  if (Object.prototype.hasOwnProperty.call(input, 'image')) {
    const image = String(input.image || '').trim();
    if (image && !/^https?:\/\//i.test(image)) throw new Error('图片地址必须以 http:// 或 https:// 开头');
    if (image.length > 2000) throw new Error('图片地址过长');
    patch.image = image;
  }

  if (Object.prototype.hasOwnProperty.call(input, 'points')) {
    const points = Number(input.points);
    if (!Number.isInteger(points) || points < 0 || points > 100) {
      throw new Error('单点积分必须是 0–100 的整数');
    }
    patch.points = points;
  }

  if (!Object.keys(patch).length) throw new Error('没有可保存的地点字段');
  return patch;
}

function updateLocation(id, input) {
  const locationId = Number(id);
  if (!Number.isInteger(locationId) || !baseLocations().some(item => Number(item.id) === locationId)) {
    const error = new Error('打卡点不存在');
    error.statusCode = 404;
    throw error;
  }

  const patch = validatePatch(input);
  const settings = readSettings();
  settings[String(locationId)] = {
    ...(settings[String(locationId)] || {}),
    ...patch,
    updatedAt: Date.now()
  };
  writeSettings(settings);
  return getLocation(locationId);
}

module.exports = {
  DEFAULT_POINTS,
  getLocations,
  getLocation,
  updateLocation,
  stripUnsafeHtml
};
