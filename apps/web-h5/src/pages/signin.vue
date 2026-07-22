<!-- src/pages/signin.vue -->
<template>
  <div class="signin-page">
    <!-- 背景 -->
    <img class="bg-img" src="https://sysuzngcxy-1322240898.cos.ap-guangzhou.myqcloud.com/bg.jpg" alt="bg" />

    <!-- LOGO -->
    <div class="logo-container">
      <img class="logo-img" src="https://sysuzngcxy-1322240898.cos.ap-guangzhou.myqcloud.com/logo1.png" alt="logo" />
    </div>

    <!-- 模式切换 -->
    <div class="mode-tabs">
      <button :class="['tab', mode==='login' && 'active']" @click="mode='login'">登录</button>
      <button :class="['tab', mode==='register' && 'active']" @click="mode='register'">注册</button>
    </div>

    <!-- 表单 -->
    <div class="login-box">
      <input class="input" placeholder="请输入昵称" v-model.trim="username" />
      <input v-if="mode==='register'"
             class="input"
             placeholder="请输入手机号（仅用于联系）"
             inputmode="numeric" maxlength="11" v-model.trim="phone" />
      <input class="input" placeholder="请输入密码" type="password" v-model="password" />
    </div>

    <div class="btn-row">
      <button class="login-btn"
              :disabled="submitting || uploading"
              @click="onSubmit">
        <span v-if="uploading">
          {{ uploadStatusText }}
        </span>
        <span v-else>
          {{ submitting ? '提交中…' : (mode==='login' ? '登录' : '注册并上传头像') }}
        </span>
      </button>
    </div>

    <!-- 头像上传进度与操作（仅注册后） -->
    <div v-if="showUploadPanel" class="upload-panel">
      <div class="upload-row">
        <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="onAvatarChosen" />
        <button class="secondary-btn" @click="triggerChoose" :disabled="uploading">选择头像</button>
        <button class="secondary-btn" @click="skipAvatar" :disabled="uploading">跳过</button>
      </div>

      <div v-if="uploading" class="progress-wrap">
        <div class="progress-bar">
          <div class="progress-inner" :style="{ width: progress + '%' }"></div>
        </div>
        <div class="progress-text">
          <span>{{ progress.toFixed(0) }}%</span>
          <span v-if="speedText">｜{{ speedText }}</span>
          <span v-if="etaText">｜剩余 {{ etaText }}</span>
          <button class="link-btn" @click="cancelUpload">取消上传</button>
        </div>
      </div>

      <div class="tip-text">支持 jpg/png/webp；会自动压缩到较小体积以加快上传。</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { request } from '@/utils/request'

const router = useRouter()
const route  = useRoute()

const mode        = ref('login') // 'login' | 'register'
const username    = ref('')
const phone       = ref('')
const password    = ref('')
const redirect    = ref('')

const submitting  = ref(false)

/* ==== 上传相关状态 ==== */
const showUploadPanel = ref(false)   // 注册完成后展示
const uploading       = ref(false)
const uploadStatusText= ref('正在上传头像…')
const progress        = ref(0)       // 0-100
const speedText       = ref('')      // KB/s / MB/s
const etaText         = ref('')      // 剩余时间
const fileInput       = ref(null)

let aborter = null                   // 直传 PUT 的取消
let currentCosTaskId = null          // COS SDK 的取消

/* ==== 参数（可按需调整） ==== */
const MAX_DIM         = 1920         // 压缩最长边
const MAX_RETRY       = 2            // 上传失败重试次数
const MIN_COMPRESS_MB = 0.8          // 文件大于该阈值（MB）才压缩

onMounted(() => {
  document.title = mode.value === 'login' ? '登录' : '注册'
  const r = route.query?.redirect ? decodeURIComponent(String(route.query.redirect)) : ''
  redirect.value = r
  // 空闲时预加载 COS SDK，减少之后等待
  idle(ensureCosLoaded)
})

// 切换页签时同步标题（小优化，非功能性）
watch(mode, (m) => { document.title = m === 'login' ? '登录' : '注册' })

/* ====== 辅助 ====== */
function idle(cb){
  if ('requestIdleCallback' in window) return requestIdleCallback(cb, { timeout: 1500 })
  return setTimeout(cb, 200)
}
function isValidPhone(val) {
  if (!val) return true
  return /^1[3-9]\d{9}$/.test(String(val))
}
function extToMime(ext = 'jpg') {
  const m = String(ext || '').toLowerCase()
  if (m === 'png') return 'image/png'
  if (m === 'webp') return 'image/webp'
  return 'image/jpeg'
}

/* ================= 修复登录：严格区分登录/注册 ================= */
async function onSubmit() {
  if (submitting.value) return
  if (!username.value || !password.value) {
    alert('请输入账号密码'); return
  }
  if (mode.value === 'register' && !isValidPhone(phone.value)) {
    alert('手机号格式不正确'); return
  }

  submitting.value = true
  try {
    if (mode.value === 'login') {
      await handleLoginStrict(username.value, password.value)
      alert('登录成功')
      goNext()
    } else {
      await handleRegister(username.value, password.value, phone.value)
      // 注册成功后走头像上传面板（原逻辑保持）
      showUploadPanel.value = true
      triggerChoose()
    }
  } catch (e) {
    // 统一错误提示
    const msg = e?.message || '操作失败，请稍后重试'
    alert(msg)
  } finally {
    submitting.value = false
  }
}

/** 严格登录：不会自动创建账号；若账号不存在直接提示 */
async function handleLoginStrict(name, pass) {
  // 1) 首选 /auth/login
  try {
    const resp = await request('/auth/login', 'POST', { username: name, password: pass })
    const ok = normalizeOk(resp)
    if (!ok) {
      const why = normalizeWhy(resp)
      if (why === 'USER_NOT_FOUND') throw new Error('账号不存在')
      if (why === 'BAD_PASSWORD')  throw new Error('密码错误')
      throw new Error(normalizeMsg(resp) || '登录失败')
    }
    persistLogin(resp)
    return
  } catch (err) {
    // 如果接口不存在/404/网络错误，继续降级策略
  }

  // 2) 可选：查询是否存在该账号（支持任一存在性接口）
  const exists = await safeCheckUserExists(name)
  if (exists === false) throw new Error('账号不存在')

  // 3) 兼容后端仍只提供 /login_or_register 的情况：显式声明登录模式，禁止自动创建
  try {
    const resp = await request('/login_or_register', 'POST', {
      username: name, password: pass, phone: '',
      mode: 'login', allowCreate: false, registerIfNotExist: false
    })
    const ok = normalizeOk(resp)
    if (!ok) {
      const why = normalizeWhy(resp)
      if (why === 'USER_NOT_FOUND') throw new Error('账号不存在')
      if (why === 'BAD_PASSWORD')  throw new Error('密码错误')
      throw new Error(normalizeMsg(resp) || '登录失败')
    }
    // 若后端仍然误创建了用户，这里也会拿到 token。你可以按需在此增加二次判断。
    persistLogin(resp)
  } catch (e) {
    // 最后保底：如果有 exists===true 但登录接口不可用，给出明确报错
    throw new Error('登录接口不可用或服务异常')
  }
}

/** 注册：优先 /auth/register，不可用再降级到 /login_or_register */
async function handleRegister(name, pass, phoneNum) {
  // 1) 首选 /auth/register
  try {
    const resp = await request('/auth/register', 'POST', { username: name, password: pass, phone: phoneNum })
    const ok = normalizeOk(resp)
    if (!ok) throw new Error(normalizeMsg(resp) || '注册失败')
    persistLogin(resp) // 大多数注册接口会直接返回 token
    return
  } catch (err) {
    // 降级
  }

  // 2) 兼容：/login_or_register 作为注册模式
  const resp = await request('/login_or_register', 'POST', {
    username: name, password: pass, phone: phoneNum, mode: 'register'
  })
  const ok = normalizeOk(resp)
  if (!ok) throw new Error(normalizeMsg(resp) || '注册失败')
  persistLogin(resp)
}

/** 查询账号是否存在（支持两种常见接口名，任一可用即可） */
async function safeCheckUserExists(name) {
  try {
    const r1 = await request('/auth/user_exists', 'GET', { username: name })
    const v1 = pickExists(r1)
    if (typeof v1 === 'boolean') return v1
  } catch {}
  try {
    const r2 = await request('/user/exists', 'GET', { username: name })
    const v2 = pickExists(r2)
    if (typeof v2 === 'boolean') return v2
  } catch {}
  return null // 不可用则返回 null（未知）
}

/* ====== 规范化/持久化工具 ====== */
function normalizeOk(resp) {
  // 兼容 { data:{ code:0, token, userInfo } } 或 { code:0, ... }
  const d = resp?.data || {}
  if (typeof d.code === 'number') return d.code === 0
  if (typeof resp?.code === 'number') return resp.code === 0
  // 兼容 HTTP 风格
  if (resp?.status && resp.status !== 200) return false
  // 没有 code 的情况下，若带 token 也判作成功（部分后端）
  return !!(d.token || d.userInfo)
}
function normalizeMsg(resp) {
  const d = resp?.data || {}
  return d.message || d.msg || resp?.statusText || ''
}
function normalizeWhy(resp) {
  // 将后端常见文案归一化为特定错误
  const d = resp?.data || {}
  const code = d.code
  const msg = (d.message || d.msg || '').toString().toLowerCase()
  if (code === 1001 || /user.*not.*exist|用户不存在|账号不存在/.test(msg)) return 'USER_NOT_FOUND'
  if (code === 1002 || /password|密码/.test(msg)) return 'BAD_PASSWORD'
  return ''
}
function persistLogin(resp) {
  const d = resp?.data || {}
  const token = d.token || d.data?.token
  const user  = d.userInfo || d.data?.userInfo || {}
  if (token) localStorage.setItem('token', token)
  localStorage.setItem('userInfo', JSON.stringify(user))
}
function pickExists(resp) {
  const d = resp?.data || {}
  if (typeof d.exists === 'boolean') return d.exists
  if (d.data && typeof d.data.exists === 'boolean') return d.data.exists
  return undefined
}

/* ====== 头像上传流：选择 → 压缩 → 直传/SDK → commit ====== */
function triggerChoose() {
  fileInput.value?.click()
}
function skipAvatar() {
  // 允许跳过，避免卡住主流程
  goNext()
}
function cancelUpload() {
  try {
    if (aborter) aborter.abort()
    if (currentCosTaskId && window.COS && window.__cos__) {
      window.__cos__.cancelTask(currentCosTaskId)
    }
  } catch {}
}

async function onAvatarChosen(e) {
  const file = e.target.files?.[0]
  e.target.value = '' // 重置，便于下次选择同一文件
  if (!file) { goNext(); return }

  try {
    // 1) 预压缩（> 阈值才压缩，避免小图重复编码反而慢）
    let toUpload = file
    if (file.size > MIN_COMPRESS_MB * 1024 * 1024) {
      uploadStatusText.value = '正在压缩图片…'
      toUpload = await compressImage(file, MAX_DIM) || file
    }

    // 2) 获取上传凭证
    uploading.value = true
    progress.value = 0
    speedText.value = ''
    etaText.value = ''
    uploadStatusText.value = '正在上传头像…'

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const initResp = await request('/avatar/init', 'POST', { ext })
    if (initResp?.data?.code !== 0) {
      alert('获取上传凭证失败'); goNext(); return
    }
    const { bucket, region, key, credentials, putUrl } = initResp.data.data || {}

    // 3) 上传（优先直传 PUT；否则走 COS SDK）
    const mime = toUpload.type || extToMime(ext)
    let ok = false
    for (let attempt = 0; attempt <= MAX_RETRY && !ok; attempt++) {
      try {
        if (putUrl) {
          await putWithProgress(putUrl, toUpload, mime, (p, speed, eta) => {
            progress.value = p
            speedText.value = speed
            etaText.value   = eta
          })
        } else {
          await uploadViaCOS({ bucket, region, key, credentials, file: toUpload, mime })
        }
        ok = true
      } catch (err) {
        if (attempt >= MAX_RETRY) throw err
        await sleep(500 * (attempt + 1)) // 退避
      }
    }

    // 4) 绑定头像
    uploadStatusText.value = '正在绑定头像…'
    const commitResp = await request('/avatar/commit', 'POST', { key, size: toUpload.size, mime })
    if (commitResp?.data?.code === 0) {
      const u = JSON.parse(localStorage.getItem('userInfo') || '{}')
      u.avatar = commitResp.data.avatar_url
      localStorage.setItem('userInfo', JSON.stringify(u))
      alert('头像已设置')
    } else {
      alert('头像绑定失败')
    }
  } catch (err) {
    console.error('[avatar] upload error:', err)
    if (err?.name === 'AbortError') {
      alert('已取消上传')
    } else {
      alert('头像上传失败')
    }
  } finally {
    uploading.value = false
    progress.value = 0
    speedText.value = ''
    etaText.value = ''
    uploadStatusText.value = '正在上传头像…'
    goNext()
  }
}

/* ====== 直传 PUT（带进度、速度、ETA、可取消） ====== */
function putWithProgress(url, file, mime, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    aborter = new AbortController()

    let lastLoaded = 0
    let lastTime = Date.now()

    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable) { onProgress?.(Math.min(99, progress.value || 0), '', ''); return }
      const p = (evt.loaded / evt.total) * 100
      // 粗略速度/ETA
      const now = Date.now()
      const deltaBytes = evt.loaded - lastLoaded
      const deltaMs = now - lastTime || 1
      const speed = deltaBytes / (deltaMs / 1000) // B/s
      lastLoaded = evt.loaded; lastTime = now

      const remain = evt.total - evt.loaded
      const etaSec = remain / (speed || 1)
      onProgress?.(Math.min(99, p), fmtSpeed(speed), fmtETA(etaSec))
    }
    xhr.onload = () => {
      aborter = null
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100, '', '')
        resolve()
      } else {
        reject(new Error('PUT 上传失败 ' + xhr.status))
      }
    }
    xhr.onerror = () => { aborter = null; reject(new Error('网络错误')) }
    xhr.onabort = () => { aborter = null; reject(new DOMException('aborted', 'AbortError')) }

    xhr.open('PUT', url, true)
    xhr.setRequestHeader('Content-Type', mime)
    xhr.send(file)

    // 取消关联
    aborter.signal.addEventListener('abort', () => { try { xhr.abort() } catch {} })
  })
}

/* ====== COS SDK（STS）上传，带进度与取消 ====== */
async function uploadViaCOS({ bucket, region, key, credentials, file, mime }) {
  await ensureCosLoaded()
  const COS = window.COS
  const cos = window.__cos__ || new COS({
    getAuthorization: (_options, cb) => {
      cb({
        TmpSecretId:  credentials.tmpSecretId,
        TmpSecretKey: credentials.tmpSecretKey,
        SecurityToken: credentials.sessionToken,
        StartTime: credentials.startTime,
        ExpiredTime: credentials.expiredTime,
      })
    }
  })
  window.__cos__ = cos

  return new Promise((resolve, reject) => {
    const task = cos.sliceUploadFile({
      Bucket: bucket,
      Region: region,
      Key: key,
      Body: file,
      Headers: { 'x-cos-acl': 'public-read', 'Content-Type': mime },
      onProgress: (p) => {
        const pct = Math.min(99, (p.percent || 0) * 100)
        const speed = (p.speed || 0) // B/s
        const eta   = p.estimatedTimeRemaining || 0 // 秒
        progress.value = pct
        speedText.value = fmtSpeed(speed)
        etaText.value   = fmtETA(eta)
      }
    }, (err) => {
      currentCosTaskId = null
      if (err) reject(err); else { progress.value = 100; resolve() }
    })
    currentCosTaskId = task && task.id
  })
}

/* ====== COS SDK 预加载 ====== */
function ensureCosLoaded() {
  if (window.COS) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const srcs = [
      'https://cdn.staticfile.org/cos-js-sdk-v5/1.6.3/cos-js-sdk-v5.min.js',
      'https://unpkg.com/cos-js-sdk-v5/dist/cos-js-sdk-v5.min.js'
    ]
    let i = 0
    const load = () => {
      const s = document.createElement('script')
      s.src = srcs[i++]
      s.onload = () => window.COS ? resolve() : (i < srcs.length ? load() : reject(new Error('COS SDK load failed')))
      s.onerror = () => (i < srcs.length ? load() : reject(new Error('COS SDK load failed')))
      document.head.appendChild(s)
    }
    load()
  })
}

/* ====== 图片压缩（最长边 MAX_DIM，导出 webp/80） ====== */
async function compressImage(file, maxDim = 1920) {
  try {
    const bitmap = await createImageBitmap(file)
    const { width, height } = bitmap
    const scale = Math.min(1, maxDim / Math.max(width, height))
    const w = Math.max(1, Math.round(width * scale))
    const h = Math.max(1, Math.round(height * scale))

    // OffscreenCanvas 优先
    const canvas = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(w, h) : document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d', { alpha: false })
    ctx.drawImage(bitmap, 0, 0, w, h)

    const blob = await new Promise((res) => {
      if (canvas.convertToBlob) {
        canvas.convertToBlob({ type: 'image/webp', quality: 0.8 }).then(res)
        return
      }
      canvas.toBlob(res, 'image/webp', 0.8)
    })
    if (!blob) return null

    return new File([blob], (file.name.replace(/\.\w+$/, '') || 'avatar') + '.webp', { type: 'image/webp' })
  } catch (e) {
    console.warn('[compress] fallback to original:', e)
    return null
  }
}

/* ====== 小工具 ====== */
function sleep(ms){ return new Promise(r => setTimeout(r, ms)) }
function fmtSpeed(bps) {
  if (!bps || bps <= 0) return ''
  const KB = 1024, MB = KB * 1024
  return bps >= MB ? (bps / MB).toFixed(1) + ' MB/s' : (bps / KB).toFixed(0) + ' KB/s'
}
function fmtETA(sec) {
  if (!sec || sec <= 0 || sec === Infinity) return ''
  const s = Math.ceil(sec)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60), r = s % 60
  return r ? `${m}m${r}s` : `${m}m`
}

/* ====== 完成后跳转 ====== */
function goNext() {
  const dest = redirect.value?.trim()
  if (dest) router.replace(dest)
  else router.replace('/profile')
}
</script>

<style scoped>
/* 背景整页铺满 */
.signin-page { position: relative; min-height: 100vh; padding-bottom: 40px; }
.bg-img { position: fixed; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: -1; }

/* LOGO */
.logo-container { display: flex; justify-content: center; margin-top: 25px; padding: 50px; }
.logo-img { width: 200px; }

/* 模式切换 */
.mode-tabs { display:flex; gap:10px; justify-content:center; margin-top:-20px; }
.tab { padding:8px 16px; border-radius:20px; border:1px solid rgba(255,255,255,.7); background:rgba(255,255,255,.25); cursor:pointer; color:#102822; }
.tab.active { background:#176B52; color:#fff; border-color:#176B52; }

/* 表单 */
.login-box{
  margin-top: 30px;
  width: 86%;
  margin-left: auto; margin-right: auto;
  display: flex; flex-direction: column; gap: 12px;
}
.input{
  height: 44px; padding: 0 12px;
  border-radius: 8px;
  background: rgba(255,255,255,.28);
  border: 1px solid rgba(255,255,255,.6);
  color: #102822;
  box-shadow: 0 4px 10px rgba(0,0,0,.08);
  outline: none;
}
.input:focus { border-color: rgba(23,107,82,.8); box-shadow: 0 5px 12px rgba(23,107,82,.18); }

/* 按钮 */
.btn-row{ width: 100%; display: flex; justify-content: center; margin-top: 15px; }
.login-btn{
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0 20px; height: 46px; line-height: 46px;
  background: #176B52; color: #fff; font-weight: 600; font-size: 15px; letter-spacing: 1px;
  border-radius: 23px; border: none; cursor: pointer;
}
.login-btn:disabled{ opacity:.7; cursor: not-allowed; }

/* 上传面板 */
.upload-panel { width: 86%; margin: 14px auto 0; background: rgba(255,255,255,.28); border: 1px solid rgba(255,255,255,.6); border-radius: 12px; padding: 12px; }
.upload-row { display:flex; gap:10px; }
.secondary-btn{
  padding: 0 14px; height: 38px;
  background: #fff; color: #176B52; border: 1px solid #176B52; border-radius: 8px; cursor: pointer;
}
.progress-wrap { margin-top: 10px; }
.progress-bar { width: 100%; height: 10px; background: rgba(0,0,0,.08); border-radius: 6px; overflow: hidden; }
.progress-inner { height: 100%; background: linear-gradient(90deg,#1e9e78,#176B52); width: 0; transition: width .2s ease; }
.progress-text { margin-top: 6px; font-size: 13px; color: #102822; display:flex; gap:10px; align-items:center; }
.link-btn { background: transparent; color: #176B52; border: none; cursor: pointer; text-decoration: underline; font-size: 13px; }
.tip-text { margin-top: 6px; color: #2b3b36; font-size: 12px; opacity: .85; }
</style>
