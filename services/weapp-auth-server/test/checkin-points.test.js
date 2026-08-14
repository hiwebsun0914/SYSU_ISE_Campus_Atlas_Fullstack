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
