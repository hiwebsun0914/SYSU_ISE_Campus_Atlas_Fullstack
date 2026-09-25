const seasonStore = require('./seasonStore');
const fs = require('fs');
const path = require('path');

function feedbackFile() {
  return path.resolve(process.env.FEEDBACK_FILE || path.join(__dirname, '..', 'feedback.json'));
}

function ensureStore() {
  const file = feedbackFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, '[]', 'utf8');
  return file;
}

function readFeedback() {
  const parsed = seasonStore.read(feedbackFile(), []);
  if (!Array.isArray(parsed)) throw new Error('FEEDBACK_FILE must contain an array');
  return parsed;
}

function writeFeedback(list) {
  seasonStore.write(feedbackFile(), list);
}

module.exports = { readFeedback, writeFeedback };
