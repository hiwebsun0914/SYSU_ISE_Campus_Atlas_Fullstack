const seasonStore = require('./seasonStore');
'use strict';

const { effectiveRole } = require('./roles');

const START = Date.parse('2026-09-17T00:00:00+08:00');
const END = Date.parse('2026-09-19T18:00:00+08:00');
const REVEAL_AT = '2026-09-19T18:00:00+08:00';

function isEmbargoed(now = Date.now()) {
  if (seasonStore.enabled()) {
    const awards = seasonStore.state().config.awards;
    return now >= Date.parse(awards.deadline) && now < Date.parse(awards.revealAt);
  }
  return now >= START && now < END;
}

function isHiddenFrom(req, now = Date.now()) {
  return isEmbargoed(now) && effectiveRole(req.user) !== 'owner';
}

function revealAt() { return seasonStore.enabled() ? seasonStore.state().config.awards.revealAt : REVEAL_AT; }

function setNoStore(res) {
  res.set('Cache-Control', 'private, no-store');
  res.set('Vary', 'Authorization, Cookie');
}

module.exports = { START, END, REVEAL_AT, revealAt, isEmbargoed, isHiddenFrom, setNoStore };
