'use strict';

/**
 * 步行路径规划代理：GET /walking?from=lng,lat&to=lng,lat
 *
 * 转发高德 Web 服务步行规划（v3/direction/walking），解决前端直接调
 * AMap.Walking 触发 CUQPS 限流导致大量路段退化为直线的问题：
 * - 结果按路段缓存到 JSON 文件（默认 48h），命中率接近 100%
 * - 缓存未命中时串行调用上游并保持最小间隔，避免触发 QPS 限制
 * - 起终点限定在校园附近范围内，防止接口被当成通用代理滥用
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const AMAP_KEY = process.env.AMAP_WEB_SERVICE_KEY || '';
const CACHE_FILE = path.resolve(
  process.env.ROUTE_WALKING_CACHE_FILE || path.join(__dirname, '..', 'route_walking_cache.json')
);
const CACHE_TTL_MS = Number(process.env.ROUTE_WALKING_CACHE_TTL_MS) > 0
  ? Number(process.env.ROUTE_WALKING_CACHE_TTL_MS)
  : 48 * 60 * 60 * 1000;
const UPSTREAM_GAP_MS = Number(process.env.ROUTE_WALKING_UPSTREAM_GAP_MS) > 0
  ? Number(process.env.ROUTE_WALKING_UPSTREAM_GAP_MS)
  : 350;
const UPSTREAM_TIMEOUT_MS = 8000;

// 南校园及周边的允许范围（防止被当作通用路径代理）
const CAMPUS_BBOX = Object.freeze({
  minLng: 113.27, maxLng: 113.33,
  minLat: 23.07, maxLat: 23.12
});

// 只对“缓存未命中、需要请求上游”的调用计数限流。
// 缓存命中只是读本地文件，不限流——否则浏览三条路线（54 段/分钟）就会误伤正常用户。
const RATE_LIMIT = Number(process.env.ROUTE_WALKING_RATE_LIMIT) > 0
  ? Number(process.env.ROUTE_WALKING_RATE_LIMIT)
  : 30;
const RATE_WINDOW_MS = 60 * 1000;
const rateWindows = new Map();

class ApiError extends Error {
  constructor(status, errorCode, message) {
    super(message);
    this.status = status;
    this.errorCode = errorCode;
  }
}

function parseLngLat(raw) {
  const parts = String(raw || '').split(',');
  if (parts.length !== 2) return null;
  const lng = Number(parts[0]);
  const lat = Number(parts[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return [lng, lat];
}

function inCampus([lng, lat]) {
  return lng >= CAMPUS_BBOX.minLng && lng <= CAMPUS_BBOX.maxLng
    && lat >= CAMPUS_BBOX.minLat && lat <= CAMPUS_BBOX.maxLat;
}

function cacheKeyOf(from, to) {
  return `${from[0].toFixed(6)},${from[1].toFixed(6)}->${to[0].toFixed(6)},${to[1].toFixed(6)}`;
}

function readCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return { entries: {} };
    const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || typeof parsed.entries !== 'object' || !parsed.entries) {
      return { entries: {} };
    }
    return parsed;
  } catch (error) {
    console.error('[route-walking] cache read failed:', error.code || error.message);
    return { entries: {} };
  }
}

function writeCache(cache) {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    const tmp = `${CACHE_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(cache), 'utf8');
    fs.renameSync(tmp, CACHE_FILE);
  } catch (error) {
    console.error('[route-walking] cache write failed:', error.code || error.message);
  }
}

// ±25% 过期抖动：各路段错开过期，避免同一天预热的缓存集体到期引发击穿
function jitterTtl() {
  return Math.round(CACHE_TTL_MS * (0.75 + Math.random() * 0.5));
}

function hitCache(cache, key, now) {
  const entry = cache.entries[key];
  if (!entry || !Array.isArray(entry.path) || entry.path.length < 2) return null;
  const ttl = Number(entry.ttlMs) > 0 ? Number(entry.ttlMs) : CACHE_TTL_MS;
  if (now - Number(entry.cachedAt || 0) > ttl) return null;
  return entry;
}

// 上游调用串行化 + 最小间隔，避免 CUQPS 限流
let upstreamQueue = Promise.resolve();
let lastUpstreamAt = 0;

function enqueueUpstream(task) {
  const run = upstreamQueue.then(async () => {
    const wait = Math.max(0, UPSTREAM_GAP_MS - (Date.now() - lastUpstreamAt));
    if (wait) await new Promise(resolve => setTimeout(resolve, wait));
    lastUpstreamAt = Date.now();
    return task();
  });
  upstreamQueue = run.catch(() => {});
  return run;
}

function parsePolyline(route) {
  const steps = route?.paths?.[0]?.steps;
  if (!Array.isArray(steps)) return null;
  const path = [];
  for (const step of steps) {
    for (const pair of String(step?.polyline || '').split(';')) {
      const [lng, lat] = pair.split(',').map(Number);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
      // 相邻 step 的首尾点重合，跳过上一点以避免重复
      const last = path[path.length - 1];
      if (last && last[0] === lng && last[1] === lat) continue;
      path.push([lng, lat]);
    }
  }
  return path.length >= 2 ? path : null;
}

async function fetchUpstream(from, to, fetchImpl) {
  const url = `https://restapi.amap.com/v3/direction/walking?key=${AMAP_KEY}`
    + `&origin=${from[0]},${from[1]}&destination=${to[0]},${to[1]}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  let body;
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    body = await response.json();
  } finally {
    clearTimeout(timer);
  }
  if (body?.status !== '1') {
    throw new ApiError(502, 'UPSTREAM_FAILED', `高德路径规划失败：${body?.info || '未知错误'}`);
  }
  const path = parsePolyline(body.route);
  if (!path) throw new ApiError(502, 'UPSTREAM_EMPTY', '高德未返回可用路径');
  return {
    path,
    distance: Number(body.route?.paths?.[0]?.distance) || 0,
    duration: Number(body.route?.paths?.[0]?.duration) || 0
  };
}

function checkRateLimit(req) {
  const now = Date.now();
  const key = req.ip || req.socket?.remoteAddress || 'unknown';
  const current = rateWindows.get(key);
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    rateWindows.set(key, { startedAt: now, count: 1 });
    return;
  }
  current.count += 1;
  if (current.count > RATE_LIMIT) {
    throw new ApiError(429, 'RATE_LIMITED', '路径规划请求过于频繁，请稍后重试');
  }
}

function sendError(res, error) {
  if (error instanceof ApiError) {
    return res.status(error.status).json({ code: 1, errorCode: error.errorCode, message: error.message });
  }
  console.error('[route-walking] unhandled error:', error?.message || error);
  return res.status(500).json({ code: 1, errorCode: 'ROUTE_FAILED', message: '路径规划暂时不可用' });
}

function createRouteWalkingRouter(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const router = express.Router();

  router.get('/walking', async (req, res) => {
    try {
      if (!AMAP_KEY) throw new ApiError(503, 'ROUTE_UNAVAILABLE', '路径规划服务未配置');
      if (typeof fetchImpl !== 'function') throw new ApiError(503, 'ROUTE_UNAVAILABLE', '路径规划服务不可用');

      const from = parseLngLat(req.query.from);
      const to = parseLngLat(req.query.to);
      if (!from || !to) throw new ApiError(400, 'INVALID_COORDS', '起终点坐标格式不正确');
      if (!inCampus(from) || !inCampus(to)) throw new ApiError(400, 'OUT_OF_RANGE', '起终点超出校园范围');

      const now = Date.now();
      const cache = readCache();
      const key = cacheKeyOf(from, to);
      const hit = hitCache(cache, key, now);
      if (hit) {
        return res.json({ code: 0, data: { path: hit.path, distance: hit.distance, duration: hit.duration, cached: true } });
      }

      // 只有需要请求高德上游时才计入限流
      checkRateLimit(req);
      const fresh = await enqueueUpstream(() => fetchUpstream(from, to, fetchImpl));
      cache.entries[key] = { ...fresh, cachedAt: now, ttlMs: jitterTtl() };
      writeCache(cache);
      return res.json({ code: 0, data: { ...fresh, cached: false } });
    } catch (error) {
      return sendError(res, error);
    }
  });

  router._test = { parseLngLat, inCampus, cacheKeyOf, parsePolyline, hitCache, jitterTtl, CAMPUS_BBOX };
  return router;
}

module.exports = createRouteWalkingRouter();
module.exports.createRouteWalkingRouter = createRouteWalkingRouter;
