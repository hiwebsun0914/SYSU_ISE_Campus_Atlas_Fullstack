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
