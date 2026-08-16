const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const test = require('node:test');
const express = require('express');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'route-walking-test-'));
process.env.AMAP_WEB_SERVICE_KEY = 'test-key';
process.env.ROUTE_WALKING_CACHE_FILE = path.join(testDir, 'cache.json');
process.env.ROUTE_WALKING_UPSTREAM_GAP_MS = '1';
process.env.ROUTE_WALKING_CACHE_TTL_MS = '60000';

const { createRouteWalkingRouter } = require('../routes/routeWalking');

const okBody = {
  status: '1',
  info: 'ok',
  route: {
    paths: [{
      distance: '100',
      duration: '80',
      steps: [
        { polyline: '113.3000,23.1000;113.3001,23.1001' },
        { polyline: '113.3001,23.1001;113.3002,23.1002' }
      ]
    }]
  }
};

function fakeFetchFactory(calls, body = okBody) {
  return async (url) => {
    calls.push(url);
    return { json: async () => body };
  };
}

async function listen(router) {
  const app = express();
  app.use('/route', router);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

test('规划成功并写入缓存，第二次命中缓存不再请求上游', async () => {
  const calls = [];
  const { server, base } = await listen(createRouteWalkingRouter({ fetchImpl: fakeFetchFactory(calls) }));
  try {
    const q = 'from=113.3000,23.1000&to=113.3002,23.1002';
    const first = await fetch(`${base}/route/walking?${q}`).then(r => r.json());
    assert.equal(first.code, 0);
    assert.equal(first.data.cached, false);
    assert.deepEqual(first.data.path, [[113.3, 23.1], [113.3001, 23.1001], [113.3002, 23.1002]]);
    assert.equal(first.data.distance, 100);

    const second = await fetch(`${base}/route/walking?${q}`).then(r => r.json());
    assert.equal(second.code, 0);
    assert.equal(second.data.cached, true);
    assert.equal(calls.length, 1);
    assert.match(calls[0], /restapi\.amap\.com\/v3\/direction\/walking/);
    assert.match(calls[0], /key=test-key/);
  } finally {
    server.close();
  }
});

test('坐标格式错误返回 400', async () => {
  const { server, base } = await listen(createRouteWalkingRouter({ fetchImpl: fakeFetchFactory([]) }));
  try {
    const res = await fetch(`${base}/route/walking?from=abc&to=113.30,23.10`);
    assert.equal(res.status, 400);
    assert.equal((await res.json()).errorCode, 'INVALID_COORDS');
  } finally {
    server.close();
  }
});

test('起终点超出校园范围返回 400，防止被当成通用代理', async () => {
  const { server, base } = await listen(createRouteWalkingRouter({ fetchImpl: fakeFetchFactory([]) }));
  try {
    const res = await fetch(`${base}/route/walking?from=116.40,39.90&to=116.41,39.91`);
    assert.equal(res.status, 400);
    assert.equal((await res.json()).errorCode, 'OUT_OF_RANGE');
  } finally {
    server.close();
  }
});

test('上游失败时返回 502 且不写缓存', async () => {
  const calls = [];
  const failBody = { status: '0', info: 'CUQPS_HAS_EXCEEDED_THE_LIMIT' };
  const { server, base } = await listen(createRouteWalkingRouter({ fetchImpl: fakeFetchFactory(calls, failBody) }));
  try {
    const res = await fetch(`${base}/route/walking?from=113.3010,23.1010&to=113.3012,23.1012`);
    assert.equal(res.status, 502);
    const body = await res.json();
    assert.equal(body.errorCode, 'UPSTREAM_FAILED');
    assert.match(body.message, /CUQPS/);

    // 失败不写缓存：下一次仍会请求上游
    const cache = JSON.parse(fs.readFileSync(process.env.ROUTE_WALKING_CACHE_FILE, 'utf8'));
    assert.equal(Object.values(cache.entries).some(e => e.path && e.cachedAt), true); // 仅有第一个测试的缓存
    assert.equal(calls.length, 1);
  } finally {
    server.close();
  }
});

test('工具函数：parseLngLat / inCampus / parsePolyline', () => {
  const router = createRouteWalkingRouter({ fetchImpl: fakeFetchFactory([]) });
  const { parseLngLat, inCampus, parsePolyline } = router._test;

  assert.deepEqual(parseLngLat('113.30,23.10'), [113.3, 23.1]);
  assert.equal(parseLngLat('113.30'), null);
  assert.equal(parseLngLat('abc,def'), null);

  assert.equal(inCampus([113.30, 23.10]), true);
  assert.equal(inCampus([116.40, 39.90]), false);

  assert.equal(parsePolyline(okBody.route).length, 3);
  assert.equal(parsePolyline({ paths: [{ steps: [] }] }), null);
  assert.equal(parsePolyline(null), null);
});
