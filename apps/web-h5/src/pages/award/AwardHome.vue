<template>
  <div class="award-page">
    <header class="award-header">
      <a class="back-link" href="#/" @click.prevent="router.push('/')">‹ 返回首页</a>
      <div class="header-inner">
        <p class="eyebrow">SYSU ISE · 2026 WELCOME</p>
        <h1>打卡作品投稿</h1>
        <p class="lede">
          用一张照片或一个创意，记录你眼中的校园。<br />
          最佳创意奖与最佳摄影奖，等你来投。
        </p>
        <div class="deadline-chip" :class="{ closed }">
          <span v-if="!closed">投稿截止：{{ deadlineText }}</span>
          <span v-else>投稿已截止</span>
        </div>
      </div>
    </header>

    <main class="award-main">
      <!-- 两个奖项入口 -->
      <section class="category-grid" aria-label="投稿类别">
        <article
          v-for="cat in categories"
          :key="cat.id"
          class="category-card"
          :style="{ '--cat-color': cat.color }"
        >
          <div class="cat-icon" aria-hidden="true">{{ cat.icon }}</div>
          <h2>{{ cat.name }}</h2>
          <p class="cat-welcome">{{ cat.welcome || cat.description }}</p>
          <p>{{ cat.description }}</p>
          <ul class="req-list">
            <li v-for="(r, i) in cat.requirements" :key="i">{{ r }}</li>
          </ul>
          <button class="submit-btn" :class="{ closed }" type="button" @click="goSubmit(cat.id)">
            {{ closed ? '已截止' : '立即投稿' }}
          </button>
        </article>
      </section>

      <!-- 活动说明 -->
      <section class="activity-note">
        <p>
          请在投稿前认真阅读投稿须知，填写好作品名字、介绍、和打卡地点等内容。我们在审核通过后会将投稿作品展出，大家也可以为自己喜欢的作品投票（每人每天三票，最多每天给一个作品投一票）。我们将会在2026年9月16日23:59截止投稿、点赞等相关活动，并在2026年9月19日的迎新晚会后颁奖。
        </p>
      </section>

      <!-- 投稿规则 -->
      <section class="rules-panel" aria-labelledby="rules-title">
        <h2 id="rules-title">投稿须知</h2>
        <div class="rules-grid">
          <div class="rule-item">
            <b>{{ perUserPerCategory }}</b>
            <span>每人每项限投 {{ perUserPerCategory }} 份</span>
          </div>
          <div class="rule-item">
            <b>{{ maxImagesPerWork }}</b>
            <span>每份作品限 {{ maxImagesPerWork }} 张图片</span>
          </div>
          <div class="rule-item">
            <b>{{ maxImageMB }}MB</b>
            <span>单张图片不超过 {{ maxImageMB }}MB</span>
          </div>
          <div class="rule-item">
            <b>JPG / PNG</b>
            <span>支持 JPG、PNG、WebP、GIF 格式</span>
          </div>
        </div>
        <div class="vote-rule">
          🗳️ 每人每天最多投 <b>{{ maxVotesPerDay }}</b> 票，同一作品每天限 1 票，次日可重新投票。
        </div>
        <p class="winner-rule">
          🏅 获奖规则：活动截止后按票数自动评选——最佳创意奖前 <b>{{ winnerCounts.creative }}</b> 名、最佳摄影奖前 <b>{{ winnerCounts.photography }}</b> 名获奖。
        </p>
        <p class="rules-note">
          投稿作品经管理员审核通过后将在下方展示；优秀作品将被选在首行特别展出。
        </p>
        <p class="ceremony-line">🏆 颁奖时间：{{ ceremonyText }}</p>
        <button class="ghost-btn" type="button" @click="goMine">查看我的投稿 →</button>
      </section>

      <!-- 优秀作品轮播 -->
      <section v-if="featured.length" class="featured-section" aria-labelledby="featured-title">
        <h2 id="featured-title">🌟 优秀作品</h2>
        <div class="featured-track">
          <figure v-for="w in featured" :key="w.id" class="featured-card" @click="openWorkModal(w)">
            <img :src="w.images[0]?.url" :alt="w.title" loading="lazy" />
            <figcaption>
              <b>{{ w.title }}</b>
              <span>{{ w.categoryName }} · {{ w.username }}</span>
            </figcaption>
          </figure>
        </div>
      </section>

      <!-- 作品展示 / 人气排行 -->
      <section class="gallery-section" aria-labelledby="gallery-title">
        <div class="gallery-head">
          <h2 id="gallery-title">{{ galleryFilter === 'rank' ? '人气排行' : '作品展示' }}</h2>
          <div class="filter-chips">
            <button
              v-for="f in galleryFilters"
              :key="f.value"
              type="button"
              :class="{ active: galleryFilter === f.value }"
              @click="setGalleryFilter(f.value)"
            >{{ f.label }}</button>
          </div>
          <span v-if="loggedIn" class="quota-chip" :class="{ ended: closed }">
            <template v-if="!closed">今日剩余 <b>{{ remainingVotes }}</b> 票</template>
            <template v-else>投票已截止</template>
          </span>
          <button class="results-link" type="button" @click="goResults">🏆 获奖结果公示</button>
        </div>

        <div v-if="loading" class="empty">加载中…</div>
        <div v-else-if="!works.length" class="empty">
          暂无已通过的作品，快去投出第一份吧！
        </div>
        <div v-else class="work-grid">
          <article v-for="w in works" :key="w.id" class="work-card" @click="openWorkModal(w)">
            <img :src="w.images[0]?.url" :alt="w.title" loading="lazy" />
            <div class="work-info">
              <div class="work-title-row">
                <b>{{ w.title }}</b>
                <span v-if="w.featured" class="featured-badge">优秀</span>
                <span v-if="w.winnerRank" class="winner-badge">{{ w.winnerLabel }}</span>
              </div>
              <p>{{ w.description }}</p>
              <div class="work-meta">
                <span>{{ w.categoryName }}</span>
                <span>{{ w.locationName }}</span>
                <span>{{ w.username }}</span>
              </div>
              <div class="work-actions">
                <button class="intro-btn" type="button" @click.stop="openWorkModal(w)">查看作品介绍</button>
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
import { Heart } from '@lucide/vue'

const router = useRouter()
const meta = ref(null)
const works = ref([])
const featured = ref([])
const galleryFilter = ref('all')
const loading = ref(true)
const quota = ref(null)
const modalWork = ref(null)
const modalImageIndex = ref(0)
const toast = ref('')
let toastTimer = 0

const categories = computed(() => meta.value?.categories || AWARD_CONFIG.categories)
const deadline = computed(() => meta.value?.deadline || AWARD_CONFIG.deadline)
const perUserPerCategory = computed(() => meta.value?.perUserPerCategory ?? AWARD_CONFIG.perUserPerCategory)
const maxImagesPerWork = computed(() => meta.value?.maxImagesPerWork ?? AWARD_CONFIG.maxImagesPerWork)
const maxImageMB = computed(() => meta.value?.maxImageMB ?? AWARD_CONFIG.maxImageMB)
const maxVotesPerDay = computed(() => meta.value?.maxVotesPerDay ?? AWARD_CONFIG.maxVotesPerDay)
const winnerCounts = computed(() => meta.value?.winnerCounts || AWARD_CONFIG.winnerCounts || { creative: 5, photography: 2 })
const closed = computed(() => {
  if (!deadline.value) return false
  return Date.now() > new Date(deadline.value).getTime()
})
const deadlineText = computed(() => {
  try {
    return new Date(deadline.value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
  } catch {
    return deadline.value
  }
})
const ceremonyText = computed(() => meta.value?.awardCeremony || AWARD_CONFIG.awardCeremony || '待定')
const loggedIn = computed(() => !!localStorage.getItem('token'))
const remainingVotes = computed(() =>
  quota.value != null ? quota.value.remaining : maxVotesPerDay.value
)
const modalImages = computed(() => (modalWork.value?.images || []).map(img => img.url).filter(Boolean))

const galleryFilters = computed(() => [
  { value: 'all', label: '全部' },
  ...categories.value.map(c => ({ value: c.id, label: c.name })),
  { value: 'rank', label: '人气排行' }
])

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

async function loadWorks() {
  loading.value = true
  try {
    works.value = await fetchWorks()
    featured.value = works.value.filter(w => w.featured).slice(0, 10)
  } catch {
    works.value = []
  } finally {
    loading.value = false
  }
}

async function setGalleryFilter(value) {
  galleryFilter.value = value
  await reloadFiltered()
}

async function reloadFiltered() {
  loading.value = true
  try {
    const params = {}
    if (galleryFilter.value !== 'all' && galleryFilter.value !== 'rank') {
      params.category = galleryFilter.value
    }
    let list = await fetchWorks(params)
    if (galleryFilter.value === 'rank') {
      list = list.slice().sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0))
    }
    works.value = list
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

function goResults() {
  router.push('/award/results')
}

onMounted(() => {
  document.title = '打卡作品投稿 · 2026 迎新'
  loadMeta()
  loadWorks()
  loadQuota()
})
</script>

<style scoped>
.award-page { min-height: 100vh; color: #17231e; background: #f6f4ef; font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif; }
.award-header { padding: 34px clamp(16px, 4vw, 52px) 30px; background: #102a2e; color: #fff; }
.back-link { display: inline-block; margin-bottom: 18px; color: rgba(255,255,255,.7); text-decoration: none; font-size: 13px; }
.header-inner { max-width: 1120px; margin: 0 auto; }
.eyebrow { margin: 0; color: #c7f24a; font: 600 11px "SFMono-Regular", Menlo, monospace; letter-spacing: .14em; }
.award-header h1 { margin: 14px 0 10px; font-size: clamp(34px, 6vw, 58px); line-height: 1.05; letter-spacing: 0; }
.lede { margin: 0; color: rgba(255,255,255,.72); font-size: 15px; line-height: 1.8; }
.deadline-chip { display: inline-block; margin-top: 18px; padding: 7px 14px; border-radius: 999px; background: rgba(199,242,74,.14); color: #d8ff6a; font-size: 13px; }
.deadline-chip.closed { background: rgba(255,255,255,.1); color: rgba(255,255,255,.75); }

.award-main { max-width: 1120px; margin: 0 auto; padding: 34px clamp(16px, 4vw, 52px) 90px; }
.category-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
.category-card { position: relative; overflow: hidden; padding: 26px; border-radius: 20px; border: 1px solid #e2e0d8; background: #fff; box-shadow: 0 14px 34px rgba(23,35,30,.06); }
.category-card::before { content: ""; position: absolute; inset: 0; opacity: .08; background: radial-gradient(circle at 85% 12%, var(--cat-color), transparent 46%); }
.cat-icon { width: 52px; height: 52px; display: grid; place-items: center; border-radius: 15px 5px 15px 5px; background: var(--cat-color); color: #fff; font-size: 24px; }
.category-card h2 { margin: 18px 0 8px; font-size: 24px; color: #17231e; }
.cat-welcome { margin: 0 0 10px; color: #3f4d45; font-size: 14px; line-height: 1.85; }
.category-card > p { margin: 0; color: #5f6d66; font-size: 14px; line-height: 1.7; }
.req-list { margin: 16px 0 22px; padding: 0; list-style: none; }
.req-list li { position: relative; padding-left: 18px; color: #49584f; font-size: 13px; line-height: 2; }
.req-list li::before { content: "•"; position: absolute; left: 4px; color: var(--cat-color); font-weight: 800; }
.submit-btn { min-height: 46px; padding: 0 22px; border: 0; border-radius: 999px; background: var(--cat-color); color: #fff; font-weight: 800; font-size: 14px; cursor: pointer; }
.submit-btn.closed { background: #c9cdca; cursor: pointer; }

.activity-note { margin-top: 18px; padding: 18px 22px; border-radius: 14px; background: #fffaf2; border: 1px solid #f0d9a8; }
.activity-note p { margin: 0; color: #6b5628; font-size: 14px; line-height: 1.9; }

.rules-panel { margin-top: 34px; padding: 24px; border-radius: 18px; background: #fff; border: 1px dashed #d8d4c9; }
.rules-panel h2, .featured-section h2, .gallery-head h2 { margin: 0; font-size: 20px; }
.rules-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin: 18px 0 12px; }
.rule-item { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; border-radius: 12px; background: #f5f3ec; }
.rule-item b { font-size: 18px; color: #0d9488; }
.rule-item span { color: #5f6d66; font-size: 12px; }
.vote-rule { margin-bottom: 12px; padding: 10px 14px; border-radius: 12px; background: #fff7e6; color: #7a5200; font-size: 13px; }
.vote-rule b { color: #b45309; }
.winner-rule { margin: 0 0 12px; padding: 10px 14px; border-radius: 12px; background: #f4f0fa; color: #5b3a8f; font-size: 13px; }
.winner-rule b { color: #6d28d9; }
.rules-note { margin: 0 0 14px; color: #7b857f; font-size: 12px; line-height: 1.7; }
.ceremony-line { margin: 0 0 14px; color: #9a6200; font-size: 13px; font-weight: 700; }
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
.quota-chip { padding: 7px 14px; border-radius: 999px; background: #eef7f3; border: 1px solid #cfe6dc; color: #0d6e5f; font-size: 12px; }
.quota-chip b { font-size: 14px; }
.quota-chip.ended { background: #eef2f7; border-color: #dbe2ea; color: #64748b; }
.results-link { border: 1px solid #e2b36b; background: #fffaf2; color: #9a6200; padding: 8px 15px; border-radius: 999px; font-size: 13px; cursor: pointer; }

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

@media (min-width: 720px) {
  .rules-grid { grid-template-columns: repeat(4, 1fr); }
  .work-grid { grid-template-columns: repeat(2, 1fr); }
  .modal-card { grid-template-columns: 1.1fr 1fr; }
  .modal-images img { height: 100%; min-height: 380px; }
  .modal-thumbs { padding: 10px; }
}
@media (min-width: 1024px) {
  .category-grid { grid-template-columns: repeat(2, 1fr); }
  .work-grid { grid-template-columns: repeat(3, 1fr); }
  .work-card img { height: 230px; }
}
</style>
