const fs = require('fs');
const path = require('path');
module.exports = function seasonFixture() {
  const dir = path.dirname(process.env.USERS_FILE);
  process.env.SEASONS_DIR = path.join(dir, 'seasons');
  for (const [env, name, content] of [['SUBMISSIONS_FILE','submissions.json',[]],['FUTURE_CARDS_FILE','future_cards.json',{cards:[]}],['FEEDBACK_FILE','feedback.json',[]],['LOCATION_SETTINGS_FILE','location-settings.json',{}]]) {
    process.env[env] ||= path.join(dir,name);
    if (!fs.existsSync(process.env[env])) fs.writeFileSync(process.env[env],JSON.stringify(content));
  }
  require('../../scripts/migrate-seasons').migrate(true);
  const store = require('../../lib/seasonStore');
  const s = store.state(); s.status = 'open'; s.config.awards.deadline = '2099-01-01T00:00:00Z'; s.config.awards.revealAt = '2099-01-02T00:00:00Z'; store.saveState(s);
  const awards = new Proxy({}, {get:(_,key)=>store.state().config.awards[key],set:(_,key,value)=>{const s=store.state();s.config.awards[key]=value;store.saveState(s);return true;}});
  return { store, awards };
};
