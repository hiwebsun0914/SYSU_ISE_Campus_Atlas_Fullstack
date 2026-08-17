'use strict';

const fs = require('fs');
const path = require('path');
const baseLocationData = require('../data/locations');

const DEFAULT_POINTS = 1;
const HIDDEN_DEFAULT_POINTS = 1.5;
const DEFAULT_CHECKIN_RADIUS = 50;
const MIN_CHECKIN_RADIUS = 10;
const MAX_CHECKIN_RADIUS = 500;

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

function getLocations(options = {}) {
  const { includeRetired = false } = options || {};
  const settings = readSettings();
  return baseLocations()
    .filter(location => includeRetired || !location.retired)
    .map(location => {
      const override = settings[String(location.backendId)] || {};
      const overridePoints = Number(override.points);
      const overrideRadius = Number(override.checkinRadius);
      const baseRadius = Number(location.checkinRadius);
      return {
        ...location,
        ...override,
        backendId: Number(location.backendId),
        points: Number.isFinite(overridePoints) && override.points !== undefined && override.points !== ''
          ? overridePoints
          : (location.isHidden ? HIDDEN_DEFAULT_POINTS : DEFAULT_POINTS),
        checkinRadius: Number.isFinite(overrideRadius) && overrideRadius > 0
          ? overrideRadius
          : (Number.isFinite(baseRadius) && baseRadius > 0 ? baseRadius : DEFAULT_CHECKIN_RADIUS)
      };
    });
}

function getLocation(backendId) {
  const locationId = Number(backendId);
  // 单点查询包含已下线（retired）地点：历史打卡/积分记录仍能解析名称与属性，
  // 但列表接口（getLocations 默认）不再下发，等于从打卡点中剔除。
  return getLocations({ includeRetired: true }).find(item => Number(item.backendId) === locationId) || null;
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
    if (!Number.isFinite(points) || points < 0 || points > 100 || Math.round(points * 2) !== points * 2) {
      throw new Error('单点积分必须是 0–100 之间、以 0.5 为步进的分值');
    }
    patch.points = points;
  }

  if (Object.prototype.hasOwnProperty.call(input, 'checkinRadius')) {
    const radius = Number(input.checkinRadius);
    if (!Number.isInteger(radius) || radius < MIN_CHECKIN_RADIUS || radius > MAX_CHECKIN_RADIUS) {
      throw new Error(`打卡半径必须是 ${MIN_CHECKIN_RADIUS}–${MAX_CHECKIN_RADIUS} 之间的整数（米）`);
    }
    patch.checkinRadius = radius;
  }

  if (!Object.keys(patch).length) throw new Error('没有可保存的地点字段');
  return patch;
}

function updateLocation(backendId, input) {
  const locationId = Number(backendId);
  if (!Number.isInteger(locationId) || !baseLocations().some(item => Number(item.backendId) === locationId)) {
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
  HIDDEN_DEFAULT_POINTS,
  DEFAULT_CHECKIN_RADIUS,
  getLocations,
  getLocation,
  updateLocation,
  stripUnsafeHtml
};
