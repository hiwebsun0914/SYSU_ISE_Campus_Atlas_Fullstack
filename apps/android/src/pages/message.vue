<!-- src/pages/message.vue -->
<template>
  <div class="page">
    <!-- 背景 -->
    <img class="bg" src="https://sysuzngcxy-1322240898.cos.ap-guangzhou.myqcloud.com/bg.jpg" alt="bg" />

    <!-- 顶部 LOGO（按角色切换） -->
    <div class="logo-wrap">
      <img v-if="userRole === 'participant' || userRole === 'admin'"
           class="logo"
           src="https://sysuzngcxy-1322240898.cos.ap-guangzhou.myqcloud.com/logo1.png"
           alt="logo">
      <img v-else
           class="logo"
           src="https://sysuzngcxy-1322240898.cos.ap-guangzhou.myqcloud.com/logo.png"
           alt="logo">
    </div>

    <!-- 可扔数量 -->
    <div class="quota">
      可扔的漂流瓶：
      <span class="total">{{ bottleQuotaLeft }}</span>/<span class="total">{{ bottleQuotaTotal }}</span>
    </div>

    <!-- 写文字 + 扔一个 -->
    <div class="composer">
      <div class="ta-wrap">
        <textarea class="input"
                  :maxlength="MAX_TEXT_LEN"
                  v-model="text"
                  @focus="isFocused = true"
                  @blur="isFocused = false"></textarea>
        <!-- 自绘多行占位：未聚焦且未输入时显示 -->
        <div v-if="!text && !isFocused" class="input-ph">{{ placeholderText }}</div>
      </div>

      <div class="tool">
        <span class="count">{{ text.length }}/{{ MAX_TEXT_LEN }}</span>
        <button class="btn primary"
                :disabled="loading || bottleQuotaLeft <= 0 || text.length > MAX_TEXT_LEN"
                @click="throwBottle">
          上传图片并扔一个
        </button>
      </div>
    </div>

    <!-- 随机派发 -->
    <div class="section">
      <div class="title">随机捡到的漂流瓶</div>
      <button class="btn ghost sm" :disabled="loading" @click="pickBottle">捞一个</button>
    </div>

    <!-- 列表（倒序展示，按分页累计） -->
    <div v-for="item in list" :key="item.id" class="card">
      <img class="photo" :src="item.photo" alt="bottle" @click="openViewer(item.photo)">
      <div class="content">
        <div class="text">{{ item.text }}</div>
        <div class="meta">
          <span>来自：{{ item.ownerName }}</span>
          <span>抛出：{{ item.uploadTime }}</span>
          <span>拾取：{{ item.pickTime }}</span>
        </div>
      </div>
    </div>

    <div class="empty" v-if="!loading && list.length === 0">
      还没有捡到瓶子，先扔一个吧～
    </div>

    <!-- 隐形“哨兵”（触底自动加载） -->
    <div ref="sentinel" class="sentinel" aria-hidden="true"></div>

    <div v-if="loading" class="loading">处理中…</div>

    <!-- 隐藏文件选择器 -->
    <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="onFileChosen" />

    <!-- 图片预览 viewer（点击图片打开） -->
    <div v-if="viewerVisible" class="viewer-mask" @click="closeViewer">
      <div class="viewer-swiper" @click.stop>
        <img class="viewer-img" :src="currentPhoto" alt="预览" />
      </div>
      <div class="viewer-close" @click.stop="closeViewer">×</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { request } from '@/utils/request'
import auth from '@/utils/auth'

const router = useRouter()
const route = useRoute()

const MAX_TEXT_LEN = 50
const loading = ref(false)

const userRole = ref('visitor')
const bottleQuotaLeft  = ref(0)
const bottleQuotaTotal = ref(0)
const currentUserId = ref(null)

const text = ref('')
const isFocused = ref(false)
const examples = [
  '今天在荣光堂前遇见好天气 ☀️',
  '如果你也在这附近，欢迎留言交流～',
  '欢迎联系我：微信/QQ',
]
const placeholderText = ref('')

/** === 分页状态（新增） === */
const PAGE_SIZE = 6
const paging = ref({
  offset: 0,
  hasMore: true,
})
const loadingMore = ref(false)

const list = ref([]) // 已加载的记录（倒序累加）
const fileInput = ref(null)

/* === viewer 状态 === */
const viewerVisible = ref(false)
const currentPhoto = ref('')

function openViewer(url) {
  if (!url) return
  currentPhoto.value = url
  viewerVisible.value = true
}
function closeViewer() {
  viewerVisible.value = false
  currentPhoto.value = ''
}

// —— 生命周期
let io = null
let scrollTimer = null
const sentinel = ref(null)

onMounted(async () => {
  document.title = '漂流瓶'
  placeholderText.value =
    `写点想说的话…（可在最后留下联系方式）\n\n` +
    examples.map((s, i) => `${i + 1}. ${s}`).join('\n')

  if (!isAuthed()) {
    const redirect = encodeURIComponent('/message')
    router.push({ path: '/signin', query: { redirect } })
    return
  }
  await fetchMe()      // 仅用于切换 LOGO / 获取用户 id
  await refreshQuota()
  await resetPicked()  // 首屏仅加载最近 6 条

  setupIntersectionObserver() // 触底自动加载
})

onBeforeUnmount(() => {
  if (io) { io.disconnect(); io = null }
  if (scrollTimer) { clearTimeout(scrollTimer); scrollTimer = null }
  window.removeEventListener('scroll', onScroll)
})

/** 触底自动加载（IntersectionObserver + 滚动兜底） */
function setupIntersectionObserver() {
  if (io) io.disconnect()
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(entries => {
      const entry = entries[0]
      if (entry?.isIntersecting && paging.value.hasMore && !loadingMore.value) {
        loadMorePicked()
      }
    }, {
      root: null,
      rootMargin: '200px 0px',
      threshold: 0.01
    })
    if (sentinel.value) io.observe(sentinel.value)
  }
  window.addEventListener('scroll', onScroll, { passive: true })
}

function onScroll() {
  if (loadingMore.value || !paging.value.hasMore) return
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0
  const vh = window.innerHeight || document.documentElement.clientHeight || 0
  const docH = Math.max(
    document.body.scrollHeight, document.documentElement.scrollHeight,
    document.body.offsetHeight,  document.documentElement.offsetHeight
  )
  if (docH - (scrollTop + vh) < 240) {
    if (scrollTimer) clearTimeout(scrollTimer)
    scrollTimer = setTimeout(() => loadMorePicked(), 80)
  }
}

// —— 工具
function isAuthed() {
  try {
    return typeof auth?.isLoggedIn === 'function' ? auth.isLoggedIn() : !!auth?.isLoggedIn
  } catch { return false }
}
function fmt(ts) {
  if (!ts) return ''
  let v = ts
  if (typeof v === 'string' && /^\d+$/.test(v)) v = Number(v)
  try { return new Date(v).toLocaleString() } catch { return String(ts) }
}
function toOk(resp) {
  const ok = (resp?.status === 200) || (resp?.statusCode === 200)
  return ok && resp?.data?.code === 0
}

// 图片压缩函数
async function compressImage(file, maxW = 1080, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let w = img.width
        let h = img.height

        // 如果超过 maxW，就按比例缩小
        if (w > maxW) {
          h = Math.round((h * maxW) / w)
          w = maxW
        }

        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)

        canvas.toBlob(
          blob => {
            if (!blob) return reject(new Error('压缩失败'))
            // 保留原文件名，但类型改成 blob 的 MIME
            const compressed = new File([blob], file.name, { type: blob.type })
            resolve(compressed)
          },
          'image/jpeg',
          quality // 压缩质量 0~1
        )
      }
      img.onerror = reject
      img.src = e.target.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// —— 拉自己信息（角色/用户ID）
async function fetchMe() {
  try {
    const me = await request('/auth/me', 'GET')
    if (toOk(me)) {
      userRole.value = me.data.userInfo?.role || 'visitor'
      currentUserId.value = me.data.userInfo?.id || null
    }
  } catch { /* ignore */ }
}

// —— 顶部额度：总数 = unlockedLocations.length；剩余 = 总数 - bottlesThrow.length
async function refreshQuota() {
  try {
    const resp = await request('/auth/me', 'GET')
    if (toOk(resp)) {
      const info   = resp.data.userInfo || {}
      const total  = (info.unlockedLocations || []).length + 3
      const thrown = (info.bottlesThrow || []).length
      bottleQuotaTotal.value = total
      bottleQuotaLeft.value  = Math.max(total - thrown, 0)
      currentUserId.value    = info.id || null
    }
  } catch (e) {
    console.warn('[message] refreshQuota fail', e)
  }
}

// —— 选择图片 + 扔瓶子
function throwBottle() {
  if (!isAuthed()) {
    const redirect = encodeURIComponent('/message')
    router.push({ path: '/signin', query: { redirect } })
    return
  }
  if (bottleQuotaLeft.value <= 0) { alert('可扔瓶子数量为 0'); return }
  if (text.value.length > MAX_TEXT_LEN) { alert(`文字最多 ${MAX_TEXT_LEN} 字`); return }
  fileInput.value?.click()
}

async function onFileChosen(e) {
  let file = e.target.files?.[0]
  e.target.value = '' // 重置
  if (!file) return

  try {
    // 👉 压缩
    file = await compressImage(file, 1080, 0.8)

    loading.value = true
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()

    // 1) 预签名
    const sign = await request('/checkin/presign', 'POST', { ext, locationId: 'Bottle', dir: 'Bottle' })
    if (!toOk(sign)) { alert(sign?.data?.message || '签名失败'); loading.value = false; return }
    const { key, putUrl } = sign.data.data || {}

    // 2) PUT 上传压缩后的图片
    const putRes = await fetch(putUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'image/jpeg' },
      body: file
    })
    if (!putRes.ok) { alert('上传失败 ' + putRes.status); loading.value = false; return }

    // 3) commit 获取公网 URL
    const c = await request('/checkin/commit', 'POST', { key, size: file.size })
    if (!toOk(c)) { alert(c?.data?.message || '绑定失败'); loading.value = false; return }
    const photo = c.data.url

    // 4) 写入后端瓶子池
    const t = await request('/bottle/throw', 'POST', { text: text.value || '', photo })
    if (!toOk(t)) { alert(t?.data?.message || '扔瓶失败'); loading.value = false; return }

    text.value = ''
    await refreshQuota()
    alert('已扔出一个瓶子')
  } catch (err) {
    console.error('throwBottle error =>', err)
    alert('网络异常')
  } finally {
    loading.value = false
  }
}


// —— 再捞一个（云端随机）
async function pickBottle() {
  if (!isAuthed()) {
    const redirect = encodeURIComponent('/message')
    router.push({ path: '/signin', query: { redirect } })
    return
  }
  try {
    loading.value = true
    const resp = await request('/bottle/pick', 'POST', {})
    if (!toOk(resp)) { alert(resp?.data?.message || '捞取失败'); return }

    const b = resp.data.bottle
    if (!b) { alert('暂无可捡的瓶子'); return }

    const pickedOne = {
      id: b.id,
      text: b.text || '',
      photo: b.photo || '',
      ownerId: b.ownerId,
      ownerName: b.ownerName || '',
      uploadTime: fmt(b.uploadTime),
      pickTime  : fmt(b.pickTime),
    }

    // 已存在则更新并置顶；否则直接置顶
    const idx = list.value.findIndex(x => String(x.id) === String(pickedOne.id))
    if (idx >= 0) list.value.splice(idx, 1)
    list.value.unshift(pickedOne)

    alert('捡到一个瓶子')
  } catch (e) {
    console.error('[message] pickBottle error', e)
    alert('网络异常')
  } finally {
    loading.value = false
  }
}

/** ========= 收到的瓶子：分页加载 ========= */

// 取一页（优先用后端分页接口 /bottle/my-picked?limit=&offset=）
async function fetchPickedBatch(offset, limit) {
  try {
    const resp = await request(`/bottle/my-picked?limit=${limit}&offset=${offset}`, 'GET')
    if (!toOk(resp) || !Array.isArray(resp.data.list)) {
      return { list: [], hasMore: false }
    }

    // 为了“最近拾取”优先，按 pickTime（数值）再确认倒序一次（即使后端已排序）
    const raw = resp.data.list.slice().sort((a, b) => (b.pickTime || 0) - (a.pickTime || 0))

    const arr = raw.map(it => ({
      ...it,
      uploadTime: fmt(it.uploadTime),
      pickTime  : fmt(it.pickTime),
    }))

    // hasMore 以后端为准；如未提供，则按“返回条数 === limit”推断
    const hasMore = typeof resp.data.hasMore === 'boolean'
      ? resp.data.hasMore
      : raw.length === limit

    return { list: arr, hasMore }
  } catch (e) {
    console.warn('[message] fetchPickedBatch fail', e)
    return { list: [], hasMore: false }
  }
}

// 首屏：仅 6 条
async function resetPicked() {
  loadingMore.value = true
  try {
    paging.value.offset = 0
    paging.value.hasMore = true
    list.value = []

    const { list: batch, hasMore } = await fetchPickedBatch(0, PAGE_SIZE)
    list.value = batch
    paging.value.offset = batch.length
    paging.value.hasMore = hasMore
  } finally {
    loadingMore.value = false
  }
}

// 触底加载：再 6 条
async function loadMorePicked() {
  if (!paging.value.hasMore || loadingMore.value) return
  loadingMore.value = true
  try {
    const { list: batch, hasMore } = await fetchPickedBatch(paging.value.offset, PAGE_SIZE)
    // 追加（去重）
    batch.forEach(it => {
      const exist = list.value.find(x => String(x.id) === String(it.id))
      if (!exist) list.value.push(it)
    })
    paging.value.offset += batch.length
    paging.value.hasMore = hasMore
  } finally {
    loadingMore.value = false
  }
}
</script>

<style scoped>
/* 由 rpx 近似换算：1rpx ≈ 0.5px */

.page{ min-height:100vh; padding-bottom:20px; position:relative; }
.bg{ position:fixed; inset:0; width:100vw; height:100vh; z-index:-1; object-fit:cover; }

.logo-wrap{ display:flex; justify-content:center; padding:20px 12px 5px; }
.logo{ width:180px; }

.quota{
  margin: 5px 12px 10px;
  padding: 8px 10px;
  font-size: 13px;
  color: #0f2a22;
  background: rgba(255,255,255,.85);
  border: 1px solid rgba(255,255,255,.7);
  border-radius: 8px;
  box-shadow: 0 3px 9px rgba(0,0,0,.08);
}
.total{ font-weight: 800; color:#176B52; }

/* 写作区域 */
.composer{
  margin: 0 12px 10px;
  background: rgba(255,255,255,.86);
  border:1px solid rgba(255,255,255,.6);
  border-radius: 9px;
  box-shadow: 0 4px 12px rgba(0,0,0,.10);
  padding: 8px;
}

.ta-wrap { position: relative; }
.input {
  width: 100%;
  min-height: 180px;          /* 220rpx */
  line-height: 1.6;
  padding: 12px;              /* 24rpx */
  box-sizing: border-box;
  resize: vertical;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  outline: none;
}
.input:focus { box-shadow: 0 0 0 3px rgba(23,92,40,.15); border-color:#176B52; }

.input-ph {
  position: absolute; inset: 0;
  padding: 12px;
  color: #9aa0a6;
  pointer-events: none;
  white-space: pre-wrap;
  line-height: 1.6;
}

.tool{
  margin-top: 6px;
  display:flex; align-items:center; justify-content:space-between;
}
.count{ font-size:12px; color:#6f8189; }
.btn{
  padding: 0 14px; height:36px; line-height:36px;
  border-radius: 18px; font-size: 14px;
  border: none; cursor: pointer;
}
.btn:disabled{ opacity:.6; cursor:not-allowed; }
.btn.primary{ background:#175c28; color:#fff; }
.btn.ghost{ width:100px; border:1px solid #175c28; background:#175c28; color:#fff; }
.btn.sm{ height:30px; line-height:30px; font-size:13px; padding:0 11px; }

/* 区块标题 */
.section{
  margin: 9px 12px 5px;
  display:flex; align-items:center; justify-content:space-between;
}
.title{ color:#0b1c17; font-size:13px; font-weight:700; }

/* 卡片列表 */
.card{
  margin: 8px 12px;
  background: rgba(255,255,255,.9);
  border:1px solid rgba(255,255,255,.6);
  border-radius: 9px;
  display:flex; gap:8px;
  overflow:hidden;
  box-shadow: 0 4px 12px rgba(0,0,0,.10);
}
.photo{
  width: 120px;
  height: 120px;
  background: #eee;
  object-fit: cover;          /* 填满并裁切 */
  object-position: center;    /* 裁切中心 */
  display: block;             /* 去掉图片基线对齐的空隙 */
  border-radius: 9px;         /* 倒角 */
  flex: 0 0 120px;            /* 固定宽度列 */
  align-self: center;         /* 在 .card 的 flex 容器里垂直居中 */
  cursor: zoom-in;
  margin-left: 6px;           /* ← 左侧留 6px 边距 */
}

.content{ flex:1; padding:8px 8px 6px 0; }
.text{ font-size:14px; color:#1c2b26; }
.meta{
  margin-top:5px; font-size:11px; color:#6f8189;
  display:flex; flex-direction:column; gap:3px;
}

.empty{ text-align:center; color:#e6edf0; padding:30px 0; }

/* 页面级 Loading */
.loading{
  position: fixed; right: 12px; bottom: 12px;
  background: rgba(17,24,39,.9); color: #fff;
  padding: 8px 10px; border-radius: 8px; font-size: 12px;
}

/* ===== 图片预览 viewer ===== */
.viewer-mask {
  position: fixed; inset: 0;
  z-index: 2000;
  background: rgba(0,0,0,.65);
  display: flex; align-items: center; justify-content: center;
}
.viewer-swiper {
  max-width: 90vw; max-height: 80vh;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 30px rgba(0,0,0,.35);
}
.viewer-img {
  display: block;
  max-width: 90vw; max-height: 80vh;
  object-fit: contain;
}
.viewer-close {
  position: fixed;
  top: 20px; right: 20px;
  width: 32px; height: 32px;
  border-radius: 50%;
  background: rgba(0,0,0,.6);
  color: #fff; font-size: 20px;
  line-height: 32px; text-align: center;
  cursor: pointer;
}

/* 触底哨兵：不可见，占位用 */
.sentinel{
  width:100%;
  height:2px;
}
</style>
