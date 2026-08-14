<template>
  <div class="mine-page">
    <header class="mine-header">
      <a class="back-link" href="#/award" @click.prevent="router.push('/award')">‹ 返回投稿首页</a>
      <div class="header-inner">
        <div class="header-title">
          <p class="eyebrow"><span></span> MY SUBMISSIONS / 投稿记录</p>
          <h1>我的投稿</h1>
        </div>
        <div class="header-side">
          <p class="lede">每个奖项每人限投 1 个作品，已在同类别投稿时会提示你。</p>
          <button class="new-btn" type="button" @click="router.push('/award/submit')">
            <Plus :size="15" :stroke-width="2.4" aria-hidden="true" />
            <span>继续投稿</span>
          </button>
        </div>
      </div>
    </header>

    <main class="mine-main">
      <div v-if="loading" class="empty">加载中…</div>

      <div v-else-if="!list.length" class="empty">
        <p>你还没有投稿记录</p>
        <button class="new-btn" type="button" @click="router.push('/award/submit')">
          <Plus :size="15" :stroke-width="2.4" aria-hidden="true" />
          <span>去投第一份作品</span>
        </button>
      </div>

      <template v-else>
        <p class="list-count">SUBMITTED · 共 {{ list.length }} 份作品</p>
        <div class="card-list">
          <article v-for="item in list" :key="item.id" class="mine-card">
            <div class="cover">
              <img v-if="item.images?.[0]" :src="item.images[0].url" :alt="item.title" @click="preview(item.images[0].url)" />
              <span v-else class="no-img">无图</span>
            </div>
            <div class="body">
              <div class="row1">
                <b>{{ item.title }}</b>
                <span class="status" :class="item.status">{{ statusText(item.status) }}</span>
                <span v-if="item.appealStatus === 'pending'" class="appeal-badge">申诉中</span>
                <span v-if="item.winnerRank" class="winner-badge">{{ item.winnerLabel }}</span>
              </div>
              <p class="desc">{{ item.description }}</p>
              <div class="meta">
                <span>{{ item.categoryName }}</span>
                <span>{{ item.locationName }}</span>
                <span class="like-chip"><Heart :size="11" :stroke-width="2.2" aria-hidden="true" /> {{ item.likeCount || 0 }}</span>
                <span>{{ fmtTime(item.createdAt) }}</span>
              </div>
              <p v-if="item.reviewNote" class="note">审核意见：{{ item.reviewNote }}</p>
              <button class="detail-btn" type="button" @click="router.push(`/award/submission/${encodeURIComponent(item.id)}`)">
                <span>查看详情</span>
                <ArrowRight :size="14" aria-hidden="true" />
              </button>
            </div>
          </article>
        </div>
      </template>
    </main>

    <div v-if="previewUrl" class="preview-mask" @click.self="previewUrl = ''">
      <img :src="previewUrl" alt="作品大图" />
      <button type="button" @click="previewUrl = ''">关闭</button>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { request } from '@/utils/request'
import { ArrowRight, Heart, Plus } from '@lucide/vue'

const router = useRouter()
const list = ref([])
const loading = ref(true)
const previewUrl = ref('')

function statusText(status) {
  return { pending: '待审核', approved: '已通过', rejected: '已驳回', down: '已下架' }[status] || status
}

function fmtTime(ts) {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
  } catch {
    return String(ts)
  }
}

async function load() {
  loading.value = true
  try {
    const res = await request('/submissions/mine', 'GET')
    if (res?.data?.code === 0) list.value = res.data.list || []
  } catch {
    list.value = []
  } finally {
    loading.value = false
  }
}

function preview(url) {
  if (url) previewUrl.value = url
}

onMounted(() => {
  document.title = '我的投稿 · 打卡作品投稿'
  load()
})
</script>

<style scoped>
.mine-page {
  --ink: #0a2e3b;
  --primary: #0d9488;
  --primary-dark: #08766d;
  --accent: #c7f24a;
  --canvas: #f3f7f5;
  --surface: #ffffff;
  --text: #102a2e;
  --muted: #5e7271;
  --border: #d6e4df;
  min-height: 100vh;
  color: var(--text);
  background-color: var(--canvas);
  background-image:
    linear-gradient(rgba(10, 46, 59, .035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(10, 46, 59, .035) 1px, transparent 1px);
  background-size: 32px 32px;
  font-family: "Noto Sans SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
}

/* 轻量页头：无深色大色块，与投稿首页同一语言 */
.mine-header {
  padding: 20px clamp(16px, 4vw, 52px) 30px;
  border-top: 4px solid var(--ink);
  border-bottom: 1px solid var(--border);
  background: rgba(243, 247, 245, .92);
}
.back-link {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  color: var(--muted);
  text-decoration: none;
  font-size: 13px;
  transition: color .2s ease;
}
.back-link:hover { color: var(--primary); }
.header-inner { max-width: 860px; margin: 10px auto 0; }
.eyebrow {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0;
  color: var(--primary-dark);
  font: 700 10px "SFMono-Regular", Menlo, Consolas, monospace;
  letter-spacing: .08em;
}
.eyebrow span { width: 18px; height: 3px; background: var(--accent); box-shadow: 8px 0 0 var(--ink); }
.mine-header h1 {
  margin: 14px 0 0;
  color: var(--ink);
  font-family: "DIN Alternate", "Avenir Next", "Noto Sans SC", sans-serif;
  font-size: clamp(30px, 6vw, 44px);
  font-weight: 800;
  line-height: 1.02;
  letter-spacing: -.03em;
}
.header-side { margin-top: 18px; display: flex; flex-wrap: wrap; align-items: center; gap: 14px; }
.lede { margin: 0; flex: 1 1 240px; color: var(--muted); font-size: 13px; line-height: 1.7; }

/* 主 CTA：酸橙胶囊，小面积使用 */
.new-btn {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  gap: 7px;
  padding: 0 18px;
  border: 1px solid var(--accent);
  border-radius: 999px;
  background: var(--accent);
  color: var(--ink);
  font-weight: 800;
  font-size: 13px;
  cursor: pointer;
  transition: transform .2s cubic-bezier(.16, 1, .3, 1), background .2s ease;
}
.new-btn:hover { transform: translateY(-2px); background: #d3fa61; }
.new-btn:active { transform: scale(.99); }

.mine-main { max-width: 860px; margin: 0 auto; padding: 28px clamp(16px, 4vw, 52px) 90px; }
.list-count {
  margin: 0 0 14px;
  color: var(--primary-dark);
  font: 700 10px "SFMono-Regular", Menlo, Consolas, monospace;
  letter-spacing: .08em;
}

.card-list { display: grid; gap: 14px; }
.mine-card {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 14px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
  transition: border-color .18s ease, transform .18s ease;
}
.mine-card:hover { border-color: #b9cdc6; transform: translateY(-2px); }
.cover img { width: 110px; height: 110px; border-radius: 12px; object-fit: cover; display: block; cursor: zoom-in; }
.no-img { width: 110px; height: 110px; display: grid; place-items: center; border-radius: 12px; background: #eef4f1; color: #8a958f; font-size: 12px; }
.body { min-width: 0; }
.row1 { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.row1 b { font-size: 16px; color: var(--ink); }

/* 状态 chip：小面积浅色底 + 语义色文字，只表达真实状态 */
.status { padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; }
.status.pending { background: #fff7e6; color: #b45309; }
.status.approved { background: #e6f7ef; color: #0a7a54; }
.status.rejected { background: #fdeeee; color: #b42318; }
.status.down { background: #eef2f7; color: #475569; }
.appeal-badge { padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; background: #fff7e6; color: #b45309; }
.winner-badge { padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; background: #fdece8; color: #c2410c; }

.desc { margin: 8px 0; color: var(--muted); font-size: 13px; line-height: 1.65; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.meta { display: flex; flex-wrap: wrap; gap: 8px; }
.meta span { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: #6b7d78; background: #eef4f1; padding: 3px 9px; border-radius: 999px; }
.like-chip svg { color: var(--primary); }
.note { margin: 8px 0 0; color: #b42318; font-size: 12px; }

.detail-btn {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  border: 1px solid var(--primary);
  border-radius: 999px;
  background: transparent;
  color: var(--primary);
  padding: 0 15px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background .2s ease, color .2s ease;
}
.detail-btn:hover { background: var(--primary); color: #fff; }

.empty { padding: 60px 0; text-align: center; color: #8a958f; font-size: 14px; }
.empty p { margin: 0 0 18px; }

.preview-mask { position: fixed; inset: 0; z-index: 90; display: grid; place-items: center; padding: 20px; background: rgba(8, 18, 15, .82); }
.preview-mask img { max-width: 92vw; max-height: 84vh; border-radius: 12px; }
.preview-mask button { position: fixed; top: 20px; right: 20px; border: 0; border-radius: 999px; background: rgba(255, 255, 255, .15); color: #fff; padding: 9px 16px; cursor: pointer; }

.back-link:focus-visible,
.new-btn:focus-visible,
.detail-btn:focus-visible,
.preview-mask button:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 3px;
  box-shadow: 0 0 0 1px var(--ink);
}

@media (min-width: 720px) {
  .header-inner { display: grid; grid-template-columns: 1fr auto; gap: 32px; align-items: end; }
  .header-side { margin-top: 0; justify-content: flex-end; text-align: right; max-width: 320px; }
}

@media (prefers-reduced-motion: reduce) {
  .back-link, .new-btn, .detail-btn, .mine-card { transition: none; }
  .new-btn:hover, .mine-card:hover { transform: none; }
}
</style>
