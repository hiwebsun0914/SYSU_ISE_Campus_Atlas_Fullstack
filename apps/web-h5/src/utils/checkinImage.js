export const CHECKIN_MAIN_MAX_BYTES = 2 * 1024 * 1024
export const CHECKIN_THUMBNAIL_MAX_BYTES = 200 * 1024

const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const OUTPUT_FORMATS = [
  { mime: 'image/webp', ext: 'webp' },
  { mime: 'image/jpeg', ext: 'jpg' }
]

export const MAIN_COMPRESSION_STEPS = [
  { maxEdge: 1920, quality: 0.80 },
  { maxEdge: 1600, quality: 0.70 },
  { maxEdge: 1280, quality: 0.60 },
  { maxEdge: 1280, quality: 0.50 },
  { maxEdge: 1280, quality: 0.42 },
  { maxEdge: 1280, quality: 0.35 }
]

export const THUMBNAIL_COMPRESSION_STEPS = [
  { maxEdge: 480, quality: 0.72 },
  { maxEdge: 400, quality: 0.60 },
  { maxEdge: 320, quality: 0.50 },
  { maxEdge: 240, quality: 0.40 }
]

export function validateCheckinSource(file) {
  const type = String(file?.type || '').toLowerCase()
  const name = String(file?.name || '').toLowerCase()
  if (/\.(heic|heif)$/i.test(name) || /image\/hei[cf]/i.test(type)) {
    throw new Error('暂不支持 HEIC/HEIF，请在相册中转换为 JPG、PNG 或 WebP 后重试')
  }
  if (!file || !SUPPORTED_TYPES.has(type)) throw new Error('仅支持 JPG、PNG 或 WebP 图片')
}

async function decodeImage(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }) } catch {}
    try { return await createImageBitmap(file) } catch {}
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => { URL.revokeObjectURL(url); resolve(image) }
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('无法读取这张图片')) }
    image.src = url
  })
}

export function scaledDimensions(source, maxEdge) {
  const width = source.naturalWidth || source.width
  const height = source.naturalHeight || source.height
  if (!width || !height) throw new Error('图片尺寸无效')
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

function canvasBlob(canvas, mime, quality) {
  if (typeof canvas.convertToBlob === 'function') {
    return canvas.convertToBlob({ type: mime, quality })
  }
  return new Promise(resolve => canvas.toBlob(resolve, mime, quality))
}

async function encodeStep(source, { maxEdge, quality }, mime) {
  const { width, height } = scaledDimensions(source, maxEdge)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) throw new Error('当前浏览器无法处理图片')
  context.fillStyle = '#fff'
  context.fillRect(0, 0, width, height)
  context.drawImage(source, 0, 0, width, height)
  try {
    return await canvasBlob(canvas, mime, quality)
  } finally {
    canvas.width = 1
    canvas.height = 1
  }
}

async function renderVariant(source, { steps, maxBytes, formats = OUTPUT_FORMATS }) {
  for (const format of formats) {
    for (const step of steps) {
      const blob = await encodeStep(source, step, format.mime)
      if (!blob) continue
      // Some WebViews silently return PNG when WebP is requested. Do not upload
      // bytes under a mismatched extension/content type; fall back to JPEG.
      if (String(blob.type).toLowerCase() !== format.mime) break
      if (blob.size > 0 && blob.size <= maxBytes) return { blob, ...format }
    }
  }
  throw new Error('照片处理失败，请重新拍摄')
}

export async function prepareCheckinImages(file) {
  validateCheckinSource(file)
  const source = await decodeImage(file)
  try {
    const main = await renderVariant(source, {
      steps: MAIN_COMPRESSION_STEPS,
      maxBytes: CHECKIN_MAIN_MAX_BYTES
    })
    // Keep both derivatives in one format so the signed keys and headers match
    // the bytes actually uploaded.
    const thumbnail = await renderVariant(source, {
      steps: THUMBNAIL_COMPRESSION_STEPS,
      maxBytes: CHECKIN_THUMBNAIL_MAX_BYTES,
      formats: [{ mime: main.mime, ext: main.ext }]
    })
    return { main: main.blob, thumbnail: thumbnail.blob, mime: main.mime, ext: main.ext }
  } catch (error) {
    if (error?.message === '照片处理失败，请重新拍摄') throw error
    throw new Error('照片处理失败，请重新拍摄')
  } finally {
    if (typeof source.close === 'function') source.close()
  }
}
