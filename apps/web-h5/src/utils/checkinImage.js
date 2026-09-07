export const CHECKIN_MAIN_MAX_BYTES = 2 * 1024 * 1024
export const CHECKIN_THUMBNAIL_MAX_BYTES = 200 * 1024

const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

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

function canvasBlob(canvas, quality) {
  if (typeof canvas.convertToBlob === 'function') {
    return canvas.convertToBlob({ type: 'image/webp', quality })
  }
  return new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality))
}

async function renderVariant(source, { maxEdge, quality, maxBytes }) {
  let edge = maxEdge
  let currentQuality = quality
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { width, height } = scaledDimensions(source, edge)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('当前浏览器无法处理图片')
    context.fillStyle = '#fff'
    context.fillRect(0, 0, width, height)
    context.drawImage(source, 0, 0, width, height)
    const blob = await canvasBlob(canvas, currentQuality)
    canvas.width = 1
    canvas.height = 1
    if (!blob) throw new Error('图片压缩失败')
    if (blob.size <= maxBytes) return blob
    currentQuality = Math.max(0.55, currentQuality - 0.08)
    edge = Math.max(720, Math.round(edge * 0.82))
  }
  throw new Error('图片压缩后仍然过大，请换一张照片')
}

export async function prepareCheckinImages(file) {
  validateCheckinSource(file)
  const source = await decodeImage(file)
  try {
    const [main, thumbnail] = await Promise.all([
      renderVariant(source, { maxEdge: 1920, quality: 0.8, maxBytes: CHECKIN_MAIN_MAX_BYTES }),
      renderVariant(source, { maxEdge: 480, quality: 0.72, maxBytes: CHECKIN_THUMBNAIL_MAX_BYTES })
    ])
    return { main, thumbnail, mime: 'image/webp' }
  } finally {
    if (typeof source.close === 'function') source.close()
  }
}
