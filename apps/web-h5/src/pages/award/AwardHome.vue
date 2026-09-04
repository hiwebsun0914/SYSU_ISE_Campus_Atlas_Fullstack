<template>
  <div class="award-page">
    <header class="discovery-header">
      <div class="topbar">
        <a class="back-link" href="#/" @click.prevent="router.push('/')" aria-label="返回首页">‹</a>
        <div class="brand-title">
          <span>SYSU ISE</span>
          <h1>作品广场</h1>
        </div>
        <button class="mine-link" type="button" @click="goMine">我的投稿</button>
      </div>

      <div class="award-tabs" role="tablist" aria-label="作品奖项">
        <button
          v-for="cat in categories"
          :key="cat.id"
          type="button"
          role="tab"
          :aria-selected="galleryFilter === cat.id"
          :class="{ active: galleryFilter === cat.id }"
          @click="setGalleryFilter(cat.id)"
        >
          {{ cat.name }}
        </button>
      </div>
    </header>

    <main class="award-main">
      <section class="gallery-section" aria-labelledby="gallery-title">
        <div class="gallery-head">
          <h2 id="gallery-title" class="sr-only">{{ currentCategoryName }}</h2>
          <span v-if="loggedIn" class="quota-chip" :class="{ ended: closed }">
            <template v-if="!closed">今日剩余 <b>{{ remainingVotes }}</b> 票</template>
            <template v-else>投票已截止</template>
          </span>
          <div class="sort-controls" role="group" aria-label="作品排序方式">
            <span class="sort-label">排序</span>
            <button
              v-for="option in sortOptions"
              :key="option.value"
              type="button"
              :class="{ active: sortKey === option.value }"
              :aria-pressed="sortKey === option.value"
              :aria-label="sortButtonLabel(option)"
              @click="setSort(option.value)"
            >
              <span>{{ option.label }}</span>
              <component
                :is="sortDirection === 'desc' ? ArrowDown : ArrowUp"
                v-if="sortKey === option.value"
                :size="13"
                :stroke-width="2.2"
                aria-hidden="true"
              />
            </button>
          </div>
        </div>

        <div v-if="loading" class="empty">加载中…</div>
        <div v-else-if="!works.length" class="empty">
          暂无已通过的作品，快去投出第一份吧！
        </div>
        <div v-else class="work-grid">
          <article v-for="w in sortedWorks" :key="w.id" class="work-card" @click="openWorkModal(w)">
            <div class="work-cover">
              <img :src="w.images[0]?.url" :alt="w.title" loading="lazy" />
              <span v-if="w.featured" class="featured-badge">优秀</span>
              <span v-if="w.winnerRank" class="winner-badge">{{ w.winnerLabel }}</span>
            </div>
            <div class="work-info">
              <b class="work-title">{{ w.title }}</b>
              <p>{{ w.description }}</p>
              <div class="work-actions">
                <span class="author-line">
                  <img :src="w.avatar || DEFAULT_AVATAR" :alt="`${w.username || '匿名同学'}的头像`" loading="lazy" />
                  {{ w.username || '匿名同学' }}
                </span>
                <button
                  class="vote-btn"
                  :class="{ voted: w.votedToday, closed }"
                  type="button"
                  @click.stop="toggleVote(w)"
                >
                  <Heart :size="15" aria-hidden="true" />
                  <span>{{ w.likeCount || 0 }}</span>
                </button>
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>

    <button
      class="publish-fab"
      :class="{ closed }"
      type="button"
      :aria-label="closed ? '投稿已截止' : `发布${currentCategoryName}作品`"
      @click="goSubmit(galleryFilter)"
    >
      <Plus :size="29" :stroke-width="2.5" aria-hidden="true" />
    </button>

    <!-- 作品介绍弹窗 -->
    <div v-if="modalWork" class="modal-mask" @click.self="modalWork = null">
      <div class="modal-card">
        <button class="modal-close" type="button" @click="modalWork = null">×</button>
        <div class="modal-images">
          <img
            v-if="modalImages.length"
            :src="modalImages[modalImageIndex]"
            :alt="modalWork.title"
          />
          <div v-if="modalImages.length > 1" class="modal-thumbs">
            <button
              v-for="(img, i) in modalImages"
              :key="i"
              type="button"
              :class="{ active: i === modalImageIndex }"
              @click="modalImageIndex = i"
            >
              <img :src="img" :alt="`图 ${i + 1}`" />
            </button>
          </div>
        </div>
        <div class="modal-body">
          <div class="modal-title-row">
            <b>{{ modalWork.title }}</b>
            <span v-if="modalWork.featured" class="featured-badge">优秀</span>
            <span v-if="modalWork.winnerRank" class="winner-badge">{{ modalWork.winnerLabel }}</span>
          </div>
          <p class="modal-desc">{{ modalWork.description }}</p>
          <div class="modal-meta">
            <span>{{ modalWork.categoryName }}</span>
            <span>{{ modalWork.locationName }}</span>
            <span>{{ modalWork.username }}</span>
            <span>{{ fmtTime(modalWork.createdAt) }}</span>
          </div>
          <button
            class="modal-vote"
            :class="{ voted: modalWork.votedToday, closed }"
            type="button"
            @click="toggleVote(modalWork)"
          >
            <Heart :size="16" aria-hidden="true" />
            {{ modalWork.votedToday ? '已投票（点击取消）' : '投我一票' }}
            · {{ modalWork.likeCount || 0 }}
          </button>
        </div>
      </div>
    </div>

    <!-- 页面提示 -->
    <Transition name="toast">
      <div v-if="toast" class="page-toast" role="status">{{ toast }}</div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { request } from '@/utils/request'
import { AWARD_CONFIG } from '@/data/awards'
import {
  ArrowDown,
  ArrowUp,
  Heart,
  Plus,
} from '@lucide/vue'

const router = useRouter()
const DEFAULT_AVATAR = 'https://img.yzcdn.cn/vant/user-active.png'
const meta = ref(null)
const works = ref([])
const galleryFilter = ref('creative')
const sortKey = ref('likes')
const sortDirection = ref('desc')
const loading = ref(true)
const quota = ref(null)
const modalWork = ref(null)
const modalImageIndex = ref(0)
const toast = ref('')
let toastTimer = 0

const categories = computed(() => meta.value?.categories || AWARD_CONFIG.categories)
const currentCategoryName = computed(() =>
  categories.value.find(category => category.id === galleryFilter.value)?.name || '作品展示'
)
const deadline = computed(() => meta.value?.deadline || AWARD_CONFIG.deadline)
const maxVotesPerDay = computed(() => meta.value?.maxVotesPerDay ?? AWARD_CONFIG.maxVotesPerDay)
const closed = computed(() => {
  if (!deadline.value) return false
  return Date.now() > new Date(deadline.value).getTime()
})
const loggedIn = computed(() => !!localStorage.getItem('token'))
const remainingVotes = computed(() =>
  quota.value != null ? quota.value.remaining : maxVotesPerDay.value
)
const modalImages = computed(() => (modalWork.value?.images || []).map(img => img.url).filter(Boolean))

const sortOptions = [
  { value: 'likes', label: '点赞量' },
  { value: 'createdAt', label: '发布时间' }
]

const sortedWorks = computed(() => {
  const direction = sortDirection.value === 'desc' ? -1 : 1
  return works.value.slice().sort((a, b) => {
    const aValue = sortKey.value === 'likes' ? Number(a.likeCount || 0) : Number(a.createdAt || 0)
    const bValue = sortKey.value === 'likes' ? Number(b.likeCount || 0) : Number(b.createdAt || 0)
    return (aValue - bValue) * direction
  })
})

function setSort(value) {
  if (sortKey.value === value) {
    sortDirection.value = sortDirection.value === 'desc' ? 'asc' : 'desc'
    return
  }
  sortKey.value = value
  sortDirection.value = 'desc'
}

function sortButtonLabel(option) {
  if (sortKey.value !== option.value) return `按${option.label}排序`
  const directionLabel = option.value === 'likes'
    ? (sortDirection.value === 'desc' ? '从高到低' : '从低到高')
    : (sortDirection.value === 'desc' ? '从新到旧' : '从旧到新')
  return `按${option.label}${directionLabel}排序，再次点击切换顺序`
}

function fmtTime(ts) {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
  } catch {
    return String(ts)
  }
}

function showToast(msg) {
  toast.value = msg
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toast.value = '' }, 3200)
}

async function loadMeta() {
  try {
    const res = await request('/submissions/meta', 'GET')
    if (res?.data?.code === 0) meta.value = res.data.data
  } catch {}
}

async function loadQuota() {
  if (!loggedIn.value) return
  try {
    const res = await request('/submissions/votes/quota', 'GET')
    if (res?.data?.code === 0) quota.value = res.data.data
  } catch {}
}

async function fetchWorks(params = {}) {
  const res = await request('/submissions', 'GET', { limit: 200, ...params })
  if (res?.data?.code === 0) return res.data.list || []
  return []
}

async function setGalleryFilter(value) {
  galleryFilter.value = value
  await reloadFiltered()
}

async function reloadFiltered() {
  loading.value = true
  try {
    const params = {}
    if (galleryFilter.value !== 'all') {
      params.category = galleryFilter.value
    }
    works.value = await fetchWorks(params)
  } catch {
    works.value = []
  } finally {
    loading.value = false
  }
}

async function toggleVote(work) {
  if (closed.value) {
    showToast('活动已截止，无法进行操作，请耐心期待最终结果公布')
    return
  }
  if (!loggedIn.value) {
    router.push({ path: '/signin', query: { redirect: '/award' } })
    return
  }
  try {
    const res = await request(`/submissions/${encodeURIComponent(work.id)}/vote`, 'POST', {
      action: work.votedToday ? 'unvote' : 'vote'
    })
    if (res?.data?.code === 0) {
      work.likeCount = res.data.likeCount
      work.votedToday = res.data.votedToday
      if (quota.value) {
        quota.value.usedToday = res.data.usedToday
        quota.value.remaining = res.data.remaining
      }
    } else if (res?.data?.code === 3) {
      showToast(res.data.message)
      await loadQuota()
    } else {
      showToast(res?.data?.message || '操作失败')
    }
  } catch {
    showToast('操作失败，请重试')
  }
}

function openWorkModal(work) {
  modalWork.value = work
  modalImageIndex.value = 0
}

function goSubmit(category) {
  if (closed.value) {
    showToast('活动已截止，无法进行操作，请耐心期待最终结果公布')
    return
  }
  router.push({ path: '/award/submit', query: { category } })
}

function goMine() {
  router.push('/award/my')
}

onMounted(() => {
  document.title = '打卡作品投稿 · 2026 迎新'
  loadMeta()
  reloadFiltered()
  loadQuota()
})
</script>

<style scoped>
.award-page {
  --award-ink: #0a2e3b;
  --award-primary: #0d9488;
  --award-accent: #c7f24a;
  --award-canvas: #f3f7f5;
  --award-surface: #fff;
  --award-text: #102a2e;
  --award-muted: #5e7271;
  --award-border: #d6e4df;
  min-height: 100vh;
  color: var(--award-text);
  background-color: var(--award-canvas);
  background-image:
    linear-gradient(rgba(10, 46, 59, .035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(10, 46, 59, .035) 1px, transparent 1px);
  background-size: 32px 32px;
  font-family: "Noto Sans SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
}
.award-header {
  padding: 20px clamp(16px, 4vw, 52px) 36px;
  border-top: 4px solid var(--award-ink);
  border-bottom: 1px solid var(--award-border);
  background: rgba(243, 247, 245, .92);
  color: var(--award-text);
}
.back-link {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  color: var(--award-muted);
  text-decoration: none;
  font-size: 13px;
  transition: color .2s ease;
}
.back-link:hover { color: var(--award-primary); }
.header-inner { max-width: 1120px; margin: 14px auto 0; }
.header-title { min-width: 0; }
.eyebrow {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0;
  color: var(--award-primary-dark, #08766d);
  font: 700 10px "SFMono-Regular", Menlo, Consolas, monospace;
  letter-spacing: .08em;
}
.eyebrow span { width: 18px; height: 3px; background: var(--award-accent); box-shadow: 8px 0 0 var(--award-ink); }
.award-header h1 {
  margin: 16px 0 0;
  color: var(--award-ink);
  font-family: "DIN Alternate", "Avenir Next", "Noto Sans SC", sans-serif;
  font-size: clamp(36px, 7vw, 68px);
  font-weight: 800;
  line-height: .98;
  letter-spacing: -.035em;
}
.header-summary { margin-top: 24px; }
.lede { margin: 0; max-width: 540px; color: var(--award-muted); font-size: 14px; line-height: 1.75; }
.deadline-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid #bfd0ca;
  border-radius: 999px;
  background: rgba(255,255,255,.72);
  color: var(--award-ink);
  font: 700 11px "SFMono-Regular", Menlo, Consolas, monospace;
}
.deadline-chip svg { color: var(--award-primary); }
.deadline-chip.closed { border-color: #d6ddda; color: var(--award-muted); }

.award-main { max-width: 1120px; margin: 0 auto; padding: 40px clamp(16px, 4vw, 52px) 90px; }
.section-heading { display: grid; gap: 8px; margin-bottom: 24px; }
.section-heading p { margin: 0; color: var(--award-primary-dark, #08766d); font: 700 10px "SFMono-Regular", Menlo, Consolas, monospace; letter-spacing: .06em; }
.section-heading h2 { margin: 0; color: var(--award-ink); font-size: clamp(22px, 4vw, 30px); line-height: 1.2; }
.category-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 16px 0 0;
  border-top: 1px solid var(--award-ink);
}
.category-tab {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  border: 1px solid var(--award-border);
  border-radius: 999px;
  background: rgba(255,255,255,.7);
  color: var(--award-muted);
  font-family: "SFMono-Regular", Menlo, Consolas, "Noto Sans SC", monospace;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .04em;
  cursor: pointer;
  transition: background .2s ease, color .2s ease, border-color .2s ease;
}
.category-tab:hover:not(.active) { border-color: var(--award-primary); color: var(--award-primary-dark, #08766d); }
.category-tab.active { border-color: var(--award-ink); background: var(--award-ink); color: #fff; }
.category-tab.active svg { color: var(--award-accent); }
.category-card { position: relative; padding: 24px 0 28px; border-bottom: 1px solid var(--award-border); }
.cat-fade-enter-active, .cat-fade-leave-active { transition: opacity .18s ease, transform .18s ease; }
.cat-fade-enter-from { opacity: 0; transform: translateY(10px); }
.cat-fade-leave-to { opacity: 0; transform: translateY(-6px); }
.category-topline { display: flex; align-items: center; gap: 10px; }
.category-index, .category-code { color: var(--award-primary-dark, #08766d); font: 700 10px "SFMono-Regular", Menlo, Consolas, monospace; letter-spacing: .08em; }
.category-index { color: var(--award-ink); font-size: 12px; }
.category-rule { height: 1px; flex: 1; background: var(--award-border); }
.category-title-row { display: flex; align-items: center; gap: 14px; margin-top: 22px; }
.cat-icon {
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  display: grid;
  place-items: center;
  border: 1px solid var(--award-border);
  border-radius: 14px 5px 14px 5px;
  background: var(--award-surface);
  color: var(--award-primary-dark, #08766d);
}
.category-title-row p { margin: 0 0 3px; color: var(--award-muted); font-size: 11px; }
.category-title-row h3 { margin: 0; color: var(--award-ink); font-size: 24px; line-height: 1.2; }
.cat-tagline { margin: 20px 0 0; color: var(--award-ink); font-size: 15px; font-weight: 700; line-height: 1.6; }
.cat-welcome { margin: 8px 0 0; color: var(--award-muted); font-size: 13px; line-height: 1.75; }
.req-list { display: grid; gap: 9px; margin: 20px 0 22px; padding: 16px 0 0; border-top: 1px dashed var(--award-border); list-style: none; }
.req-list li { display: flex; align-items: flex-start; gap: 9px; color: #405a5c; font-size: 12px; line-height: 1.55; }
.req-list li svg { flex: 0 0 auto; margin-top: 2px; color: var(--award-primary); }
.submit-btn {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 0 18px;
  border: 1px solid var(--award-accent);
  border-radius: 999px;
  background: var(--award-accent);
  color: var(--award-ink);
  font-weight: 800;
  font-size: 13px;
  cursor: pointer;
  transition: transform .2s cubic-bezier(.16, 1, .3, 1), background .2s ease;
}
.submit-btn:hover { transform: translateY(-2px); background: #d3fa61; }
.submit-btn:active { transform: scale(.99); }
.submit-btn.closed { border-color: var(--award-border); background: transparent; color: var(--award-muted); cursor: pointer; }

.activity-note { margin-top: 28px; padding: 18px 0 0 18px; border-top: 1px solid var(--award-border); border-left: 3px solid var(--award-accent); }
.activity-note p { margin: 0; max-width: 900px; color: var(--award-muted); font-size: 13px; line-height: 1.8; }

.rules-panel { margin-top: 40px; padding: 24px 0; border-top: 1px solid var(--award-ink); border-bottom: 1px solid var(--award-border); }
.rules-panel h2, .featured-section h2, .gallery-head h2 { margin: 0; color: var(--award-ink); font-size: 20px; }
.featured-section h2 { display: flex; align-items: center; gap: 8px; }
.featured-section h2 svg { color: var(--award-primary); }
.rules-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin: 18px 0 12px; }
.rule-item { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; border: 1px solid var(--award-border); border-radius: 12px; background: rgba(255,255,255,.55); }
.rule-item b { font-size: 18px; color: #0d9488; }
.rule-item span { color: #5f6d66; font-size: 12px; }
.vote-rule, .winner-rule { display: flex; align-items: flex-start; gap: 9px; color: #405a5c; font-size: 13px; line-height: 1.65; }
.vote-rule { margin-bottom: 10px; }
.winner-rule { margin: 0 0 12px; }
.vote-rule svg, .winner-rule svg { flex: 0 0 auto; margin-top: 2px; color: var(--award-primary); }
.vote-rule b, .winner-rule b { color: var(--award-ink); }
.rules-note { margin: 0 0 14px; color: #7b857f; font-size: 12px; line-height: 1.7; }
.ceremony-line { display: flex; align-items: center; gap: 8px; margin: 0 0 14px; color: var(--award-ink); font-size: 13px; font-weight: 700; }
.ceremony-line svg { color: var(--award-primary); }
.ghost-btn { border: 1px solid #0d9488; background: transparent; color: #0d9488; padding: 9px 16px; border-radius: 999px; font-size: 13px; cursor: pointer; }

.featured-section { margin-top: 40px; }
.featured-track { display: flex; gap: 12px; overflow-x: auto; padding: 8px 2px 14px; scroll-snap-type: x mandatory; }
.featured-card { flex: 0 0 240px; margin: 0; border-radius: 14px; overflow: hidden; background: #fff; border: 1px solid #e8e4da; scroll-snap-align: start; cursor: zoom-in; }
.featured-card img { width: 240px; height: 160px; object-fit: cover; display: block; }
.featured-card figcaption { display: grid; gap: 4px; padding: 10px 12px; }
.featured-card b { font-size: 13px; color: #17231e; }
.featured-card span { font-size: 11px; color: #7b857f; }

.gallery-section { margin-top: 40px; }
.gallery-head { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.gallery-head h2 { margin-right: auto; }
.filter-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.filter-chips button { border: 1px solid #d8d4c9; background: #fff; color: #49584f; padding: 7px 14px; border-radius: 999px; font-size: 12px; cursor: pointer; }
.filter-chips button.active { background: #102a2e; border-color: #102a2e; color: #fff; }
.sort-controls { display: inline-flex; align-items: center; gap: 4px; padding: 4px; border: 1px solid #d8d4c9; border-radius: 999px; background: rgba(255,255,255,.72); }
.sort-label { padding-left: 8px; color: #87918b; font-size: 11px; }
.sort-controls button { display: inline-flex; align-items: center; gap: 4px; min-height: 28px; border: 0; border-radius: 999px; padding: 5px 9px; background: transparent; color: #526159; font-size: 11px; cursor: pointer; transition: color .16s ease, background-color .16s ease; }
.sort-controls button:hover { color: var(--award-primary); }
.sort-controls button.active { background: #e7f3ef; color: #0b7568; font-weight: 700; }
.quota-chip { padding: 7px 14px; border-radius: 999px; background: #eef7f3; border: 1px solid #cfe6dc; color: #0d6e5f; font-size: 12px; }
.quota-chip b { font-size: 14px; }
.quota-chip.ended { background: #eef2f7; border-color: #dbe2ea; color: #64748b; }
.results-link { display: inline-flex; align-items: center; gap: 6px; border: 1px solid #bfd0ca; background: rgba(255,255,255,.7); color: var(--award-ink); padding: 8px 15px; border-radius: 999px; font-size: 13px; cursor: pointer; }

.work-grid { display: grid; grid-template-columns: 1fr; gap: 16px; margin-top: 20px; }
.work-card { overflow: hidden; border-radius: 16px; background: #fff; border: 1px solid #e8e4da; cursor: zoom-in; transition: transform .18s ease, box-shadow .18s ease; }
.work-card:hover { transform: translateY(-3px); box-shadow: 0 16px 38px rgba(23,35,30,.1); }
.work-card img { width: 100%; height: 210px; object-fit: cover; display: block; }
.work-info { padding: 14px 16px 16px; }
.work-title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.work-title-row b { font-size: 15px; color: #17231e; }
.featured-badge { padding: 2px 8px; border-radius: 999px; background: #fff1d6; color: #a16207; font-size: 11px; }
.winner-badge { padding: 2px 8px; border-radius: 999px; background: #fdece8; color: #c2410c; font-size: 11px; }
.work-info p { margin: 8px 0; color: #5f6d66; font-size: 13px; line-height: 1.65; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.work-meta { display: flex; flex-wrap: wrap; gap: 8px; }
.work-meta span { font-size: 11px; color: #8a958f; background: #f3f1ea; padding: 3px 9px; border-radius: 999px; }
.work-actions { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 12px; }
.intro-btn { border: 1px solid #d8d4c9; background: #fff; color: #49584f; padding: 7px 14px; border-radius: 999px; font-size: 12px; cursor: pointer; }
.intro-btn:hover { border-color: #0d9488; color: #0d9488; }
.vote-btn { display: inline-flex; align-items: center; gap: 6px; border: 1px solid #e2d3d3; background: #fff; color: #7b6a6a; padding: 7px 14px; border-radius: 999px; font-size: 12px; cursor: pointer; }
.vote-btn.voted { border-color: #ef6a6a; background: #fff1f1; color: #d43a3a; }
.vote-btn.closed { opacity: .6; cursor: pointer; }

.empty { padding: 42px 0; text-align: center; color: #8a958f; font-size: 14px; }
.page-toast { position: fixed; left: 50%; bottom: 30px; z-index: 120; transform: translateX(-50%); max-width: calc(100% - 32px); padding: 11px 18px; border-radius: 999px; background: rgba(17,35,30,.92); color: #fff; font-size: 13px; text-align: center; box-shadow: 0 12px 32px rgba(0,0,0,.22); }
.toast-enter-active, .toast-leave-active { transition: opacity .2s ease, transform .2s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 10px); }

.modal-mask { position: fixed; inset: 0; z-index: 90; display: grid; place-items: center; padding: 20px; background: rgba(8,18,15,.78); }
.modal-card { width: min(720px, 100%); max-height: 92vh; overflow: auto; position: relative; border-radius: 18px; background: #fff; display: grid; grid-template-columns: 1fr; }
.modal-close { position: absolute; z-index: 2; top: 12px; right: 14px; width: 38px; height: 38px; border: 0; border-radius: 50%; background: rgba(0,0,0,.42); color: #fff; font-size: 22px; cursor: pointer; }
.modal-images img { width: 100%; height: 320px; object-fit: cover; display: block; }
.modal-thumbs { display: flex; gap: 8px; padding: 10px 14px; }
.modal-thumbs button { border: 2px solid transparent; border-radius: 8px; overflow: hidden; padding: 0; background: #f1efe8; cursor: pointer; }
.modal-thumbs button.active { border-color: #0d9488; }
.modal-thumbs img { width: 64px; height: 48px; object-fit: cover; display: block; }
.modal-body { padding: 6px 20px 22px; }
.modal-title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.modal-title-row b { font-size: 19px; color: #17231e; }
.modal-desc { margin: 12px 0; color: #3f4d45; font-size: 14px; line-height: 1.8; white-space: pre-wrap; }
.modal-meta { display: flex; flex-wrap: wrap; gap: 8px; }
.modal-meta span { font-size: 11px; color: #8a958f; background: #f3f1ea; padding: 3px 9px; border-radius: 999px; }
.modal-vote { margin-top: 18px; display: inline-flex; align-items: center; gap: 7px; border: 1px solid #ef6a6a; background: #fff1f1; color: #d43a3a; padding: 10px 20px; border-radius: 999px; font-size: 14px; font-weight: 700; cursor: pointer; }
.modal-vote:not(.voted) { border-color: #0d9488; background: #0d9488; color: #fff; }
.modal-vote.closed { opacity: .6; cursor: pointer; }

.back-link:focus-visible,
.submit-btn:focus-visible,
.ghost-btn:focus-visible,
.results-link:focus-visible,
.filter-chips button:focus-visible,
.sort-controls button:focus-visible,
.category-tab:focus-visible,
.intro-btn:focus-visible,
.vote-btn:focus-visible {
  outline: 3px solid var(--award-accent);
  outline-offset: 3px;
  box-shadow: 0 0 0 1px var(--award-ink);
}

@media (min-width: 720px) {
  .header-inner { display: grid; grid-template-columns: 1.2fr .8fr; gap: 48px; align-items: end; }
  .header-summary { margin-top: 0; padding-bottom: 4px; }
  .rules-grid { grid-template-columns: repeat(4, 1fr); }
  .work-grid { grid-template-columns: repeat(2, 1fr); }
  .modal-card { grid-template-columns: 1.1fr 1fr; }
  .modal-images img { height: 100%; min-height: 380px; }
  .modal-thumbs { padding: 10px; }
}
@media (min-width: 1024px) {
  .work-grid { grid-template-columns: repeat(3, 1fr); }
  .work-card img { height: 230px; }
}

@media (prefers-reduced-motion: reduce) {
  .back-link, .submit-btn, .work-card, .category-tab,
  .toast-enter-active, .toast-leave-active,
  .cat-fade-enter-active, .cat-fade-leave-active { transition: none; }
  .submit-btn:hover, .work-card:hover { transform: none; }
  .cat-fade-enter-from, .cat-fade-leave-to { transform: none; }
}

/* Discovery-first gallery: compact, image-led and mobile friendly. */
.award-page {
  --award-accent: #0d9488;
  --award-canvas: #f8faf9;
  padding-bottom: 24px;
  background-image: none;
}
.discovery-header {
  position: sticky;
  top: 0;
  z-index: 40;
  border-bottom: 1px solid rgba(10,46,59,.09);
  background: rgba(248,250,249,.94);
  backdrop-filter: blur(18px) saturate(1.35);
}
.topbar {
  display: grid;
  grid-template-columns: 44px 1fr auto;
  align-items: center;
  max-width: 1120px;
  min-height: 64px;
  margin: 0 auto;
  padding: 0 clamp(12px, 4vw, 52px);
}
.back-link {
  width: 40px;
  min-height: 40px;
  justify-content: center;
  color: var(--award-ink);
  font-size: 30px;
  line-height: 1;
}
.brand-title { min-width: 0; text-align: center; }
.brand-title span { display: block; color: #89938e; font: 700 9px "SFMono-Regular", Menlo, monospace; letter-spacing: .12em; }
.brand-title h1 { margin: 2px 0 0; color: var(--award-ink); font-size: 20px; line-height: 1.2; letter-spacing: -.02em; }
.mine-link { border: 0; background: transparent; color: #526159; padding: 9px 0 9px 10px; font-size: 12px; font-weight: 700; cursor: pointer; }
.award-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  max-width: 560px;
  margin: 0 auto;
  padding: 0 16px;
}
.award-tabs button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 48px;
  border: 0;
  background: transparent;
  color: #7a8580;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}
.award-tabs button::after { content: ""; position: absolute; left: 24%; right: 24%; bottom: 0; height: 3px; border-radius: 3px; background: transparent; transform: scaleX(.5); transition: background .18s ease, transform .18s ease; }
.award-tabs button.active { color: var(--award-ink); }
.award-tabs button.active::after { background: var(--award-accent); transform: scaleX(1); }
.award-main { max-width: 1120px; margin: 0 auto; padding: 22px clamp(10px, 3vw, 40px) 88px; }
.gallery-section { margin-top: 0; }
.gallery-head { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 12px; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.gallery-head > div:first-child { min-width: 0; }
.gallery-kicker { margin: 0 0 3px; color: #9aa39e; font: 700 9px "SFMono-Regular", Menlo, monospace; letter-spacing: .12em; }
.gallery-head h2 { font-size: 20px; }
.sort-controls { justify-self: end; border-color: #e2e8e5; background: #fff; box-shadow: 0 4px 16px rgba(10,46,59,.04); }
.sort-controls button.active { background: #edf5f2; color: #08766d; }
.quota-chip { grid-column: 1; width: max-content; margin-top: 2px; padding: 5px 10px; }
.results-link { grid-column: 2; grid-row: 2; justify-self: end; padding: 6px 10px; border: 0; background: transparent; color: #66736d; font-size: 11px; }
.work-grid { display: block; column-count: 2; column-gap: 10px; margin-top: 16px; }
.work-card { display: inline-block; width: 100%; margin: 0 0 10px; break-inside: avoid; border: 0; border-radius: 10px; box-shadow: 0 2px 12px rgba(18,43,35,.07); vertical-align: top; }
.work-card:hover { transform: translateY(-2px); box-shadow: 0 10px 26px rgba(23,35,30,.11); }
.work-cover { position: relative; overflow: hidden; border-radius: 10px 10px 0 0; background: #e9efec; }
.work-card img { width: 100%; height: auto; min-height: 145px; max-height: 340px; object-fit: cover; }
.work-cover .featured-badge, .work-cover .winner-badge { position: absolute; top: 8px; left: 8px; backdrop-filter: blur(8px); }
.work-cover .winner-badge { left: auto; right: 8px; }
.work-info { padding: 10px 10px 11px; }
.work-title { display: block; color: #18231e; font-size: 14px; line-height: 1.45; }
.work-info p { margin: 5px 0 9px; font-size: 11px; line-height: 1.55; -webkit-line-clamp: 2; }
.work-actions { margin-top: 0; }
.author-line { display: inline-flex; min-width: 0; align-items: center; gap: 6px; overflow: hidden; color: #7a8580; font-size: 10px; white-space: nowrap; text-overflow: ellipsis; }
.work-card .author-line img { display: block; width: 23px; height: 23px; min-height: 0; flex: 0 0 23px; border-radius: 50%; background: #e8f1ed; object-fit: cover; }
.vote-btn { flex: 0 0 auto; gap: 4px; border: 0; padding: 5px 2px 5px 7px; background: transparent; }
.vote-btn.voted { border: 0; background: transparent; color: var(--award-accent); }
.publish-fab {
  position: fixed;
  right: max(20px, calc((100vw - 1120px) / 2 + 24px));
  bottom: calc(24px + env(safe-area-inset-bottom));
  z-index: 55;
  display: grid;
  width: 58px;
  height: 58px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: var(--award-primary);
  color: #fff;
  box-shadow: 0 10px 28px rgba(13,148,136,.3);
  cursor: pointer;
  transition: transform .18s cubic-bezier(.2,.8,.2,1), box-shadow .18s ease;
}
.publish-fab:hover { transform: translateY(-3px) scale(1.03); box-shadow: 0 14px 34px rgba(13,148,136,.38); }
.publish-fab:active { transform: scale(.95); }
.publish-fab.closed { background: #9aa39e; box-shadow: 0 8px 20px rgba(60,74,67,.2); }
.award-tabs button:focus-visible, .mine-link:focus-visible, .publish-fab:focus-visible { outline: 3px solid var(--award-accent); outline-offset: 3px; }

@media (min-width: 720px) {
  .work-grid { column-count: 3; column-gap: 16px; }
  .work-card { margin-bottom: 16px; }
  .work-info { padding: 13px 14px 14px; }
  .work-title { font-size: 15px; }
  .work-info p { font-size: 12px; }
}
@media (min-width: 1080px) {
  .work-grid { column-count: 4; }
}
@media (max-width: 420px) {
  .sort-label { display: none; }
  .sort-controls { gap: 0; }
  .sort-controls button { padding-inline: 7px; }
  .gallery-head { gap: 10px 6px; }
}
</style>
