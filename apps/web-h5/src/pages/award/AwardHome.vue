<template>
  <div class="award-page">
    <header class="award-header">
      <a class="back-link" href="#/" @click.prevent="router.push('/')">‹ 返回首页</a>
      <div class="header-inner">
        <p class="eyebrow">SYSU ISE · 2026 WELCOME</p>
        <h1>奖项投稿</h1>
        <p class="lede">
          用一张照片或一个创意，记录你眼中的校园。<br />
          最佳创意奖与最佳摄影奖，等你来投。
        </p>
        <div class="deadline-chip" :class="{ closed: closed }">
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
          <p>{{ cat.description }}</p>
          <ul class="req-list">
            <li v-for="(r, i) in cat.requirements" :key="i">{{ r }}</li>
          </ul>
          <button class="submit-btn" type="button" @click="goSubmit(cat.id)" :disabled="closed">
            {{ closed ? '已截止' : '立即投稿' }}
          </button>
        </article>
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
            <span>每份作品最多 {{ maxImagesPerWork }} 张图片</span>
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
        <p class="rules-note">
          投稿作品经管理员审核通过后将在下方展示；优秀作品将获得特别标注。
        </p>
        <button class="ghost-btn" type="button" @click="goMine">查看我的投稿 →</button>
      </section>

      <!-- 优秀作品轮播 -->
      <section v-if="featured.length" class="featured-section" aria-labelledby="featured-title">
        <h2 id="featured-title">🌟 优秀作品</h2>
        <div class="featured-track">
          <figure v-for="w in featured" :key="w.id" class="featured-card" @click="openImage(w)">
            <img :src="w.images[0]?.url" :alt="w.title" loading="lazy" />
            <figcaption>
              <b>{{ w.title }}</b>
              <span>{{ w.categoryName }} · {{ w.username }}</span>
            </figcaption>
          </figure>
        </div>
      </section>

      <!-- 作品展示区 -->
      <section class="gallery-section" aria-labelledby="gallery-title">
        <div class="gallery-head">
          <h2 id="gallery-title">作品展示</h2>
          <div class="filter-chips">
            <button
              v-for="f in galleryFilters"
              :key="f.value"
              type="button"
              :class="{ active: galleryFilter === f.value }"
              @click="setGalleryFilter(f.value)"
            >{{ f.label }}</button>
          </div>
        </div>

        <div v-if="loading" class="empty">加载中…</div>
        <div v-else-if="!works.length" class="empty">
          暂无已通过的作品，快去投出第一份吧！
        </div>
        <div v-else class="work-grid">
          <article v-for="w in works" :key="w.id" class="work-card" @click="openImage(w)">
            <img :src="w.images[0]?.url" :alt="w.title" loading="lazy" />
            <div class="work-info">
              <div class="work-title-row">
                <b>{{ w.title }}</b>
                <span v-if="w.featured" class="featured-badge">优秀</span>
              </div>
              <p>{{ w.description }}</p>
              <div class="work-meta">
                <span>{{ w.categoryName }}</span>
                <span>{{ w.locationName }}</span>
                <span>{{ w.username }}</span>
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>

    <!-- 图片预览 -->
    <div v-if="previewUrl" class="preview-mask" @click.self="previewUrl = ''">
      <img :src="previewUrl" alt="作品大图" />
      <button type="button" @click="previewUrl = ''">关闭</button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { request } from '@/utils/request'
import { AWARD_CONFIG } from '@/data/awards'

const router = useRouter()
const meta = ref(null)
const works = ref([])
const featured = ref([])
const galleryFilter = ref('all')
const loading = ref(true)
const previewUrl = ref('')

const categories = computed(() => meta.value?.categories || AWARD_CONFIG.categories)
const deadline = computed(() => meta.value?.deadline || AWARD_CONFIG.deadline)
const perUserPerCategory = computed(() => meta.value?.perUserPerCategory ?? AWARD_CONFIG.perUserPerCategory)
const maxImagesPerWork = computed(() => meta.value?.maxImagesPerWork ?? AWARD_CONFIG.maxImagesPerWork)
const maxImageMB = computed(() => meta.value?.maxImageMB ?? AWARD_CONFIG.maxImageMB)
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

const galleryFilters = [
  { value: 'all', label: '全部' },
  ...categories.value.map(c => ({ value: c.id, label: c.name }))
]

async function loadMeta() {
  try {
    const res = await request('/submissions/meta', 'GET')
    if (res?.data?.code === 0) meta.value = res.data.data
  } catch {}
}

async function loadWorks() {
  loading.value = true
  try {
    const res = await request('/submissions', 'GET', { limit: 200 }, {})
    if (res?.data?.code === 0) {
      works.value = res.data.list || []
      featured.value = works.value.filter(w => w.featured).slice(0, 10)
    }
  } catch {
    works.value = []
  } finally {
    loading.value = false
  }
}

function setGalleryFilter(value) {
  galleryFilter.value = value
  reloadFiltered()
}

async function reloadFiltered() {
  loading.value = true
  try {
    const params = { limit: 200 }
    if (galleryFilter.value !== 'all') params.category = galleryFilter.value
    const res = await request('/submissions', 'GET', params, {})
    if (res?.data?.code === 0) works.value = res.data.list || []
  } catch {
    works.value = []
  } finally {
    loading.value = false
  }
}

function goSubmit(category) {
  router.push({ path: '/award/submit', query: { category } })
}

function goMine() {
  router.push('/award/my')
}

function openImage(work) {
  const url = work.images?.[0]?.url
  if (url) previewUrl.value = url
}

onMounted(() => {
  document.title = '奖项投稿 · 2026 迎新'
  loadMeta()
  loadWorks()
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
.category-card > p { margin: 0; color: #5f6d66; font-size: 14px; line-height: 1.7; }
.req-list { margin: 16px 0 22px; padding: 0; list-style: none; }
.req-list li { position: relative; padding-left: 18px; color: #49584f; font-size: 13px; line-height: 2; }
.req-list li::before { content: "•"; position: absolute; left: 4px; color: var(--cat-color); font-weight: 800; }
.submit-btn { min-height: 46px; padding: 0 22px; border: 0; border-radius: 999px; background: var(--cat-color); color: #fff; font-weight: 800; font-size: 14px; cursor: pointer; }
.submit-btn:disabled { background: #c9cdca; cursor: not-allowed; }

.rules-panel { margin-top: 34px; padding: 24px; border-radius: 18px; background: #fff; border: 1px dashed #d8d4c9; }
.rules-panel h2, .featured-section h2, .gallery-head h2 { margin: 0; font-size: 20px; }
.rules-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin: 18px 0; }
.rule-item { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; border-radius: 12px; background: #f5f3ec; }
.rule-item b { font-size: 18px; color: #0d9488; }
.rule-item span { color: #5f6d66; font-size: 12px; }
.rules-note { margin: 0 0 14px; color: #7b857f; font-size: 12px; line-height: 1.7; }
.ghost-btn { border: 1px solid #0d9488; background: transparent; color: #0d9488; padding: 9px 16px; border-radius: 999px; font-size: 13px; cursor: pointer; }

.featured-section { margin-top: 40px; }
.featured-track { display: flex; gap: 12px; overflow-x: auto; padding: 8px 2px 14px; scroll-snap-type: x mandatory; }
.featured-card { flex: 0 0 240px; margin: 0; border-radius: 14px; overflow: hidden; background: #fff; border: 1px solid #e8e4da; scroll-snap-align: start; cursor: zoom-in; }
.featured-card img { width: 240px; height: 160px; object-fit: cover; display: block; }
.featured-card figcaption { display: grid; gap: 4px; padding: 10px 12px; }
.featured-card b { font-size: 13px; color: #17231e; }
.featured-card span { font-size: 11px; color: #7b857f; }

.gallery-section { margin-top: 40px; }
.gallery-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; }
.filter-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.filter-chips button { border: 1px solid #d8d4c9; background: #fff; color: #49584f; padding: 7px 14px; border-radius: 999px; font-size: 12px; cursor: pointer; }
.filter-chips button.active { background: #102a2e; border-color: #102a2e; color: #fff; }
.work-grid { display: grid; grid-template-columns: 1fr; gap: 16px; margin-top: 20px; }
.work-card { overflow: hidden; border-radius: 16px; background: #fff; border: 1px solid #e8e4da; cursor: zoom-in; transition: transform .18s ease, box-shadow .18s ease; }
.work-card:hover { transform: translateY(-3px); box-shadow: 0 16px 38px rgba(23,35,30,.1); }
.work-card img { width: 100%; height: 210px; object-fit: cover; display: block; }
.work-info { padding: 14px 16px 16px; }
.work-title-row { display: flex; align-items: center; gap: 8px; }
.work-title-row b { font-size: 15px; color: #17231e; }
.featured-badge { padding: 2px 8px; border-radius: 999px; background: #fff1d6; color: #a16207; font-size: 11px; }
.work-info p { margin: 8px 0; color: #5f6d66; font-size: 13px; line-height: 1.65; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.work-meta { display: flex; flex-wrap: wrap; gap: 8px; }
.work-meta span { font-size: 11px; color: #8a958f; background: #f3f1ea; padding: 3px 9px; border-radius: 999px; }

.empty { padding: 42px 0; text-align: center; color: #8a958f; font-size: 14px; }
.preview-mask { position: fixed; inset: 0; z-index: 90; display: grid; place-items: center; padding: 20px; background: rgba(8,18,15,.82); }
.preview-mask img { max-width: 92vw; max-height: 84vh; border-radius: 12px; box-shadow: 0 22px 60px rgba(0,0,0,.4); }
.preview-mask button { position: fixed; top: 20px; right: 20px; border: 0; border-radius: 999px; background: rgba(255,255,255,.15); color: #fff; padding: 9px 16px; cursor: pointer; }

@media (min-width: 720px) {
  .category-grid { grid-template-columns: repeat(2, 1fr); }
  .rules-grid { grid-template-columns: repeat(4, 1fr); }
  .work-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 1024px) {
  .work-grid { grid-template-columns: repeat(3, 1fr); }
  .work-card img { height: 230px; }
}
</style>
