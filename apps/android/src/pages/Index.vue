<!-- src/pages/index.vue -->
<template>
  <div class="bg-wrapper">
    <img class="bg-img" src="https://sysuzngcxy-1322240898.cos.ap-guangzhou.myqcloud.com/bg.jpg" alt="背景" />

    <div class="content">
      <!-- 左上角菜单；右上角“＜”只用来打开地图 -->
      <div class="menu-icon" @click="toggleSidebar">☰</div>
      <button class="back-icon" type="button" @click="openMapAlbum" aria-label="打开地图">＜</button>

      <!-- LOGO -->
      <div class="logo-container">
        <img class="logo-img" src="https://sysuzngcxy-1322240898.cos.ap-guangzhou.myqcloud.com/logo1.png" alt="活动 LOGO" />
      </div>

      <!-- 标题 -->
      <div class="header">
        <div class="title">🎓 欢迎参加校园打卡活动</div>
      </div>

      <!-- 侧边栏 -->
      <div v-if="sidebarVisible" class="sidebar-mask" @click="toggleSidebar">
        <div class="sidebar" @click.stop>
          <div class="sidebar-button" @click="goToMyCheckins">📍 我的打卡</div>
          <div class="sidebar-button" @click="goToRank">🏆 打卡排名</div>
          <div class="sidebar-button" @click="goToMessage">🪁 漂流瓶</div>
          <div class="sidebar-button" @click="goToConnect">🛠️ 问题反馈</div>
          <div v-if="userRole === 'admin'" class="sidebar-button" @click="goToAdmin">🧰 审核管理</div>
        </div>
      </div>

      <!-- 页面内图片查看层（viewer）：地图 & 单地点复用；不新开页、不触发下载 -->
      <div v-if="viewerVisible" class="viewer-mask" @click="closeViewer">
        <div class="viewer-swiper" @click.stop @contextmenu.prevent>
          <img class="viewer-img"
               :src="viewerList[currentIndex]"
               :draggable="false"
               alt="预览" />
          <div class="viewer-dots" v-if="viewerList.length > 1">
            <span v-for="(x,i) in viewerList"
                  :key="i"
                  class="dot"
                  :class="{active: i===currentIndex}"
                  @click="goToIndex(i)"></span>
          </div>
          <button v-if="viewerList.length > 1" class="viewer-prev" type="button" @click="prevImg">‹</button>
          <button v-if="viewerList.length > 1" class="viewer-next" type="button" @click="nextImg">›</button>
        </div>
        <div class="viewer-tip" @click.stop>提示：直接两指拉动可放大</div>
        <div class="viewer-pager">{{ currentIndex + 1 }} / {{ viewerList.length }}</div>
        <div class="viewer-close" @click.stop="closeViewer">×</div>
      </div>

      <!-- 打卡点卡片列表（仅渲染可见子集） -->
      <div class="card-list">
        <div v-for="item in shownLocations" :key="item.id">
          <div class="card-horizontal">
            <!-- 左图（骨架 -> 淡入；点击在 viewer 内查看） -->
            <div class="card-img-wrap">
              <div v-if="!item.image" class="img-skeleton"></div>
              <img v-else
                   :src="item.image"
                   :srcset="srcsetFor(item)"
                   sizes="(max-width: 768px) 45vw, 440px"
                   class="card-img-left"
                   :alt="item.name"
                   loading="lazy"
                   decoding="async"
                   fetchpriority="low"
                   @load="e => e.target.classList.add('loaded')"
                   @click="openSingleInViewer(item)" />
            </div>

            <!-- 右侧信息 -->
            <div class="card-info">
              <div class="card-title">{{ item.name }}</div>
              <div class="card-meta">编号：{{ item.id }}</div>
              <div class="card-meta">位置：{{ item.position }}</div>

              <div class="btn-group">
                <button class="checkin-btn" type="button"
                        v-if="item.status === 'normal'"
                        @click="checkIn(item.id)">📍 打卡</button>
                <button class="checkin-btn" type="button"
                        v-else-if="item.status === 'pending'"
                        @click="checkIn(item.id)">⏳ 审核中</button>
                <button class="checkin-btn" type="button"
                        v-else-if="item.status === 'done'"
                        @click="checkIn(item.id)">✅ 已打卡</button>
                <button class="detail-btn" type="button"
                        @click="toggleDescription(item.id)">
                  {{ item.expanded ? "收起详情" : "展开详情" }}
                </button>
              </div>
            </div>
          </div>

          <!-- 详情富文本 -->
          <div v-if="item.expanded"
               class="card-description"
               v-html="item.description"></div>
        </div>

        <!-- 哨兵元素：进入视口即追加下一批 -->
        <div ref="sentinel" style="height:1px;"></div>

      </div>
      <a href="https://beian.miit.gov.cn/" target="_blank">您的备案号</a>
      <a href="https://beian.miit.gov.cn/" target="_blank">鲁ICP备2025179873号-2</a>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'

/* ===== request 兼容具名/默认导出 ===== */
import reqDefault, { request as reqNamed } from '@/utils/request'
const request = reqNamed || reqDefault

/* ===== imageCache 兼容导出（缺失时兜底实现，防止页面崩） ===== */
import * as cacheMod from '@/utils/imageCache'
const imgCache = (cacheMod && (cacheMod.default || cacheMod)) || {
  enableDebug(){},
  async getOrNet(u){ return u },
  async warmup(){},
}
imgCache.enableDebug?.(false)

/* ===== COS 公网域名（可通过 .env 覆盖） ===== */
const COS_PUBLIC_BASE =
  (import.meta.env?.VITE_COS_PUBLIC_BASE ||
   'https://sysuzngcxy-1322240898.cos.ap-guangzhou.myqcloud.com')
  .replace(/\/+$/,'')

function urlFromKey(key) {
  if (!key) return ''
  if (/^https?:\/\//i.test(key)) return key
  return `${COS_PUBLIC_BASE}/${String(key).replace(/^\/+/, '')}`
}

/* ===== JWT 解析（兜底拿 uid / nickname） ===== */
function parseJwt(token = '') {
  try {
    const p = token.split('.')[1]
    if (!p) return {}
    const txt = atob(p.replace(/-/g,'+').replace(/_/g,'/'))
    return JSON.parse(txt)
  } catch { return {} }
}

/* ===== 生成 “用户ID__昵称” 目录名（与后端上传一致） ===== */
function getUserKey() {
  const u = JSON.parse(localStorage.getItem('userInfo') || '{}')
  const t = localStorage.getItem('token') || ''
  const j = parseJwt(t)

  const username =
    u.username || u.nick || u.nickname ||
    j.username || j.nick || j.nickname || ''

  const uid =
    u.userId || u.id || u.uid || u.uuid ||
    u.openid || u.openId || u.open_id || u.unionid ||
    j.sub || j.uid || j.userId || j.id || ''

  if (!uid || !username) return ''
  return `${uid}__${username}`
}

/* ======= 图片优化（COS CI） ======= */
function stripCI(url = '') {
  return url
    .replace(/(\?|&)(imageMogr2|imageView2|image-process)[^#]*/gi, '')
    .replace(/[?&]$/, '')
}
function thumb(url, w = 480, q = 60) {
  if (!url) return url
  const base = stripCI(url)
  const ci = `imageMogr2/thumbnail/${w}x/format/webp/quality/${q}`
  return base.includes('?') ? `${base}&${ci}` : `${base}?${ci}`
}
function thumbForViewer(url, w = 1080, q = 70) {
  return thumb(url, w, q)
}
function original(url) { return stripCI(url) }

/* ===== Router & State ===== */
const router = (() => { try { return useRouter() } catch { return null } })()
const route  = (() => { try { return useRoute() } catch { return { fullPath: window.location.pathname } } })()

const sidebarVisible    = ref(false)
const userRole          = ref('visitor')

const rawLocations      = ref([])
const locations         = ref([])

const unlockedLocations = ref([])
const lockingLocations  = ref([])

const mapSrc    = ref('')
let   mapRawUrl = ''

/* viewer */
const viewerVisible = ref(false)
const viewerList    = ref([])
const currentIndex  = ref(0)

/* ===== 分批渲染配置 ===== */
const BATCH_SIZE = 10       // 每批条数
const PREFETCH   = 10       // 预取下一批缩略图数量（可设 0 关闭）
const visibleCount = ref(BATCH_SIZE)
const shownLocations = computed(() => (locations.value || []).slice(0, visibleCount.value))

function loadMore() {
  const old = visibleCount.value
  const nextCount = Math.min(visibleCount.value + BATCH_SIZE, locations.value.length)
  visibleCount.value = nextCount
  // 为新曝光的区间 + 下一批预取，实际填充缩略图（修复>20不显示）
  ensureThumbsForRange(old, Math.min(nextCount + PREFETCH, rawLocations.value.length))
  // 在空闲时间预热下一批缩略图
  idlePrefetch()
}

/* ======== 首页数据缓存：内存 + 会话存储（刷新也快） ======== */
let __LOCATIONS_CACHE__ = null
let __LOCATIONS_CACHED_AT__ = 0
const CACHE_TTL_MS = 60 * 1000  // 1 分钟，可按需调整
const SS_KEY = 'LOC_CACHE_V1'

function readSS(){
  try{ return JSON.parse(sessionStorage.getItem(SS_KEY) || '') }catch{ return null }
}
function writeSS(v){
  try{ sessionStorage.setItem(SS_KEY, JSON.stringify(v)) }catch{}
}

/* ====== IntersectionObserver 触底加载 ====== */
const sentinel = ref(null)
let io = null
function setupIO() {
  if (!('IntersectionObserver' in window)) return
  io = new IntersectionObserver(([e]) => {
    if (!e) return
    if (e.isIntersecting) loadMore()
  }, { root: null, rootMargin: '200px', threshold: 0 })
  if (sentinel.value) io.observe(sentinel.value)
}
function cleanupIO(){ if (io) { io.disconnect(); io = null } }

/* ====== 空闲时间预取下一批缩略图（不与首屏抢带宽） ====== */
function idle(cb){
  if ('requestIdleCallback' in window) return requestIdleCallback(cb, { timeout: 1200 })
  return setTimeout(cb, 200)
}
function idlePrefetch(){
  idle(() => {
    const next = (locations.value || []).slice(visibleCount.value, visibleCount.value + PREFETCH)
    next.forEach(it => {
      const src = it?.rawImage ? thumb(it.rawImage, 480, 60) : ''
      if (src) imgCache.warmup?.([src])
    })
  })
}

/* ===== 新增：为指定区间实际填充缩略图（核心修复） ===== */
async function ensureThumbsForRange(start = 0, end = 0){
  const list = rawLocations.value || []
  const L = list.length
  if (L === 0) return
  const s = Math.max(0, Math.min(start, L))
  const e = Math.max(s, Math.min(end, L))
  for (let i = s; i < e; i++) {
    const it = list[i]
    if (!it) continue
    if (it.image) continue // 已有缩略图
    const src = it.rawImage ? thumb(it.rawImage, 480, 60) : ''
    if (!src) continue
    try {
      imgCache.warmup?.([src])
      const cached = await imgCache.getOrNet(src)
      // 写回 rawLocations，并合并到展示数组
      const id = it.id
      const idx = rawLocations.value.findIndex(x => x.id === id)
      if (idx !== -1) {
        rawLocations.value[idx] = { ...rawLocations.value[idx], image: cached }
        mergeStatusToLocal()
      }
    } catch {}
  }
}

/* ===== 生命周期：并行拉数据、不阻塞首屏 ===== */
onMounted(() => {
  document.title = '笃行校园图鉴'

  // 先尝试会话缓存（刷新后也能秒显）
  const ss = readSS()
  if (ss && !__LOCATIONS_CACHE__) {
    __LOCATIONS_CACHE__ = ss
    __LOCATIONS_CACHED_AT__ = Date.now()
  }

  // 立即渲染骨架，下一帧并行请求，避免阻塞首屏
  requestAnimationFrame(() => {
    Promise.allSettled([
      fetchMe(),
      loadMyStatus(),
      loadLocations(),   // 内置缓存；命中则秒回，否则请求
    ]).then(async () => {
      mergeStatusToLocal()
      // 确保首屏与预取区间都已填充缩略图
      await ensureThumbsForRange(0, Math.min(BATCH_SIZE + PREFETCH, rawLocations.value.length))
      idlePrefetch()
    })
  })

  // 等 DOM 完成挂载后再观察哨兵，避免 ref 为空
  nextTick(setupIO)
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  cleanupIO()
})

/* ===== 侧边栏 ===== */
function toggleSidebar(){ sidebarVisible.value = !sidebarVisible.value }

/* ===== 用户 & 状态 ===== */
async function fetchMe() {
  try {
    const me = await request('/auth/me', 'GET', null, { credentials: 'include' })
    if (me?.data?.code === 0) userRole.value = me.data.userInfo?.role || 'visitor'
  } catch {}
}
async function loadMyStatus() {
  try {
    const resp = await request('/checkin/status', 'GET', null, { credentials: 'include' })
    if (resp?.data?.code === 0) {
      unlockedLocations.value = resp.data.unlockedLocations || []
      lockingLocations.value  = resp.data.lockingLocations  || []
      return
    }
  } catch {}
  unlockedLocations.value = []
  lockingLocations.value  = []
}
function mergeStatusToLocal() {
  const unlocked = new Set(unlockedLocations.value || [])
  const locking  = new Set(lockingLocations.value  || [])
  locations.value = (rawLocations.value || []).map(it => {
    let status = 'normal'
    if (unlocked.has(it.id)) status = 'done'
    else if (locking.has(it.id)) status = 'pending'
    return { ...it, status }
  })
}

/* ===== 地图：按需加载（点 “＜” 才请求 /home/gallery） ===== */
function pickMapUrl(respData) {
  if (!respData) return ''
  const direct =
    respData.map || respData.mapUrl || respData.map_image || respData.mapImage ||
    respData.cover || respData.map_src || ''
  if (typeof direct === 'string' && direct.trim()) return direct.trim()
  const inner = respData.data || {}
  const innerDirect =
    inner.map || inner.mapUrl || inner.map_image || inner.mapImage ||
    inner.cover || inner.map_src || ''
  if (typeof innerDirect === 'string' && innerDirect.trim()) return innerDirect.trim()
  const imgs = respData.images || inner.images || []
  if (Array.isArray(imgs) && imgs.length && typeof imgs[0] === 'string') return imgs[0]
  const candidates =
    respData.gallery || inner.gallery ||
    respData.list    || inner.list    ||
    respData.photos  || inner.photos  || []
  if (Array.isArray(candidates) && candidates.length && typeof candidates[0] === 'string') {
    return candidates[0]
  }
  return ''
}

async function loadMap(){
  if (mapSrc.value) return
  try {
    const r = await request('/home/gallery', 'GET', null, { credentials: 'include', cacheBust: true })
    const d = r?.data?.data ?? r?.data ?? null
    const url = pickMapUrl(d)
    if (!url) { console.warn('[gallery] 未找到地图字段'); return }
    mapRawUrl    = url
    mapSrc.value = await imgCache.getOrNet(url)
    imgCache.warmup?.([url])
  } catch (e) {
    console.error('loadMap error:', e)
  }
}

/* ===== 预加载大图 ===== */
async function preloadImage(url) {
  if (!url) return ''
  await new Promise(res => {
    const img = new Image()
    img.onload = img.onerror = res
    img.decoding = 'async'
    img.loading = 'eager'
    img.src = url
  })
  return url
}

/* ===== 地点数据：缓存 + 首批渲染 + 预取 ===== */
async function loadLocations(){
  // 命中内存缓存（从其他页返回秒开）
  if (__LOCATIONS_CACHE__ && (Date.now() - __LOCATIONS_CACHED_AT__ < CACHE_TTL_MS)) {
    rawLocations.value = __LOCATIONS_CACHE__.map(x => ({ ...x }))
    mergeStatusToLocal()
    // 注意：不在这里重置 visibleCount，保持滚动进度
    // 静默刷新
    refreshLocationsInBackground()
    return
  }

  // 首次或缓存过期 → 拉取
  await fetchAndFillLocations({ preserveVisibleCount: false })
}

async function fetchAndFillLocations({ preserveVisibleCount = true } = {}) {
  try {
    const r = await request('/locations', 'GET', null, { credentials: 'include' })
    const list = r?.data?.data?.locations || r?.data?.locations || []

    // 1) 先渲染文字/骨架；图片先置空
    rawLocations.value = list.map(it => ({
      ...it,
      image   : '',                        // 列表缩略图占位
      rawImage: original(it.image || ''),  // 原图直链（viewer 用）
      expanded: false
    }))

    // 2) 首批缩略图：填充 BATCH_SIZE + PREFETCH
    const want = Math.min(list.length, BATCH_SIZE + PREFETCH)
    await ensureThumbsForRange(0, want)

    // 3) 状态合并
    mergeStatusToLocal()

    // 4) 仅在非保留模式下重置首屏可见数量
    if (!preserveVisibleCount) {
      visibleCount.value = Math.min(BATCH_SIZE, rawLocations.value.length)
    }

    // 写入缓存（内存 + 会话）
    __LOCATIONS_CACHE__ = rawLocations.value.map(x => ({ ...x }))
    __LOCATIONS_CACHED_AT__ = Date.now()
    writeSS(__LOCATIONS_CACHE__)
  } catch (e) {
    console.error('loadLocations error:', e)
    rawLocations.value = []
    mergeStatusToLocal()
  }
}

// 静默刷新（命中缓存时使用）
async function refreshLocationsInBackground() {
  try {
    await fetchAndFillLocations({ preserveVisibleCount: true })
    // 刷新后，确保当前可见区间的缩略图都已填充
    await ensureThumbsForRange(0, Math.min(visibleCount.value + PREFETCH, rawLocations.value.length))
    idlePrefetch()
  } catch {}
}

/* ===== viewer（页面内查看） ===== */
async function openMapAlbum(){
  if (!mapSrc.value) {
    await loadMap()
    if (!mapSrc.value) { alert('地图未准备好'); return }
  }
  viewerList.value    = [mapSrc.value]
  currentIndex.value  = 0
  viewerVisible.value = true
}

async function openSingleInViewer(item){
  const raw = item?.rawImage || original(item?.image || '')
  if (!raw) return

  const small = thumbForViewer(raw, 1080, 70)
  viewerList.value    = [small]
  currentIndex.value  = 0
  viewerVisible.value = true

  try {
    const full = await preloadImage(raw)
    viewerList.value.splice(0, 1, full)
  } catch {}
}
function closeViewer(){ viewerVisible.value = false }
function prevImg(){ currentIndex.value = (currentIndex.value - 1 + viewerList.value.length) % viewerList.value.length }
function nextImg(){ currentIndex.value = (currentIndex.value + 1) % viewerList.value.length }
function goToIndex(i){ currentIndex.value = i }
function onKeydown(e){
  if (!viewerVisible.value) return
  if (e.key==='ArrowLeft')  prevImg()
  if (e.key==='ArrowRight') nextImg()
}

/* ===== 列表交互 ===== */
function toggleDescription(id){
  locations.value = locations.value.map(item =>
    item.id === id ? { ...item, expanded: !item.expanded } : item
  )
}

/* ===== 图片 srcset 生成（自适应更省流） ===== */
function srcsetFor(item){
  const raw = item?.rawImage || ''
  if (!raw) return ''
  const x15 = thumb(raw, 720, 60)
  const x20 = thumb(raw, 960, 60)
  return `${item.image} 1x, ${x15} 1.5x, ${x20} 2x`
}

/* ===== 打卡流程（原逻辑保持） ===== */
import auth from '@/utils/auth'

function isAuthed() {
  try { return typeof auth?.isLoggedIn === 'function' ? auth.isLoggedIn() : !!auth?.isLoggedIn }
  catch { return false }
}
function showStepError(step, errOrMsg, extra = {}) {
  const msg = typeof errOrMsg === 'string' ? errOrMsg : (errOrMsg?.message || '未知错误')
  console.groupCollapsed(`[checkin] ❌ ${step} 失败：${msg}`)
  console.log('extra =>', extra)
  if (errOrMsg && typeof errOrMsg !== 'string') console.error(errOrMsg)
  console.groupEnd()
  alert(`${step} 失败：${msg}`)
}
function pickImageOnce() {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => resolve((input.files && input.files[0]) || null)
    input.click()
  })
}

async function checkIn(id) {
  const loc = (locations.value || []).find(l => l.id === id)
  if (loc && (loc.status === 'pending' || loc.status === 'done')) {
    await previewExistingPhoto(id)
    return
  }
  if (!isAuthed()) { pushOrRedirect('/signin'); return }

  const file = await pickImageOnce()
  if (!file) return
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const fileType = file.type || 'image/jpeg'

  try {
    let sign
    try { sign = await request('/checkin/presign', 'POST', { ext, locationId: id }) }
    catch (e) { return showStepError('预签名(/checkin/presign) 网络', e) }
    if ((sign?.status && sign.status !== 200) || sign?.data?.code !== 0) {
      return showStepError('预签名(/checkin/presign) 返回', sign?.data?.message || `HTTP ${sign?.status}`, { sign })
    }
    const { key, putUrl, contentType } = sign.data.data || {}
    if (!putUrl || !key) return showStepError('预签名', '返回缺少 putUrl 或 key', { signData: sign?.data })
    const usedContentType = contentType || fileType

    let putRes
    try {
      putRes = await fetch(putUrl, { method: 'PUT', mode: 'cors', headers: { 'Content-Type': usedContentType }, body: file })
    } catch (e) {
      return showStepError('上传(对象存储 PUT) 网络/CORS', e, { putUrl, usedContentType })
    }
    if (!putRes.ok) {
      let bodyText = ''
      try { bodyText = await putRes.text() } catch {}
      return showStepError('上传(对象存储 PUT) 状态码', `HTTP ${putRes.status}`, {
        status: putRes.status,
        headers: Object.fromEntries(putRes.headers.entries()),
        bodyText: bodyText?.slice(0, 400)
      })
    }

    let commit
    try { commit = await request('/checkin/commit', 'POST', { key, size: file.size, locationId: id }) }
    catch (e) { return showStepError('绑定(/checkin/commit) 网络', e) }
    if ((commit?.status && commit.status !== 200) || commit?.data?.code !== 0) {
      return showStepError('绑定(/checkin/commit) 返回', commit?.data?.message || `HTTP ${commit?.status}`, { commit })
    }
    const photoUrl = commit?.data?.url || ''

    const nowISO = new Date().toISOString()
    const records = JSON.parse(localStorage.getItem('checkinRecords') || '[]')
    records.push({ locationId: id, time: nowISO, photo: photoUrl })
    localStorage.setItem('checkinRecords', JSON.stringify(records))

    locations.value = (locations.value || []).map(it =>
      it.id === id ? { ...it, status: 'pending' } : it
    )

    alert('打卡成功，等待审核')
  } catch (err) {
    console.error('[checkin] 未捕获错误', err)
    alert('网络异常（可能是 CORS、跨域 Cookie 或对象存储拦截）')
  }
}

/* ===== ✅ 已上传图片预览：优先从后端拿“最新一张” ===== */
async function previewExistingPhoto(locationId) {
  let url = ''
  if (isAuthed()) {
    try {
      const resp = await request('/checkin/photo/latest', 'GET', { locationId })
      url = resp?.data?.data?.url || resp?.data?.url || ''
    } catch (e) {}
  }
  if (!url) {
    const localUrl = getLocalPhotoUrl(locationId)
    if (localUrl) url = localUrl
  }
  if (url) openSingleInViewer({ image: url })
  else alert('未找到已提交的照片')
}
function getLocalPhotoUrl(locationId) {
  const records = JSON.parse(localStorage.getItem('checkinRecords') || '[]')
  const list = records
    .filter(r => Number(r.locationId) === Number(locationId) && r.photo)
    .sort((a, b) => String(b.time).localeCompare(String(a.time)))
  return list.length ? list[0].photo : ''
}

/* ===== 跳转 ===== */
function pushOrRedirect(path){
  const redirect = encodeURIComponent((route && route.fullPath) || window.location.pathname)
  if (router) router.push({ path, query: { redirect } })
  else window.location.href = `${path}?redirect=${redirect}`
}
function goToMyCheckins(){ isAuthed() ? pushOrRedirect('/myCheckins') : pushOrRedirect('/signin') }
function goToRank(){ isAuthed() ? pushOrRedirect('/rank') : pushOrRedirect('/signin') }
function goToMessage(){ isAuthed() ? pushOrRedirect('/message') : pushOrRedirect('/signin') }
function goToConnect(){ pushOrRedirect('/connect') }
function goToAdmin(){ pushOrRedirect('/admin/review') }
</script>

<style scoped>
/* —— 视觉与小程序一致 —— */
.bg-wrapper {
  position: relative;
  width: 100%;
  min-height: 100vh;
  overflow: visible;
}
.bg-img {
  position: fixed;
  left: 0; top: 0;
  width: 100vw;
  height: 100vh;
  z-index: -1;
  object-fit: cover;
}
.content {
  padding: 10px;
  box-sizing: border-box;
  position: relative;
}

.menu-icon { position: fixed; top: calc(10px + var(--app-top-offset)); left: 10px; font-size: 25px; z-index: 10000; color: #000; cursor: pointer; }
.back-icon { position: fixed; top: calc(10px + var(--app-top-offset)); right: 10px; font-size: 25px; z-index: 10000; color: #000; background: transparent; border: 0; line-height: 1; cursor: pointer; }

.logo-container { display: flex; justify-content: center; margin-bottom: 15px; }
.logo-img { width: 150px; }
.header { text-align: center; margin-bottom: 15px; }
.title  { font-size: 18px; font-weight: bold; color: #fff; text-shadow: 1px 1px 2px rgba(0,0,0,.3); }

/* viewer：网页内查看，不触发下载 */
.viewer-mask { position: fixed; inset: 0; z-index: 15000; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; padding: 16px; }
.viewer-swiper { width: 100%; max-width: 980px; height: 62vh; border-radius: 12px; overflow: hidden; background: #000; position: relative; box-shadow: 0 10px 40px rgba(0,0,0,.35); display: flex; align-items: center; justify-content: center; }
.viewer-img { width: 100%; height: 100%; object-fit: contain; user-select: none; }
.viewer-prev, .viewer-next { position: absolute; top: 50%; transform: translateY(-50%); width: 44px; height: 44px; border-radius: 50%; border: none; color: #fff; background: rgba(0,0,0,.45); font-size: 26px; line-height: 44px; cursor: pointer; }
.viewer-prev { left: 10px; } .viewer-next { right: 10px; }
.viewer-dots { position: absolute; bottom: 10px; left: 0; right: 0; display: flex; justify-content: center; gap: 6px; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,.35); }
.dot.active { background: #fff; }
.viewer-pager { position: fixed; right: 24px; bottom: 24px; z-index: 15001; padding: 4px 9px; border-radius: 12px; font-size: 13px; color: #fff; background: rgba(0,0,0,.45); }
.viewer-close { position: fixed; right: 24px; top: 24px; z-index: 15001; width: 28px; height: 28px; border-radius: 50%; background: rgba(0,0,0,.55); color: #fff; font-size: 20px; line-height: 28px; text-align: center; cursor: pointer; }

/* 列表容器与卡片 */
.card-list { padding-right: 10px; margin-right: -5px; }
.card-horizontal { display: flex; background-color: rgba(255,255,255,.9); border-radius: 10px; margin-bottom: 15px; box-shadow: 0 2px 5px rgba(0,0,0,.1); overflow: hidden; align-items: center; }

/* 新容器：先渲染骨架，再淡入图片 —— 不影响原有 viewer、点击等功能 */
.card-img-wrap { width: 45%; aspect-ratio: 4/3; margin-left: 10px; flex-shrink: 0; border-radius: 10px; overflow: hidden; display:flex; align-items:center; }
@media (min-width: 1024px){ .card-img-wrap { aspect-ratio: 3/2; } }

.card-img-left { width: 95%; height: 95%; border-radius: 10px; object-fit: cover; flex-shrink: 0; margin-left: 4px; cursor: zoom-in; }

/* 骨架条 */
.img-skeleton {
  width: 100%; height: 100%;
  background: linear-gradient(90deg, #eee 25%, #f5f5f5 37%, #eee 63%);
  background-size: 400% 100%;
  animation: shine 1.2s ease-in-out infinite;
  border-radius: 10px;
}

/* 图片淡入（先模糊/透明，加载完成后清晰） */
.card-img-wrap .card-img-left {
  filter: blur(10px); opacity: .2; transition: filter .28s ease, opacity .28s ease;
}
.card-img-wrap .card-img-left.loaded { filter: blur(0); opacity: 1; }

@keyframes shine {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.card-info { flex: 1; padding: 10px; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box; min-width: 0; }
.card-title { font-size: 16px; font-weight: bold; margin-bottom: 5px; color: #333; }
.card-meta { font-size: 13px; color: #666; margin-bottom: 3px; }

.btn-group { display: flex; flex-direction: column; gap: 4px; margin-top: 4px; width: 100%; box-sizing: border-box; }
.checkin-btn { width: 100%; max-width: 100%; box-sizing: border-box; background-color: #175c28; color: #fff; font-size: 13px; padding: 4px 16px; border-radius: 4px; border: none; cursor: pointer; }
.detail-btn  { width: 100%; max-width: 100%; box-sizing: border-box; background-color: #dddddd; color: #333; font-size: 13px; padding: 4px 10px; border-radius: 4px; border: none; cursor: pointer; }

.card-description { background-color: rgba(255,255,255,.95); padding: 15px; margin: -5px 0 20px 0; border-radius: 0 0 10px 10px; font-size: 13px; line-height: 1.6; color: #333; }

.sidebar-mask { position: fixed; inset: 0; background-color: rgba(0,0,0,.4); z-index: 1000; }
.sidebar { background-color: rgba(0, 51, 20, 0.92); color: #fff; width: 225px; height: 100%; position: fixed; z-index: 9999; top: 0; left: 0; display: flex; flex-direction: column; box-shadow: 0 0 10px rgba(0,0,0,.3); padding-left: 20px; padding-top: calc(40px + var(--app-top-offset)); font-weight: 800; font-family: "PingFang SC","Microsoft YaHei",sans-serif; }
.sidebar-button { padding: 15px; font-size: 17px; color: #fff; border-bottom: 1px solid rgba(255,255,255,.2); letter-spacing: 1px; line-height: 30px; }
.viewer-tip{
  position: absolute;
  bottom: 56px;          /* 可按需要微调，避免挡住分页器 */
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 10px;
  font-size: 12px;
  color: #fff;
  background: rgba(0,0,0,.45);
  border-radius: 14px;
  pointer-events: none;  /* 不拦截点击 */
  user-select: none;
}

</style>
