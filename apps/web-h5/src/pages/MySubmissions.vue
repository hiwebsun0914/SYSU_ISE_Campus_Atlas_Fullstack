<template>
  <main class="records-page">
    <div class="paper-grid" aria-hidden="true"></div>

    <header class="records-nav">
      <button class="nav-back" type="button" aria-label="返回个人主页" @click="goBack">
        <ArrowLeft :size="19" aria-hidden="true" />
      </button>
      <div class="nav-title">
        <p class="panel-label">MY SUBMISSIONS / 2026</p>
        <h1>我的投稿记录</h1>
      </div>
    </header>

    <section v-if="loading" class="records-loading" aria-busy="true" aria-label="正在加载投稿记录">
      <div class="skeleton skeleton-card"></div>
      <div class="skeleton skeleton-card"></div>
      <div class="skeleton skeleton-card"></div>
    </section>

    <section v-else-if="loadError" class="records-error" role="alert">
      <AlertCircle :size="26" aria-hidden="true" />
      <h2>投稿记录暂时没有加载完成</h2>
      <p>{{ loadError }}</p>
      <button class="retry-button" type="button" @click="loadRecords">
        <RotateCcw :size="16" aria-hidden="true" />
        重新加载
      </button>
    </section>

    <div v-else class="records-body">
      <section class="records-section" aria-labelledby="records-title">
        <div class="section-heading">
          <div>
            <p class="panel-label">MY SUBMISSIONS</p>
            <h2 id="records-title">投稿记录</h2>
            <p class="section-desc">打卡照片与作品投稿的审核进度都在这里。</p>
          </div>
        </div>

        <div class="records-tabs" role="tablist" aria-label="切换投稿类型">
          <button
            id="tab-photos"
            type="button"
            role="tab"
            :aria-selected="activeTab === 'photos'"
            aria-controls="panel-photos"
            :class="{ active: activeTab === 'photos' }"
            @click="activeTab = 'photos'"
          >
            <Camera :size="15" aria-hidden="true" />
            打卡照片
            <span>{{ photoItems.length }}</span>
          </button>
          <button
            id="tab-works"
            type="button"
            role="tab"
            :aria-selected="activeTab === 'works'"
            aria-controls="panel-works"
            :class="{ active: activeTab === 'works' }"
            @click="activeTab = 'works'"
          >
            <Trophy :size="15" aria-hidden="true" />
            作品投稿
            <span>{{ workItems.length }}</span>
          </button>
        </div>

        <!-- 打卡照片 -->
        <div
          v-if="activeTab === 'photos'"
          id="panel-photos"
          role="tabpanel"
          aria-labelledby="tab-photos"
        >
          <div class="filter-row" aria-label="筛选打卡照片状态">
            <button
              v-for="filter in photoFilters"
              :key="filter.id"
              type="button"
              :class="{ active: photoFilter === filter.id }"
              :aria-pressed="photoFilter === filter.id"
              @click="photoFilter = filter.id"
            >
              {{ filter.label }}<span>{{ filter.count }}</span>
            </button>
          </div>

          <ul v-if="filteredPhotoItems.length" class="photo-list">
            <li v-for="item in filteredPhotoItems" :key="item.key" class="photo-card">
              <a
                v-if="item.photo && !failedPhotoImages.has(item.key)"
                class="photo-thumb"
                :href="item.photo"
                target="_blank"
                rel="noopener"
                :aria-label="`查看${item.name}的打卡照片大图`"
              >
                <img
                  :src="item.photo"
                  :alt="`${item.name}打卡照片`"
                  loading="lazy"
                  decoding="async"
                  @error="markPhotoImageFailed(item.key)"
                />
              </a>
              <span v-else class="photo-thumb photo-thumb-empty">
                <ImageIcon :size="22" aria-hidden="true" />
                <small v-if="item.photo">图片暂不可用</small>
              </span>

              <div class="photo-info">
                <div class="photo-title-row">
                  <strong>{{ item.name }}</strong>
                  <span v-if="item.isHidden" class="hidden-chip">隐藏打卡点</span>
                </div>
                <time :datetime="item.isoTime">{{ item.timeText }}</time>
                <p v-if="item.status === 'rejected' && item.note" class="reject-note">
                  驳回理由：{{ item.note }}
                </p>
                <p v-if="item.appealReason" class="appeal-note">
                  我的申诉：{{ item.appealReason }}
                </p>
              </div>

              <span class="status-chip" :class="'status-' + item.status">
                <component :is="statusMeta(item).icon" :size="13" aria-hidden="true" />
                {{ statusMeta(item).label }}
              </span>
            </li>
          </ul>

          <div v-else class="empty-state">
            <Camera :size="24" aria-hidden="true" />
            <div>
              <strong>{{ photoItems.length ? '当前筛选下没有打卡照片' : '还没有上传过打卡照片' }}</strong>
              <p>{{ photoItems.length ? '切换状态筛选查看其他照片。' : '到校园里找到一个打卡点，拍照上传后状态会显示在这里。' }}</p>
            </div>
            <button v-if="!photoItems.length" class="ghost-button" type="button" @click="router.push('/map')">去地图打卡</button>
          </div>
        </div>

        <!-- 作品投稿 -->
        <div
          v-else
          id="panel-works"
          role="tabpanel"
          aria-labelledby="tab-works"
        >
          <div class="filter-row" aria-label="筛选作品投稿状态">
            <button
              v-for="filter in workFilters"
              :key="filter.id"
              type="button"
              :class="{ active: workFilter === filter.id }"
              :aria-pressed="workFilter === filter.id"
              @click="workFilter = filter.id"
            >
              {{ filter.label }}<span>{{ filter.count }}</span>
            </button>
          </div>

          <ul v-if="filteredWorkItems.length" class="work-list">
            <li v-for="item in filteredWorkItems" :key="item.id" class="work-card">
              <button class="work-main" type="button" @click="openSubmission(item.id)">
                <span class="work-thumb">
                  <img
                    v-if="item.image && !failedWorkImages.has(String(item.id))"
                    :src="item.image"
                    :alt="`${item.title}作品预览`"
                    loading="lazy"
                    decoding="async"
                    @error="markWorkImageFailed(item.id)"
                  />
                  <ImageIcon v-else :size="24" aria-hidden="true" />
                </span>
                <span class="work-info">
                  <span class="work-meta">{{ item.categoryName || '校园作品' }} · {{ item.timeText }}</span>
                  <strong>{{ item.title }}</strong>
                  <span class="work-status-row">
                    <span class="status-chip" :class="'status-' + item.status">
                      <component :is="statusMeta(item).icon" :size="13" aria-hidden="true" />
                      {{ statusMeta(item).label }}
                    </span>
                    <ChevronRight :size="15" aria-hidden="true" />
                  </span>
                </span>
              </button>
              <p v-if="item.status === 'rejected' && item.reviewNote" class="reject-note work-reject">
                驳回理由：{{ item.reviewNote }}
              </p>
            </li>
          </ul>

          <div v-else class="empty-state">
            <Trophy :size="24" aria-hidden="true" />
            <div>
              <strong>{{ workItems.length ? '当前筛选下没有作品' : '还没有投稿作品' }}</strong>
              <p>{{ workItems.length ? '切换状态筛选查看其他作品。' : '提交创意或摄影作品后，审核状态会显示在这里。' }}</p>
            </div>
            <button v-if="!workItems.length" class="ghost-button" type="button" @click="router.push('/award/submit')">去投稿</button>
          </div>
        </div>
      </section>
    </div>

    <footer class="records-footer">
      <span>SYSU ISE CAMPUS EXPLORE</span>
      <span>MY SUBMISSIONS</span>
    </footer>
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Image as ImageIcon,
  RotateCcw,
  Trophy,
  XCircle
} from '@lucide/vue'
import { request } from '@/utils/request'
import { backendToPlaceId, getPlaceById } from '@/data/campusPlaces'

const router = useRouter()

const loading = ref(true)
const loadError = ref('')
const photoItems = ref([])
const workItems = ref([])
const activeTab = ref('photos')
const photoFilter = ref('all')
const workFilter = ref('all')
const failedPhotoImages = ref(new Set())
const failedWorkImages = ref(new Set())

function statusMeta(item) {
  if (item.status === 'approved') {
    return { label: item.appealStatus === 'approved' ? '申诉已通过' : '已通过', icon: CheckCircle2 }
  }
  if (item.status === 'rejected') {
    return { label: '未通过', icon: XCircle }
  }
  return { label: item.appealStatus === 'pending' ? '申诉复核中' : '待审核', icon: Clock3 }
}

function toDate(value) {
  if (value == null || value === '') return null
  const date = typeof value === 'number' || /^\d+$/.test(String(value))
    ? new Date(Number(value))
    : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatTime(value) {
  const date = toDate(value)
  if (!date) return '时间未记录'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }).format(date)
}

function placeOf(locationId) {
  const slug = backendToPlaceId[Number(locationId)]
  return slug ? getPlaceById(slug) : null
}

function canonicalPhotoKey(value) {
  if (!value) return ''
  try {
    return decodeURIComponent(String(value))
      .split('?')[0]
      .split('#')[0]
      .replace(/^https?:\/\/[^/]+/i, '')
  } catch {
    return String(value).split('?')[0].split('#')[0]
  }
}

function photoMetaFromKey(key) {
  const parts = String(key || '').split('/')
  const locationId = Number(parts[2])
  const filename = parts[3] || ''
  const match = filename.match(/^(\d{10,})_/)
  return {
    locationId: Number.isInteger(locationId) ? locationId : 0,
    uploadedAt: match ? Number(match[1]) : 0
  }
}

function normalizePhotoItem(item, status, history = null) {
  const locationId = Number(item.locationId || history?.locationId)
  const place = placeOf(locationId)
  const time = Number(
    item.submittedAt || history?.uploadedAt || item.reviewedAt || item.appealedAt || 0
  )
  const photo = item.photo || history?.url || ''
  const objectKey = item.key || history?.key || canonicalPhotoKey(photo)
  const identity = canonicalPhotoKey(objectKey) || `location-${locationId}-${time}`

  return {
    key: `${status}-${locationId}-${time}-${identity}`,
    locationId,
    name: place?.name || `地点 ${locationId}`,
    isHidden: place?.isHidden === 1,
    photo,
    status,
    note: item.note || '',
    appealStatus: item.appealStatus || '',
    appealReason: item.appealReason || '',
    timeValue: time,
    timeText: formatTime(time),
    isoTime: toDate(time)?.toISOString() || '',
    identity
  }
}

function historyStatusByLocation(pendingList, recordList, unlockedLocations) {
  const statusByLocation = new Map()

  for (const item of recordList || []) {
    const locationId = Number(item.locationId)
    const current = statusByLocation.get(locationId)
    const time = Number(item.submittedAt || item.reviewedAt || item.appealedAt || 0)
    if (!current || current.timeValue < time) {
      statusByLocation.set(locationId, {
        status: item.status === 'approved' ? 'approved' : 'rejected',
        timeValue: time
      })
    }
  }

  for (const item of pendingList || []) {
    const locationId = Number(item.locationId)
    statusByLocation.set(locationId, {
      status: 'pending',
      timeValue: Number(item.submittedAt || 0)
    })
  }

  for (const locationId of unlockedLocations || []) {
    if (!statusByLocation.has(Number(locationId))) {
      statusByLocation.set(Number(locationId), { status: 'approved', timeValue: 0 })
    }
  }

  return statusByLocation
}

/**
 * 保留每一次实际上传的照片，而不是按地点只显示最新一条。
 * 待审核记录优先覆盖同一张照片的历史审核记录；COS 历史照片用于补齐早期记录里缺失的 photo URL。
 */
function mergePhotoItems(pendingList, recordList, historyList = [], unlockedLocations = []) {
  const normalizedRecords = (recordList || []).map(item => ({
    item,
    status: item.status === 'approved' ? 'approved' : 'rejected'
  }))
  const normalizedPending = (pendingList || []).map(item => ({ item, status: 'pending' }))
  const history = (historyList || []).filter(item => item?.url || item?.key)
  const historyByLocation = new Map()

  for (const item of history) {
    const meta = item.locationId ? item : { ...item, ...photoMetaFromKey(item.key) }
    const list = historyByLocation.get(Number(meta.locationId)) || []
    list.push({ ...item, ...meta })
    historyByLocation.set(Number(meta.locationId), list)
  }
  for (const list of historyByLocation.values()) {
    list.sort((a, b) => Number(b.uploadedAt || 0) - Number(a.uploadedAt || 0))
  }

  const usedHistory = new Set()
  const items = []
  const add = (item, status, historyItem = null) => {
    const normalized = normalizePhotoItem(item, status, historyItem)
    const existingIndex = items.findIndex(candidate => candidate.identity === normalized.identity)
    if (existingIndex === -1) {
      items.push(normalized)
      return
    }

    // 同一张照片在“待审核”和“审核记录”中都会出现时，只保留当前状态。
    if (status === 'pending') items[existingIndex] = normalized
  }

  for (const { item, status } of normalizedRecords) {
    const locationId = Number(item.locationId)
    const candidates = historyByLocation.get(locationId) || []
    const recordTime = Number(item.submittedAt || item.reviewedAt || item.appealedAt || 0)
    const matchingHistory = !item.photo
      ? candidates
          .filter(candidate => !usedHistory.has(candidate.key))
          .sort((a, b) => (
            Math.abs(Number(a.uploadedAt || 0) - recordTime)
            - Math.abs(Number(b.uploadedAt || 0) - recordTime)
          ))[0]
      : null
    if (matchingHistory) usedHistory.add(matchingHistory.key)
    add(item, status, matchingHistory || null)
  }

  for (const { item, status } of normalizedPending) {
    const locationId = Number(item.locationId)
    const candidates = historyByLocation.get(locationId) || []
    const submittedAt = Number(item.submittedAt || 0)
    const matchingHistory = !item.photo
      ? candidates
          .filter(candidate => !usedHistory.has(candidate.key))
          .sort((a, b) => (
            Math.abs(Number(a.uploadedAt || 0) - submittedAt)
            - Math.abs(Number(b.uploadedAt || 0) - submittedAt)
          ))[0]
      : null
    if (matchingHistory) usedHistory.add(matchingHistory.key)
    add(item, status, matchingHistory || null)
  }

  const statusByLocation = historyStatusByLocation(pendingList, recordList, unlockedLocations)
  for (const historyItem of history) {
    if (usedHistory.has(historyItem.key)) continue
    const identity = canonicalPhotoKey(historyItem.key || historyItem.url)
    if (items.some(item => item.identity === identity)) continue
    const locationId = Number(historyItem.locationId || photoMetaFromKey(historyItem.key).locationId)
    const fallbackStatus = statusByLocation.get(locationId)?.status || 'approved'
    add({ locationId }, fallbackStatus, historyItem)
  }

  return items.sort((a, b) => b.timeValue - a.timeValue)
}

async function loadPhotoHistory(locationIds) {
  const historyResponse = await request('/checkin/photo/history', 'GET', null, {
    cacheBust: true,
    timeout: 15000
  })
  if (historyResponse?.ok && historyResponse?.data?.code === 0) {
    return historyResponse.data.data?.photos || []
  }

  // 兼容尚未部署 history 接口的旧后端：按地点读取 key，再换取签名 URL。
  const ids = [...new Set((locationIds || []).map(Number).filter(Number.isInteger))]
  const entries = []
  const listResponses = await Promise.all(ids.map(locationId => request(
    '/checkin/photo/list',
    'GET',
    { locationId },
    { cacheBust: true, timeout: 15000 }
  )))

  for (const response of listResponses) {
    if (!response?.ok || response?.data?.code !== 0) continue
    entries.push(...(response.data.data?.photos || []))
  }

  const signedPhotos = await Promise.all(entries.slice(0, 100).map(async entry => {
    const signResponse = await request('/checkin/photo/sign', 'GET', { key: entry.key }, {
      cacheBust: true,
      timeout: 15000
    })
    if (!signResponse?.ok || signResponse?.data?.code !== 0) return null
    const meta = photoMetaFromKey(entry.key)
    return {
      key: entry.key,
      url: signResponse.data.data?.url || '',
      ...meta
    }
  }))

  return signedPhotos.filter(item => item?.url)
}

function countByStatus(list) {
  return {
    all: list.length,
    pending: list.filter(item => item.status === 'pending').length,
    approved: list.filter(item => item.status === 'approved').length,
    rejected: list.filter(item => item.status === 'rejected').length
  }
}

function buildFilters(counts) {
  return [
    { id: 'all', label: '全部', count: counts.all },
    { id: 'pending', label: '待审核', count: counts.pending },
    { id: 'approved', label: '已通过', count: counts.approved },
    { id: 'rejected', label: '未通过', count: counts.rejected }
  ]
}

const photoFilters = computed(() => buildFilters(countByStatus(photoItems.value)))
const workFilters = computed(() => buildFilters(countByStatus(workItems.value)))

const filteredPhotoItems = computed(() => (
  photoFilter.value === 'all'
    ? photoItems.value
    : photoItems.value.filter(item => item.status === photoFilter.value)
))
const filteredWorkItems = computed(() => (
  workFilter.value === 'all'
    ? workItems.value
    : workItems.value.filter(item => item.status === workFilter.value)
))

function markPhotoImageFailed(key) {
  failedPhotoImages.value = new Set([...failedPhotoImages.value, String(key)])
}

function markWorkImageFailed(id) {
  failedWorkImages.value = new Set([...failedWorkImages.value, String(id)])
}

function openSubmission(id) {
  router.push('/award/submission/' + encodeURIComponent(id))
}

function goBack() {
  router.push('/myCheckins')
}

async function loadRecords() {
  if (!localStorage.getItem('token')) {
    router.replace({ path: '/signin', query: { redirect: '/my/submissions' } })
    return
  }

  loading.value = true
  loadError.value = ''

  try {
    const [statusResponse, submissionsResponse] = await Promise.all([
      request('/checkin/status', 'GET', null, { cacheBust: true }),
      request('/submissions/mine', 'GET', null, { cacheBust: true })
    ])

    if (statusResponse.status === 401 || submissionsResponse.status === 401) {
      localStorage.removeItem('token')
      router.replace({ path: '/signin', query: { redirect: '/my/submissions' } })
      return
    }
    if (!statusResponse?.ok || statusResponse?.data?.code !== 0) {
      throw new Error(statusResponse?.data?.message || '无法读取打卡照片记录')
    }
    if (!submissionsResponse?.ok || submissionsResponse?.data?.code !== 0) {
      throw new Error(submissionsResponse?.data?.message || '无法读取作品投稿记录')
    }

    const pendingCheckins = statusResponse.data.pendingCheckins || []
    const reviewRecords = statusResponse.data.checkinReviewRecords || []
    const locationIds = [
      ...(statusResponse.data.unlockedLocations || []),
      ...pendingCheckins.map(item => item.locationId),
      ...reviewRecords.map(item => item.locationId)
    ]
    const photoHistory = await loadPhotoHistory(locationIds).catch(() => [])

    photoItems.value = mergePhotoItems(
      pendingCheckins,
      reviewRecords,
      photoHistory,
      statusResponse.data.unlockedLocations || []
    )
    workItems.value = (submissionsResponse.data.list || []).map(item => ({
      id: item.id,
      title: item.title || '未命名作品',
      categoryName: item.categoryName || '',
      image: item.images?.find(image => image?.url)?.url || '',
      status: ['pending', 'approved', 'rejected'].includes(item.status) ? item.status : 'pending',
      reviewNote: item.reviewNote || '',
      createdAt: item.createdAt,
      timeText: formatTime(item.createdAt)
    }))
  } catch (error) {
    loadError.value = error?.message || '投稿记录加载失败，请稍后重试。'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  document.title = '我的投稿记录｜SYSU ISE 校园探索'
  window.scrollTo({ top: 0, left: 0 })
  loadRecords()
})
</script>

<style scoped>
.records-page {
  --ink: #0a2e3b;
  --primary: #0d9488;
  --primary-dark: #08766d;
  --accent: #c7f24a;
  --canvas: #f3f7f5;
  --surface: #ffffff;
  --text: #102a2e;
  --muted: #5e7271;
  --border: #d6e4df;
  --danger: #c2413a;
  --technical: "SFMono-Regular", Menlo, Consolas, monospace;
  position: relative;
  min-height: 100vh;
  background: var(--canvas);
  color: var(--text);
  font-family: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  overflow-x: clip;
}

.paper-grid {
  position: fixed;
  inset: 0;
  pointer-events: none;
  opacity: .55;
  background-image:
    linear-gradient(rgba(10, 46, 59, .045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(10, 46, 59, .045) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: linear-gradient(to bottom, #000 0%, rgba(0,0,0,.8) 60%, transparent 100%);
}

.records-nav {
  position: relative;
  z-index: 1;
  width: min(880px, calc(100% - 32px));
  margin: 14px auto 0;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 14px;
  border: 1px solid rgba(214, 228, 223, .86);
  border-radius: 10px;
  background: rgba(243, 247, 245, .88);
  backdrop-filter: blur(16px);
}

.nav-back {
  width: 44px;
  min-height: 44px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 50%;
  transition: transform .2s ease, border-color .2s ease, background .2s ease;
}
.nav-back:hover { transform: translateX(-2px); border-color: var(--primary); background: #eef7f4; }

.panel-label {
  margin: 0;
  color: var(--primary-dark);
  font: 800 10px/1.2 var(--technical);
  letter-spacing: .04em;
  text-transform: uppercase;
}
.nav-title h1 { margin: 4px 0 0; font-size: 20px; line-height: 1.2; letter-spacing: -.01em; }

.records-loading,
.records-error,
.records-body {
  position: relative;
  z-index: 1;
  width: min(880px, calc(100% - 32px));
  margin: 16px auto 0;
}

.records-loading { display: grid; gap: 12px; }
.skeleton { border-radius: 6px; background: linear-gradient(100deg, #e8efec 40%, #f6faf8 50%, #e8efec 60%); background-size: 200% 100%; animation: shimmer 1.4s infinite; }
.skeleton-card { height: 96px; }
@keyframes shimmer { to { background-position: -200% 0; } }

.records-error {
  padding: 48px 24px;
  display: grid;
  justify-items: center;
  gap: 10px;
  text-align: center;
  color: var(--muted);
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
}
.records-error h2 { margin: 0; color: var(--ink); font-size: 19px; }
.records-error p { margin: 0; font-size: 13px; }
.retry-button {
  margin-top: 6px;
  min-height: 44px;
  padding: 0 20px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: none;
  border-radius: 999px;
  background: var(--accent);
  color: var(--ink);
  font-size: 14px;
  font-weight: 700;
}

.records-body { display: grid; gap: 20px; padding-bottom: 56px; }

.records-section {
  padding: 22px 22px 8px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
}

.section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}
.section-heading h2 { margin: 6px 0 0; font-size: 20px; line-height: 1.25; letter-spacing: -.01em; }
.section-desc { margin: 6px 0 0; color: var(--muted); font-size: 12px; line-height: 1.6; }

.records-tabs {
  margin-top: 16px;
  display: flex;
  gap: 20px;
  border-bottom: 1px solid var(--border);
}
.records-tabs button {
  min-height: 40px;
  padding: 0 2px 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  background: transparent;
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
  transition: color .2s ease, border-color .2s ease;
}
.records-tabs button span { font: 700 10px/1 var(--technical); }
.records-tabs button.active {
  color: var(--ink);
  border-bottom-color: var(--primary);
}
.records-tabs button.active span { color: var(--primary-dark); }

.filter-row {
  margin-top: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.filter-row button {
  min-height: 34px;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--canvas);
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
  transition: border-color .2s ease, background .2s ease, color .2s ease;
}
.filter-row button span { font: 700 10px/1 var(--technical); }
.filter-row button.active {
  border-color: var(--primary);
  background: #e4f4f0;
  color: var(--ink);
}

.photo-list, .work-list {
  list-style: none;
  margin: 6px 0 0;
  padding: 0;
}

.photo-card {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
  padding: 14px 0;
  border-bottom: 1px solid var(--border);
}
.photo-card:last-child { border-bottom: 0; }

.photo-thumb {
  width: 72px;
  height: 72px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
}
.photo-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.photo-thumb-empty {
  gap: 4px;
  padding: 6px;
  color: var(--muted);
  text-align: center;
}
.photo-thumb-empty small { font-size: 9px; line-height: 1.25; }

.photo-info { min-width: 0; }
.photo-title-row { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.photo-title-row strong { font-size: 14px; font-weight: 650; }
.photo-info time { display: block; margin-top: 3px; color: var(--muted); font: 700 10px/1.4 var(--technical); }

.hidden-chip {
  padding: 2px 8px;
  border: 1px solid var(--primary);
  border-radius: 999px;
  color: var(--primary-dark);
  font-size: 10px;
  font-weight: 700;
}

.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  border: 1px solid transparent;
}
.status-pending { color: #8a6d1d; background: #fbf3d7; border-color: #eedda8; }
.status-approved { color: var(--primary-dark); background: #e4f4f0; border-color: #bfe3dc; }
.status-rejected { color: var(--danger); background: #fbe9e7; border-color: #f0cfcb; }

.reject-note {
  margin: 8px 0 0;
  padding: 2px 0 2px 10px;
  border-left: 2px solid var(--danger);
  color: #8c3a34;
  font-size: 12px;
  line-height: 1.6;
}
.appeal-note {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.6;
}

.work-card {
  border-bottom: 1px solid var(--border);
}
.work-card:last-child { border-bottom: 0; }
.work-main {
  width: 100%;
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 12px;
  padding: 14px 0;
  text-align: left;
  color: var(--text);
  background: transparent;
  transition: background .2s ease;
}
.work-main:hover .work-info strong { color: var(--primary-dark); }

.work-thumb {
  width: 88px;
  height: 66px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
}
.work-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }

.work-info { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.work-meta { color: var(--muted); font-size: 11px; }
.work-info strong { font-size: 14px; font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; transition: color .2s ease; }
.work-status-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.work-status-row > svg { color: var(--muted); flex: 0 0 auto; }
.work-reject { margin: 0 0 12px; }

.empty-state {
  margin-top: 14px;
  padding: 26px 0;
  display: flex;
  align-items: center;
  gap: 14px;
  border-top: 1px solid var(--border);
  color: var(--muted);
}
.empty-state strong { display: block; color: var(--ink); font-size: 14px; }
.empty-state p { margin: 4px 0 0; font-size: 12px; line-height: 1.6; }
.ghost-button {
  margin-left: auto;
  flex: 0 0 auto;
  min-height: 40px;
  padding: 0 16px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--ink);
  font-size: 12px;
  font-weight: 700;
}

.records-footer {
  position: relative;
  z-index: 1;
  width: min(880px, calc(100% - 32px));
  margin: 0 auto;
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid var(--border);
  color: var(--muted);
  font: 700 9px/1 var(--technical);
}

button { cursor: pointer; }
button:focus-visible, a:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }

@media (max-width: 560px) {
  .records-section { padding: 16px; }
  .photo-card { grid-template-columns: 64px minmax(0, 1fr); }
  .photo-card .status-chip { grid-column: 1 / -1; justify-self: start; }
  .photo-thumb { width: 64px; height: 64px; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
</style>
