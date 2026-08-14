<!-- src/pages/signin.vue · 登录/注册：按 design.md 浅色画布语言 -->
<template>
  <div class="signin-page">
    <main class="signin-shell">
      <header class="signin-header">
        <img
          class="signin-logo"
          src="https://sysuzngcxy-1322240898.cos.ap-guangzhou.myqcloud.com/logo1.png"
          alt="中山大学智能工程学院"
        />
        <p class="signin-eyebrow"><span class="signin-node" aria-hidden="true"></span>SYSU · ISE / 2026</p>
        <h1>{{ adminMode ? '管理员登录' : (mode === 'login' ? '欢迎回来' : '注册新账号') }}</h1>
        <p class="signin-desc">
          {{ adminMode
            ? '请使用管理员账号登录，进入审核与管理台。'
            : (mode === 'login' ? '登录后继续你的校园探索路线。' : '注册后即可打卡、点亮校园坐标。') }}
        </p>
      </header>

      <section class="signin-card" aria-label="登录注册表单">
        <!-- 模式切换 -->
        <div v-if="!adminMode" class="mode-tabs" role="tablist" aria-label="切换登录或注册">
          <button
            type="button" role="tab"
            :aria-selected="mode === 'login'"
            :class="['tab', mode === 'login' && 'active']"
            @click="mode = 'login'"
          >登录</button>
          <button
            type="button" role="tab"
            :aria-selected="mode === 'register'"
            :class="['tab', mode === 'register' && 'active']"
            @click="mode = 'register'"
          >注册</button>
        </div>

        <div v-else class="admin-login-notice" role="status">
          <strong>切换到管理员账号</strong>
          <p>当前账号没有管理员权限，请重新登录后进入管理员模式。</p>
        </div>

        <!-- 表单 -->
        <form class="login-box" @submit.prevent="onSubmit">
          <label class="field">
            <span class="field-label">{{ adminMode ? '管理员账号' : '昵称' }}</span>
            <input
              class="input"
              :placeholder="adminMode ? '请输入管理员账号' : '请输入昵称'"
              autocomplete="username"
              v-model.trim="username"
            />
          </label>
          <label v-if="mode === 'register'" class="field">
            <span class="field-label">真实姓名（必填）</span>
            <input
              class="input"
              placeholder="请输入真实姓名"
              autocomplete="name"
              required
              aria-required="true"
              v-model.trim="realName"
            />
          </label>
          <label class="field">
            <span class="field-label">密码</span>
            <input
              class="input"
              placeholder="请输入密码"
              type="password"
              :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
              v-model="password"
            />
          </label>

          <button class="login-btn" type="submit" :disabled="submitting || uploading">
            <span v-if="uploading">{{ uploadStatusText }}</span>
            <span v-else>
              {{ submitting ? '提交中…' : (adminMode ? '进入管理员模式' : (mode === 'login' ? '登录' : '注册并上传头像')) }}
            </span>
          </button>
        </form>
      </section>

      <!-- 头像上传进度与操作（仅注册后） -->
      <section v-if="showUploadPanel" class="upload-panel" aria-label="上传头像">
        <div class="upload-row">
          <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="onAvatarChosen" />
          <button type="button" class="secondary-btn" @click="triggerChoose" :disabled="uploading">选择头像</button>
          <button type="button" class="secondary-btn secondary-btn-plain" @click="skipAvatar" :disabled="uploading">跳过</button>
        </div>

        <div v-if="uploading" class="progress-wrap">
          <div class="progress-bar" role="progressbar" :aria-valuenow="Math.round(progress)" aria-valuemin="0" aria-valuemax="100">
            <div class="progress-inner" :style="{ width: progress + '%' }"></div>
          </div>
          <div class="progress-text">
            <span>{{ progress.toFixed(0) }}%</span>
            <span v-if="speedText">｜{{ speedText }}</span>
            <span v-if="etaText">｜剩余 {{ etaText }}</span>
            <button type="button" class="link-btn" @click="cancelUpload">取消上传</button>
          </div>
        </div>

        <div class="tip-text">支持 jpg/png/webp；会自动压缩到较小体积以加快上传。</div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { request } from '@/utils/request'

const router = useRouter()
const route  = useRoute()

const mode        = ref('login') // 'login' | 'register'
const adminMode   = ref(false)
const username    = ref('')
const realName    = ref('')
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
  adminMode.value = route.query?.mode === 'admin'
  if (adminMode.value) mode.value = 'login'
  document.title = adminMode.value ? '管理员登录' : (mode.value === 'login' ? '登录' : '注册')
  const r = route.query?.redirect ? decodeURIComponent(String(route.query.redirect)) : ''
  redirect.value = r
  // 空闲时预加载 COS SDK，减少之后等待
  idle(ensureCosLoaded)
})

// 切换页签时同步标题（小优化，非功能性）
watch(mode, (m) => {
  document.title = adminMode.value ? '管理员登录' : (m === 'login' ? '登录' : '注册')
})

/* ====== 辅助 ====== */
function idle(cb){
  if ('requestIdleCallback' in window) return requestIdleCallback(cb, { timeout: 1500 })
  return setTimeout(cb, 200)
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
  if (mode.value === 'register' && !realName.value) {
    alert('请输入真实姓名'); return
  }
  submitting.value = true
  try {
    if (mode.value === 'login') {
      await handleLoginStrict(username.value, password.value)
      if (adminMode.value) assertAdministratorAccount()
      alert(adminMode.value ? '管理员登录成功' : '登录成功')
      await goNext()
    } else {
      await handleRegister(username.value, password.value, realName.value)
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

function assertAdministratorAccount() {
  let user = {}
  try { user = JSON.parse(localStorage.getItem('userInfo') || '{}') } catch {}
  if (user.role === 'admin' || user.role === 'owner') return
  localStorage.removeItem('token')
  localStorage.removeItem('userInfo')
  throw new Error('该账号没有管理员权限，请更换账号')
}

/** 严格登录：不会自动创建账号；若账号不存在直接提示 */
async function handleLoginStrict(name, pass) {
  // 1) 首选 /auth/login
  const resp = await request('/auth/login', 'POST', { username: name, password: pass })
  if (!isMissingEndpoint(resp)) {
    assertLoginResponse(resp)
    persistLogin(resp)
    return
  }

  // 2) 可选：查询是否存在该账号（支持任一存在性接口）
  const exists = await safeCheckUserExists(name)
  if (exists === false) throw new Error('账号不存在')

  // 3) 兼容后端仍只提供 /login_or_register 的情况：显式声明登录模式，禁止自动创建
  const fallback = await request('/login_or_register', 'POST', {
    username: name, password: pass, phone: '',
    mode: 'login', allowCreate: false, registerIfNotExist: false
  })
  assertLoginResponse(fallback)
  persistLogin(fallback)
}

/** 注册：优先 /auth/register，不可用再降级到 /login_or_register */
async function handleRegister(name, pass, confirmedRealName) {
  // 1) 首选 /auth/register
  const resp = await request('/auth/register', 'POST', { username: name, password: pass, realName: confirmedRealName })
  if (!isMissingEndpoint(resp)) {
    if (!normalizeOk(resp)) throw new Error(normalizeMsg(resp) || '注册失败')
    persistLogin(resp) // 大多数注册接口会直接返回 token
    return
  }

  // 2) 兼容：/login_or_register 作为注册模式
  const fallback = await request('/login_or_register', 'POST', {
    username: name, password: pass, realName: confirmedRealName, mode: 'register'
  })
  const ok = normalizeOk(fallback)
  if (!ok) throw new Error(normalizeMsg(fallback) || '注册失败')
  persistLogin(fallback)
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
function isMissingEndpoint(resp) {
  return resp?.status === 404 || resp?.status === 405
}
function assertLoginResponse(resp) {
  if (normalizeOk(resp)) return
  if (resp?.status === 0) throw new Error('无法连接登录服务，请检查网络后重试')
  const why = normalizeWhy(resp)
  if (why === 'USER_NOT_FOUND') throw new Error('账号不存在')
  if (why === 'BAD_PASSWORD') throw new Error('密码错误')
  throw new Error(normalizeMsg(resp) || '登录失败')
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
async function goNext() {
  const dest = redirect.value?.trim()
  let user = {}
  try { user = JSON.parse(localStorage.getItem('userInfo') || '{}') } catch {}
  const isAdmin = user.role === 'admin' || user.role === 'owner'
  if (isAdmin) return router.replace('/admin')
  if (dest && dest.startsWith('/') && !dest.startsWith('/admin')) return router.replace(dest)
  return router.replace('/myCheckins')
}
</script>

<style scoped>
@import "../../../../tokens.css";

.signin-page {
  --ise-ink: #0a2e3b;
  --ise-primary: #0d9488;
  --ise-primary-dark: #08766d;
  --ise-accent: #c7f24a;
  --ise-canvas: #f3f7f5;
  --ise-surface: #ffffff;
  --ise-text: #102a2e;
  --ise-muted: #5e7271;
  --ise-border: #d6e4df;
  --ise-soft: #edf5f2;

  min-height: 100vh;
  color: var(--ise-text);
  background-color: var(--ise-canvas);
  background-image:
    linear-gradient(rgb(10 46 59 / 0.032) 1px, transparent 1px),
    linear-gradient(90deg, rgb(10 46 59 / 0.032) 1px, transparent 1px);
  background-size: 32px 32px;
  font-family: var(--font-body);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

.signin-shell {
  width: min(100% - 2 * var(--space-md), 26rem);
  margin-inline: auto;
  padding-top: max(var(--space-2xl), env(safe-area-inset-top));
  padding-bottom: var(--space-2xl);
}

/* 头部 */
.signin-header {
  text-align: center;
}

.signin-logo {
  width: 11rem;
  margin-inline: auto;
}

.signin-eyebrow {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  margin: var(--space-lg) 0 0;
  color: var(--ise-primary-dark);
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.signin-node {
  width: 7px;
  height: 7px;
  background: var(--ise-accent);
  border: 1px solid var(--ise-ink);
  border-radius: 50%;
}

.signin-header h1 {
  margin: var(--space-sm) 0 0;
  color: var(--ise-ink);
  font-family: var(--font-display);
  font-size: clamp(1.75rem, 6vw, 2.25rem);
  font-weight: 700;
  line-height: 1.05;
}

.signin-desc {
  margin: var(--space-2xs) auto 0;
  max-width: 20rem;
  color: var(--ise-muted);
  font-size: var(--text-sm);
}

/* 卡片 */
.signin-card {
  margin-top: var(--space-lg);
  padding: var(--space-lg);
  background: var(--ise-surface);
  border: 1px solid var(--ise-border);
  border-radius: 20px;
}

/* 模式切换：分段控件，当前项用细边框与酸橙标记 */
.mode-tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: var(--ise-soft);
  border: 1px solid var(--ise-border);
  border-radius: var(--radius-pill);
}

.tab {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 var(--space-md);
  color: var(--ise-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
}

.tab.active {
  color: var(--ise-ink);
  background: var(--ise-surface);
  border-color: var(--ise-ink);
}

.tab.active::before {
  width: 6px;
  height: 6px;
  background: var(--ise-accent);
  border: 1px solid var(--ise-ink);
  border-radius: 50%;
  content: "";
}

/* 管理员提示 */
.admin-login-notice {
  padding: var(--space-sm) var(--space-md);
  color: var(--ise-text);
  background: var(--ise-soft);
  border: 1px solid var(--ise-border);
  border-radius: 12px;
}

.admin-login-notice strong,
.admin-login-notice p { display: block; }
.admin-login-notice p { margin: 4px 0 0; color: var(--ise-muted); font-size: var(--text-xs); line-height: 1.6; }

/* 表单 */
.login-box {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin-top: var(--space-md);
}

.field {
  display: block;
}

.field-label {
  display: block;
  margin-bottom: var(--space-3xs);
  color: var(--ise-ink);
  font-size: var(--text-xs);
  font-weight: 600;
}

.input {
  width: 100%;
  height: 48px;
  padding: 0 var(--space-sm);
  color: var(--ise-text);
  background: var(--ise-surface);
  border: 1px solid var(--ise-border);
  border-radius: 12px;
  font: inherit;
  outline: none;
  transition: border-color var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard);
}

.input::placeholder {
  color: var(--ise-muted);
}

.input:focus {
  border-color: var(--ise-ink);
  box-shadow: 0 0 0 3px rgb(199 242 74 / 0.55);
}

/* 主行动：酸橙胶囊，深青文字 */
.login-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 48px;
  margin-top: var(--space-2xs);
  padding: 0 var(--space-lg);
  color: var(--ise-ink);
  background: var(--ise-accent);
  border: 1px solid var(--ise-ink);
  border-radius: var(--radius-pill);
  font-size: var(--text-base);
  font-weight: 700;
  cursor: pointer;
  transition: transform var(--duration-fast) var(--ease-standard);
}

.login-btn:active:not(:disabled) {
  transform: scale(0.99);
}

.login-btn:disabled {
  opacity: 0.58;
  cursor: not-allowed;
}

/* 上传面板 */
.upload-panel {
  margin-top: var(--space-md);
  padding: var(--space-md);
  background: var(--ise-surface);
  border: 1px solid var(--ise-border);
  border-radius: 16px;
}

.upload-row {
  display: flex;
  gap: var(--space-sm);
}

.secondary-btn {
  flex: 1;
  min-height: 44px;
  padding: 0 var(--space-md);
  color: var(--ise-primary-dark);
  background: var(--ise-surface);
  border: 1px solid var(--ise-primary-dark);
  border-radius: var(--radius-pill);
  font-weight: 600;
  cursor: pointer;
}

.secondary-btn-plain {
  color: var(--ise-muted);
  border-color: var(--ise-border);
}

.secondary-btn:disabled {
  opacity: 0.58;
  cursor: not-allowed;
}

.progress-wrap {
  margin-top: var(--space-sm);
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: var(--ise-soft);
  border: 1px solid var(--ise-border);
  border-radius: var(--radius-pill);
  overflow: hidden;
}

.progress-inner {
  height: 100%;
  width: 0;
  background: var(--ise-accent);
  transition: width var(--duration-base) var(--ease-standard);
}

.progress-text {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  color: var(--ise-muted);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}

.link-btn {
  margin-left: auto;
  padding: 0;
  color: var(--ise-primary-dark);
  background: transparent;
  border: none;
  font-size: var(--text-xs);
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

.tip-text {
  margin-top: var(--space-2xs);
  color: var(--ise-muted);
  font-size: var(--text-xs);
}

/* 焦点 */
.signin-page :where(a, button, input):focus-visible {
  outline: 3px solid var(--ise-accent);
  outline-offset: 2px;
  box-shadow: 0 0 0 1px var(--ise-ink);
}

@media (prefers-reduced-motion: reduce) {
  .signin-page *,
  .signin-page *::before,
  .signin-page *::after {
    scroll-behavior: auto !important;
    animation-duration: 1ms !important;
    transition-duration: 1ms !important;
  }
}
</style>
