<template>
  <div class="results-page">
    <header class="results-header">
      <a class="back-link" href="#/award" @click.prevent="router.push('/award')">‹ 返回投稿首页</a>
      <h1>🏆 获奖结果公示</h1>
      <p>经过评审，以下作品脱颖而出。恭喜所有获奖同学！</p>
    </header>

    <main class="results-main">
      <div v-if="loading" class="empty">加载中…</div>
      <div v-else-if="!winners.length" class="empty">
        <p>评审进行中，结果即将公布，敬请期待！</p>
        <button class="back-btn" type="button" @click="router.push('/award')">返回投稿首页</button>
      </div>

      <template v-else>
        <section v-for="cat in grouped" :key="cat.id" class="result-section">
          <h2>{{ cat.name }}</h2>
          <div class="result-grid">
            <article v-for="w in cat.items" :key="w.id" class="result-card" @click="preview(w)">
              <img :src="w.images[0]?.url" :alt="w.title" loading="lazy" />
              <div class="result-body">
                <div class="result-top">
                  <b>{{ w.title }}</b>
                  <span class="rank-badge" :class="w.winnerRank">{{ w.winnerLabel }}</span>
                </div>
                <p>{{ w.description }}</p>
                <div class="result-meta">
                  <span>{{ w.username }}</span>
                  <span>{{ w.locationName }}</span>
                  <span class="likes">♥ {{ w.likeCount || 0 }}</span>
                </div>
              </div>
            </article>
          </div>
        </section>
      </template>
    </main>

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
const winners = ref([])
const loading = ref(true)
const previewUrl = ref('')

const grouped = computed(() =>
  AWARD_CONFIG.categories
    .map(cat => ({
      id: cat.id,
      name: cat.name,
      items: winners.value.filter(w => w.category === cat.id)
    }))
    .filter(g => g.items.length)
)

async function load() {
  loading.value = true
  try {
    const res = await request('/submissions/winners', 'GET')
    if (res?.data?.code === 0) winners.value = res.data.list || []
  } catch {
    winners.value = []
  } finally {
    loading.value = false
  }
}

function preview(work) {
  const url = work.images?.[0]?.url
  if (url) previewUrl.value = url
}

onMounted(() => {
  document.title = '获奖结果公示'
  load()
})
</script>

<style scoped>
.results-page { min-height: 100vh; color: #17231e; background: #f6f4ef; font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif; }
.results-header { padding: 34px clamp(16px, 4vw, 52px) 30px; background: #102a2e; color: #fff; text-align: center; }
.back-link { display: inline-block; margin-bottom: 16px; color: rgba(255,255,255,.7); text-decoration: none; font-size: 13px; }
.results-header h1 { margin: 0 0 10px; font-size: clamp(26px, 5vw, 40px); }
.results-header p { margin: 0; color: rgba(255,255,255,.72); font-size: 14px; }
.results-main { max-width: 960px; margin: 0 auto; padding: 32px clamp(16px, 4vw, 52px) 90px; }
.result-section { margin-bottom: 34px; }
.result-section h2 { margin: 0 0 16px; font-size: 20px; color: #17231e; border-left: 4px solid #0d9488; padding-left: 12px; }
.result-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
.result-card { display: grid; grid-template-columns: 1fr; overflow: hidden; border-radius: 16px; background: #fff; border: 1px solid #e8e4da; cursor: zoom-in; }
.result-card img { width: 100%; height: 210px; object-fit: cover; display: block; }
.result-body { padding: 14px 16px 16px; }
.result-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.result-top b { font-size: 16px; color: #17231e; }
.rank-badge { padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
.rank-badge.first { background: #fff1d6; color: #9a6200; }
.rank-badge.second { background: #eef2f7; color: #475569; }
.rank-badge.third { background: #fdece8; color: #c2410c; }
.rank-badge.popular { background: #fde7f2; color: #be185d; }
.result-body p { margin: 9px 0; color: #5f6d66; font-size: 13px; line-height: 1.65; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.result-meta { display: flex; flex-wrap: wrap; gap: 8px; }
.result-meta span { font-size: 11px; color: #8a958f; background: #f3f1ea; padding: 3px 9px; border-radius: 999px; }
.result-meta .likes { color: #d43a3a; background: #fff1f1; }
.empty { padding: 70px 0; text-align: center; color: #8a958f; }
.empty p { margin: 0 0 18px; font-size: 15px; }
.back-btn { border: 1px solid #0d9488; background: transparent; color: #0d9488; padding: 10px 20px; border-radius: 999px; font-size: 13px; cursor: pointer; }
.preview-mask { position: fixed; inset: 0; z-index: 90; display: grid; place-items: center; padding: 20px; background: rgba(8,18,15,.82); }
.preview-mask img { max-width: 92vw; max-height: 84vh; border-radius: 12px; }
.preview-mask button { position: fixed; top: 20px; right: 20px; border: 0; border-radius: 999px; background: rgba(255,255,255,.15); color: #fff; padding: 9px 16px; cursor: pointer; }

@media (min-width: 720px) {
  .result-card { grid-template-columns: 230px 1fr; }
  .result-card img { width: 230px; height: 100%; }
}
</style>
