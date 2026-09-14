const assert = require('node:assert/strict');
const test = require('node:test');
const awards = require('../data/awards');
const { isActivityEnded } = require('../winner');
const { rejectIfActivityClosed } = require('../lib/activityDeadline');

test('Beijing midnight is the first closed instant for every participant write', () => {
  assert.equal(awards.deadline, '2026-09-17T00:00:00+08:00');
  const cutoff = Date.parse(awards.deadline);
  assert.equal(isActivityEnded(cutoff - 1), false);
  assert.equal(isActivityEnded(cutoff), true);
  assert.equal(isActivityEnded(cutoff + 1), true);

  let result;
  const res = {
    status(code) { result = { status: code }; return this; },
    json(body) { result.body = body; return this; }
  };
  assert.equal(rejectIfActivityClosed(res, 403, cutoff - 1), false);
  assert.equal(result, undefined);
  assert.equal(rejectIfActivityClosed(res, 403, cutoff), true);
  assert.equal(result.status, 403);
  assert.equal(result.body.code, 4);
  assert.equal(result.body.errorCode, 'ACTIVITY_CLOSED');
});
