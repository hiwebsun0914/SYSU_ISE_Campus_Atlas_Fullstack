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
  const raw = fs.readFileSync(ensureStore(), 'utf8') || '[]';
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('FEEDBACK_FILE must contain an array');
  return parsed;
}

function writeFeedback(list) {
  const file = ensureStore();
  const tempFile = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(list, null, 2), 'utf8');
  fs.renameSync(tempFile, file);
}

module.exports = { readFeedback, writeFeedback };
