import test from 'node:test'
import assert from 'node:assert/strict'
import {
  OFFICIAL_UNIVERSITY_NAME,
  OFFICIAL_SCHOOL_NAME,
  TEMPLATE_DEFAULT_FONTS,
  layoutTextBlock
} from '../src/utils/futureCardLayout.mjs'

function fakeContext(charWidth = 10) {
  return { measureText: text => ({ width: [...String(text)].length * charWidth }) }
}

test('uses the official school name and distinct template defaults', () => {
  assert.equal(OFFICIAL_UNIVERSITY_NAME, 'SUN YAT-SEN UNIVERSITY')
  assert.equal(OFFICIAL_SCHOOL_NAME, 'SCHOOL OF INTELLIGENT SYSTEMS ENGINEERING')
  assert.deepEqual(Object.values(TEMPLATE_DEFAULT_FONTS).sort(), ['hand', 'sans', 'song'])
})

test('optically lowers short text by a bounded amount', () => {
  const result = layoutTextBlock(fakeContext(), '一行文字', {
    maxWidth: 400,
    contentTop: 100,
    contentBottom: 800,
    lineHeight: 40,
    maxOpticalOffset: 120
  })
  assert.ok(result.startY > 100)
  assert.ok(result.startY <= 220)
  assert.equal(result.overflow, false)
})

test('keeps visible paragraph spacing larger than a normal line step', () => {
  const result = layoutTextBlock(fakeContext(12), '第一段\n第二段', {
    maxWidth: 240,
    contentTop: 0,
    contentBottom: 300,
    lineHeight: 30,
    paragraphGap: 24
  })
  assert.equal(result.lines.length, 2)
  assert.ok(result.lines[1].y - result.lines[0].y > 30)
  assert.equal(result.lines[1].paragraphStart, true)
})

test('reports overflow while keeping every drawable line inside the content box', () => {
  const result = layoutTextBlock(fakeContext(10), '长'.repeat(80), {
    maxWidth: 40,
    contentTop: 20,
    contentBottom: 160,
    lineHeight: 24,
    paragraphGap: 12
  })
  assert.equal(result.overflow, true)
  assert.ok(result.lines.length > 0)
  for (const line of result.lines) assert.ok(line.y + result.lineHeight <= result.contentBottom)
})
