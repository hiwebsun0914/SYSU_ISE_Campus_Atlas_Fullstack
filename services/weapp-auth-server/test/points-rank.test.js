const assert = require('node:assert/strict');
const test = require('node:test');
const { buildPointsRank, pointsReachedAt, RANK_LIMIT } = require('../lib/pointsRank');

test('同分不并列：先达到该分数者名次靠前，名次连续编号', () => {
  const users = [
    { id: 1, username: '晚到', points: 3, pointsUpdatedAt: 2000 },
    { id: 2, username: '先到', points: 3, pointsUpdatedAt: 1000 },
    { id: 3, username: '最高', points: 5, pointsUpdatedAt: 3000 }
  ];

  const list = buildPointsRank(users);
  assert.deepEqual(list.map(it => it.rank), [1, 2, 3]);
  assert.deepEqual(list.map(it => it.userId), [3, 2, 1]);
  assert.equal(new Set(list.map(it => it.rank)).size, list.length);
});

test('缺少 pointsUpdatedAt 的历史数据回退到注册时间', () => {
  const users = [
    { id: 1, username: '新用户', points: 0, createdAt: 2000 },
    { id: 2, username: '老用户', points: 0, createdAt: 1000 }
  ];

  const list = buildPointsRank(users);
  assert.deepEqual(list.map(it => it.userId), [2, 1]);
  assert.deepEqual(list.map(it => it.rank), [1, 2]);
});

test('pointsUpdatedAt 优先于 createdAt', () => {
  const users = [
    { id: 1, username: '甲', points: 2, createdAt: 500, pointsUpdatedAt: 9000 },
    { id: 2, username: '乙', points: 2, createdAt: 100, pointsUpdatedAt: 8000 }
  ];

  const list = buildPointsRank(users);
  assert.deepEqual(list.map(it => it.userId), [2, 1]);
});

test('榜单只返回前 20 名', () => {
  const users = Array.from({ length: 25 }, (_, i) => ({
    id: i + 1,
    username: `用户${i + 1}`,
    points: 25 - i,
    pointsUpdatedAt: 1000 + i
  }));

  const list = buildPointsRank(users);
  assert.equal(list.length, RANK_LIMIT);
  assert.equal(RANK_LIMIT, 20);
  assert.equal(list[0].userId, 1);
  assert.equal(list[19].userId, 20);
});

test('超管不参与积分排名', () => {
  const users = [
    { id: 1, username: '超管', role: 'owner', points: 99 },
    { id: 2, username: '同学', points: 1 }
  ];

  const list = buildPointsRank(users);
  assert.equal(list.length, 1);
  assert.equal(list[0].userId, 2);
  assert.equal(list[0].rank, 1);
});

test('pointsReachedAt 缺失时兜底为最大值', () => {
  assert.equal(pointsReachedAt({}), Number.MAX_SAFE_INTEGER);
  assert.equal(pointsReachedAt({ pointsUpdatedAt: 'abc', createdAt: 'xyz' }), Number.MAX_SAFE_INTEGER);
});
