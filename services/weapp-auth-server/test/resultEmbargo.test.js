const test = require('node:test');
const assert = require('node:assert/strict');
const { START, END, isEmbargoed, isHiddenFrom, REVEAL_AT } = require('../lib/resultEmbargo');

test('result embargo uses inclusive September 17 and exclusive September 19 boundaries', () => {
  assert.equal(REVEAL_AT, '2026-09-19T18:00:00+08:00');
  assert.equal(isEmbargoed(START - 1), false);
  assert.equal(isEmbargoed(START), true);
  assert.equal(isEmbargoed(END - 1), true);
  assert.equal(isEmbargoed(END), false);
});

test('only the effective owner bypasses embargo, including configured owners', () => {
  for (const user of [undefined, { role: 'visitor' }, { role: 'admin' }]) {
    assert.equal(isHiddenFrom({ user }, START), true);
  }
  assert.equal(isHiddenFrom({ user: { role: 'owner' } }, START), false);
  const old = process.env.ADMIN_OWNER_IDS;
  process.env.ADMIN_OWNER_IDS = '987';
  try {
    assert.equal(isHiddenFrom({ user: { id: 987, role: 'admin' } }, START), false);
  } finally {
    if (old === undefined) delete process.env.ADMIN_OWNER_IDS;
    else process.env.ADMIN_OWNER_IDS = old;
  }
});
