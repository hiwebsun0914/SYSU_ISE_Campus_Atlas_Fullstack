export const OFFICIAL_UNIVERSITY_NAME = 'SUN YAT-SEN UNIVERSITY'
export const OFFICIAL_SCHOOL_NAME = 'SCHOOL OF INTELLIGENT SYSTEMS ENGINEERING'

export const TEMPLATE_DEFAULT_FONTS = Object.freeze({
  'sysu-editorial': 'song',
  'lake-morning': 'hand',
  'engineering-blueprint': 'sans'
})

export function graphemes(value) {
  const text = String(value || '')
  if (!globalThis.Intl?.Segmenter) return Array.from(text)
  return [...new Intl.Segmenter('zh-CN', { granularity: 'grapheme' }).segment(text)]
    .map(item => item.segment)
}

function wrapParagraph(ctx, paragraph, maxWidth) {
  const chars = graphemes(paragraph)
  if (!chars.length) return ['']
  const lines = []
  let line = ''
  for (const char of chars) {
    const candidate = line + char
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line)
      line = char
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

/**
 * Lay out Canvas text without letting a line overlap the footer.
 * `y` is a top-baseline coordinate so callers can render with textBaseline=top.
 */
export function layoutTextBlock(ctx, text, options = {}) {
  const maxWidth = Math.max(1, Number(options.maxWidth) || 780)
  const contentTop = Number(options.contentTop) || 0
  const contentBottom = Math.max(contentTop, Number(options.contentBottom) || contentTop)
  const lineHeight = Math.max(1, Number(options.lineHeight) || 40)
  const paragraphGap = Math.max(0, Number(options.paragraphGap) || Math.round(lineHeight * 0.55))
  const maxOpticalOffset = Math.max(0, Number(options.maxOpticalOffset) || 130)
  const paragraphs = String(text || '').replace(/\r\n?/g, '\n').split('\n')
  const rows = []
  paragraphs.forEach((paragraph, paragraphIndex) => {
    wrapParagraph(ctx, paragraph, maxWidth).forEach((line, lineIndex) => {
      rows.push({ text: line, gapBefore: paragraphIndex > 0 && lineIndex === 0 ? paragraphGap : 0 })
    })
  })

  const available = Math.max(0, contentBottom - contentTop)
  const drawable = []
  let blockHeight = 0
  let overflow = false
  for (const row of rows) {
    const nextHeight = blockHeight + row.gapBefore + lineHeight
    if (nextHeight > available && drawable.length) {
      overflow = true
      break
    }
    if (nextHeight > available) {
      overflow = true
      break
    }
    drawable.push(row)
    blockHeight = nextHeight
  }
  if (drawable.length < rows.length) overflow = true

  const freeSpace = Math.max(0, available - blockHeight)
  const startY = contentTop + Math.min(maxOpticalOffset, Math.round(freeSpace * 0.3))
  let cursor = startY
  const lines = drawable.map(row => {
    cursor += row.gapBefore
    const result = { text: row.text, y: cursor, paragraphStart: row.gapBefore > 0 }
    cursor += lineHeight
    return result
  })

  return { lines, overflow, blockHeight, startY, contentTop, contentBottom, lineHeight }
}
