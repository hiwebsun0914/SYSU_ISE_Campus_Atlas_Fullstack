const assert = require('node:assert/strict');
const test = require('node:test');
const { deferLegacyPendingPoints } = require('../lib/checkinPoints');

test('removes legacy pending points immediately and migrates only once', () => {
  const users = [{
    id: 1,
    points: 5,
    unlockedLocations: [],
    pendingCheckins: [{ locationId: 1 }]
  }];

  assert.equal(deferLegacyPendingPoints(users), true);
  assert.equal(users[0].points, 3);
  assert.equal(users[0].pendingCheckins[0].pointsDeferred, true);
  assert.equal(users[0].pendingCheckins[0].legacyPointsReverted, 2);

  assert.equal(deferLegacyPendingPoints(users), false);
  assert.equal(users[0].points, 3);
});

test('does not alter points for an already approved location', () => {
  const users = [{
    id: 2,
    points: 5,
    unlockedLocations: [1],
    pendingCheckins: [{ locationId: 1 }]
  }];

  assert.equal(deferLegacyPendingPoints(users), false);
  assert.equal(users[0].points, 5);
});

test('removes points left behind by a legacy rejected submission', () => {
  const users = [{
    id: 3,
    points: 7,
    unlockedLocations: [],
    pendingCheckins: [],
    checkinReviewRecords: [{ locationId: 1, status: 'rejected' }]
  }];

  assert.equal(deferLegacyPendingPoints(users), true);
  assert.equal(users[0].points, 5);
  assert.equal(users[0].checkinReviewRecords[0].pointsDeferred, true);
  assert.equal(users[0].checkinReviewRecords[0].legacyPointsReverted, 2);

  assert.equal(deferLegacyPendingPoints(users), false);
  assert.equal(users[0].points, 5);
});

test('removes every legacy award after repeated rejected submissions', () => {
  const users = [{
    id: 4,
    points: 9,
    unlockedLocations: [],
    pendingCheckins: [],
    checkinReviewRecords: [
      { locationId: 1, status: 'rejected' },
      { locationId: 1, status: 'rejected' }
    ]
  }];

  assert.equal(deferLegacyPendingPoints(users), true);
  assert.equal(users[0].points, 5);
  assert.deepEqual(
    users[0].checkinReviewRecords.map(item => item.legacyPointsReverted),
    [2, 2]
  );
});

test('does not deduct for rejections created by the deferred-points flow', () => {
  const users = [{
    id: 5,
    points: 6,
    unlockedLocations: [],
    pendingCheckins: [],
    checkinReviewRecords: [{ locationId: 1, status: 'rejected', pointsReverted: 0 }]
  }];

  assert.equal(deferLegacyPendingPoints(users), true);
  assert.equal(users[0].points, 6);
  assert.equal(users[0].checkinReviewRecords[0].pointsDeferred, true);

  assert.equal(deferLegacyPendingPoints(users), false);
  assert.equal(users[0].points, 6);
});
