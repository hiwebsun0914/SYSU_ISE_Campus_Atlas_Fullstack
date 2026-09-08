import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const source = fs.readFileSync(path.join(here, '../src/utils/checkinImage.js'), 'utf8')
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const image = await import(moduleUrl)

test('accepts browser-decodable image formats and rejects HEIC', () => {
  assert.doesNotThrow(() => image.validateCheckinSource({ name: 'campus.jpg', type: 'image/jpeg' }))
  assert.doesNotThrow(() => image.validateCheckinSource({ name: 'campus.png', type: 'image/png' }))
  assert.throws(() => image.validateCheckinSource({ name: 'campus.heic', type: 'image/heic' }), /暂不支持 HEIC/)
  assert.throws(() => image.validateCheckinSource({ name: 'campus.gif', type: 'image/gif' }), /仅支持 JPG/)
})

test('scales landscape, portrait, and small images without enlargement', () => {
  assert.deepEqual(image.scaledDimensions({ width: 4032, height: 3024 }, 1920), { width: 1920, height: 1440 })
  assert.deepEqual(image.scaledDimensions({ width: 3024, height: 4032 }, 480), { width: 360, height: 480 })
  assert.deepEqual(image.scaledDimensions({ width: 320, height: 200 }, 480), { width: 320, height: 200 })
})

test('publishes client limits that match the server contract', () => {
  assert.equal(image.CHECKIN_MAIN_MAX_BYTES, 2097152)
  assert.equal(image.CHECKIN_THUMBNAIL_MAX_BYTES, 204800)
})

test('keeps reducing a large photo and falls back to JPEG when WebP is not really encoded', async () => {
  const originalDocument = globalThis.document
  const originalCreateImageBitmap = globalThis.createImageBitmap
  let closed = false
  const requestedTypes = []
  globalThis.createImageBitmap = async () => ({ width: 8000, height: 6000, close: () => { closed = true } })
  globalThis.document = {
    createElement() {
      const canvas = {
        width: 0,
        height: 0,
        getContext: () => ({ fillStyle: '', fillRect() {}, drawImage() {} }),
        toBlob(callback, type) {
          requestedTypes.push(type)
          if (type === 'image/webp') return callback(new Blob(['not-webp'], { type: 'image/png' }))
          const size = canvas.width > 1280 ? 3 * 1024 * 1024 : (canvas.width > 480 ? 1024 * 1024 : 100 * 1024)
          callback(new Blob([new Uint8Array(size)], { type: 'image/jpeg' }))
        }
      }
      return canvas
    }
  }

  try {
    const result = await image.prepareCheckinImages({ name: 'large.jpg', type: 'image/jpeg' })
    assert.equal(result.mime, 'image/jpeg')
    assert.equal(result.ext, 'jpg')
    assert.ok(result.main.size <= image.CHECKIN_MAIN_MAX_BYTES)
    assert.ok(result.thumbnail.size <= image.CHECKIN_THUMBNAIL_MAX_BYTES)
    assert.ok(requestedTypes.includes('image/webp'))
    assert.ok(requestedTypes.includes('image/jpeg'))
    assert.equal(closed, true)
  } finally {
    globalThis.document = originalDocument
    globalThis.createImageBitmap = originalCreateImageBitmap
  }
})

test('uses a generic processing error instead of telling users the compressed photo is too large', async () => {
  const originalDocument = globalThis.document
  const originalCreateImageBitmap = globalThis.createImageBitmap
  globalThis.createImageBitmap = async () => ({ width: 8000, height: 6000, close() {} })
  globalThis.document = {
    createElement() {
      return {
        width: 0,
        height: 0,
        getContext: () => ({ fillStyle: '', fillRect() {}, drawImage() {} }),
        toBlob: callback => callback(new Blob([new Uint8Array(3 * 1024 * 1024)], { type: 'image/webp' }))
      }
    }
  }
  try {
    await assert.rejects(
      image.prepareCheckinImages({ name: 'large.jpg', type: 'image/jpeg' }),
      /^Error: 照片处理失败，请重新拍摄$/
    )
  } finally {
    globalThis.document = originalDocument
    globalThis.createImageBitmap = originalCreateImageBitmap
  }
})
