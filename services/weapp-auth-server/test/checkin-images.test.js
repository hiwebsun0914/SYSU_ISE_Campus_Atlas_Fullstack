const assert = require('node:assert/strict');
const test = require('node:test');

process.env.COS_BUCKET ||= 'checkin-test-1234567890';
process.env.COS_REGION ||= 'ap-guangzhou';
process.env.TENCENT_SECRET_ID ||= 'fake-id';
process.env.TENCENT_SECRET_KEY ||= 'fake-key';

const checkinRouter = require('../routes/checkin');
const {
  CHECKIN_MAIN_MAX_BYTES,
  CHECKIN_THUMBNAIL_MAX_BYTES,
  CHECKIN_IMAGE_CONTENT_TYPE,
  IMMUTABLE_CACHE_CONTROL,
  validateUploadedImage
} = checkinRouter._test;

const head = (size, type = 'image/webp') => ({ headers: { 'content-length': String(size), 'content-type': type } });

test('publishes the intended check-in image limits and cache policy', () => {
  assert.equal(CHECKIN_MAIN_MAX_BYTES, 2097152);
  assert.equal(CHECKIN_THUMBNAIL_MAX_BYTES, 204800);
  assert.equal(CHECKIN_IMAGE_CONTENT_TYPE, 'image/webp');
  assert.equal(IMMUTABLE_CACHE_CONTROL, 'public, max-age=31536000, immutable');
});

test('accepts valid main and thumbnail image metadata', () => {
  assert.equal(validateUploadedImage(head(900000), {
    maxBytes: CHECKIN_MAIN_MAX_BYTES, expectedSize: 900000, label: '打卡图片', requireWebp: true
  }), '');
  assert.equal(validateUploadedImage(head(80000), {
    maxBytes: CHECKIN_THUMBNAIL_MAX_BYTES, expectedSize: 80000, label: '缩略图', requireWebp: true
  }), '');
});

test('rejects oversized, mismatched, and incorrectly encoded optimized uploads', () => {
  assert.match(validateUploadedImage(head(CHECKIN_MAIN_MAX_BYTES + 1), {
    maxBytes: CHECKIN_MAIN_MAX_BYTES, label: '打卡图片'
  }), /超过大小上限/);
  assert.match(validateUploadedImage(head(100000), {
    maxBytes: CHECKIN_MAIN_MAX_BYTES, expectedSize: 90000, label: '打卡图片'
  }), /大小不匹配/);
  assert.match(validateUploadedImage(head(100000, 'image/jpeg'), {
    maxBytes: CHECKIN_MAIN_MAX_BYTES, label: '打卡图片', requireWebp: true
  }), /格式不匹配/);
});
