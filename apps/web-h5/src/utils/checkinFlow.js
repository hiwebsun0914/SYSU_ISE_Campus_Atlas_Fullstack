/**
 * 共享拍照打卡流程
 *
 * 该模块统一封装拍照 → 预签名 → 直传 COS → 提交绑定 流程，
 * 不新建任何接口 / 上传逻辑 / 审核逻辑，仅作为公共入口被两个页面调用。
 */
import { request as _reqNamed } from '@/utils/request'

const request = _reqNamed

/* ===== 共享拍照打卡流程：鉴权判定 ===== */
import auth from '@/utils/auth'

function isAuthed() {
  try {
    return typeof auth?.isLoggedIn === 'function'
      ? auth.isLoggedIn()
      : !!auth?.isLoggedIn
  } catch {
    return false
  }
}

/* ===== 共享拍照打卡流程：错误/步骤提示 ===== */
function showStepError(step, errOrMsg, extra = {}) {
  const msg = typeof errOrMsg === 'string' ? errOrMsg : (errOrMsg?.message || '未知错误')
  console.groupCollapsed(`[checkin] ❌ ${step} 失败：${msg}`)
  console.log('extra =>', extra)
  if (errOrMsg && typeof errOrMsg !== 'string') console.error(errOrMsg)
  console.groupEnd()
  alert(`${step} 失败：${msg}`)
}

/* ===== 共享拍照打卡流程：选图 =====
 * 文件选择 input 常驻 DOM（而非临时创建）：
 * 1) 部分 WebView 会忽略未挂载节点的 click()；
 * 2) 必须在用户真实点击的同步调用栈里触发 click()，
 *    否则浏览器手势激活过期后会静默拦截文件选择器。
 * capture="environment" 让移动端优先唤起后置相机，仍可切换相册。
 */
let fileInput = null

function ensureFileInput() {
  if (fileInput && document.body.contains(fileInput)) return fileInput
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.setAttribute('capture', 'environment')
  // 视觉隐藏但保留可触发性（display:none 在个别 WebView 中 click 无效）
  input.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;'
  document.body.appendChild(input)
  fileInput = input
  return input
}

function pickImageOnce() {
  return new Promise((resolve) => {
    const input = ensureFileInput()
    // 清空上次选择，确保重复选择同一文件也能触发 change
    input.value = ''
    input.onchange = () => resolve((input.files && input.files[0]) || null)
    input.click()
  })
}

/* ===== 兼容：redirect 跳转（未登录时） ===== */
function pushOrRedirect(path, route, router) {
  const redirect = encodeURIComponent((route && route.fullPath) || window.location.pathname)
  if (router) router.push({ path, query: { redirect } })
  else window.location.href = `${path}?redirect=${redirect}`
}

/* ===== 共享拍照打卡流程：统一打卡主流程 ===== */
async function runCheckin({ locationId, onPhotoUrl, onSubmitted, onError }) {
  if (!isAuthed()) {
    if (onError) onError('unauthorized')
    return { ok: false, reason: 'unauthorized' }
  }

  // 在打开文件选择器前先同步状态，避免用户对待审/已通过地点重复上传。
  const statusResponse = await request('/checkin/status', 'GET', null, { cacheBust: true })
  if (statusResponse?.ok && statusResponse?.data?.code === 0) {
    const unlocked = (statusResponse.data.unlockedLocations || []).map(Number)
    const locking = (statusResponse.data.lockingLocations || []).map(Number)
    if (unlocked.includes(Number(locationId))) {
      alert('该地点已经打卡成功，无需重复提交')
      return { ok: false, reason: 'already-approved' }
    }
    if (locking.includes(Number(locationId))) {
      alert('该地点正在审核中，请等待审核结果。审核期间不能重复打卡。')
      return { ok: false, reason: 'review-pending' }
    }
  }

  const file = await pickImageOnce()
  if (!file) return { ok: false, reason: 'no-file' }

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const fileType = file.type || 'image/jpeg'

  try {
    /* 1) 预签名 */
    let sign
    try {
      sign = await request('/checkin/presign', 'POST', { ext, locationId })
    } catch (e) {
      showStepError('预签名(/checkin/presign) 网络', e)
      if (onError) onError('presign', e)
      return { ok: false, reason: 'presign' }
    }
    if ((sign?.status && sign.status !== 200) || sign?.data?.code !== 0) {
      showStepError('预签名(/checkin/presign) 返回', sign?.data?.message || `HTTP ${sign?.status}`, { sign })
      if (onError) onError('presign', sign)
      return { ok: false, reason: 'presign' }
    }
    const { key, putUrl, contentType } = sign.data.data || {}
    if (!putUrl || !key) {
      showStepError('预签名', '返回缺少 putUrl 或 key', { signData: sign?.data })
      if (onError) onError('presign', sign)
      return { ok: false, reason: 'presign' }
    }
    const usedContentType = contentType || fileType

    /* 2) 直传对象存储（PUT） */
    let putRes
    try {
      putRes = await fetch(putUrl, {
        method: 'PUT',
        mode: 'cors',
        headers: { 'Content-Type': usedContentType },
        body: file,
      })
    } catch (e) {
      showStepError('上传(对象存储 PUT) 网络/CORS', e, { putUrl, usedContentType })
      if (onError) onError('upload', e)
      return { ok: false, reason: 'upload' }
    }
    if (!putRes.ok) {
      let bodyText = ''
      try { bodyText = await putRes.text() } catch {}
      showStepError('上传(对象存储 PUT) 状态码', `HTTP ${putRes.status}`, {
        status: putRes.status,
        headers: Object.fromEntries(putRes.headers.entries()),
        bodyText: bodyText?.slice(0, 400),
      })
      if (onError) onError('upload', putRes)
      return { ok: false, reason: 'upload' }
    }

    /* 3) 提交绑定 */
    let commit
    try {
      commit = await request('/checkin/commit', 'POST', { key, size: file.size, locationId })
    } catch (e) {
      showStepError('绑定(/checkin/commit) 网络', e)
      if (onError) onError('commit', e)
      return { ok: false, reason: 'commit' }
    }
    if ((commit?.status && commit.status !== 200) || commit?.data?.code !== 0) {
      showStepError('绑定(/checkin/commit) 返回', commit?.data?.message || `HTTP ${commit?.status}`, { commit })
      if (onError) onError('commit', commit)
      return { ok: false, reason: 'commit' }
    }
    const photoUrl = commit?.data?.url || ''
    const awardedPoints = Number(commit?.data?.awardedPoints) || 0

    /* 4) 共享拍照打卡流程的本地记录（写入 localStorage） */
    const nowISO = new Date().toISOString()
    const records = JSON.parse(localStorage.getItem('checkinRecords') || '[]')
    records.push({ locationId, time: nowISO, photo: photoUrl, status: 'pending' })
    localStorage.setItem('checkinRecords', JSON.stringify(records))

    if (onPhotoUrl) onPhotoUrl(photoUrl)
    if (onSubmitted) onSubmitted({ photoUrl, locationId, awardedPoints })

    alert('照片已提交审核。审核期间不能重复打卡，通过后才会计入积分。')
    return { ok: true, photoUrl, locationId, awardedPoints }
  } catch (err) {
    console.error('[checkin] 未捕获错误', err)
    alert('网络异常（可能是 CORS、跨域 Cookie 或对象存储拦截）')
    if (onError) onError('unknown', err)
    return { ok: false, reason: 'unknown' }
  }
}

export const checkinFlow = {
  isAuthed,
  pushOrRedirect,
  pickImageOnce,
  runCheckin,
  showStepError,
}

export default checkinFlow
