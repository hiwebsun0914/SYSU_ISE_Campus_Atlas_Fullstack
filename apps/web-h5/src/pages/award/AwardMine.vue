<template>
  <div class="mine-page">
    <header class="mine-header">
      <a class="back-link" href="#/award" @click.prevent="router.push('/award')">‹ 返回投稿首页</a>
      <h1>我的投稿</h1>
      <button class="new-btn" type="button" @click="router.push('/award/submit')">＋ 继续投稿</button>
    </header>

    <main class="mine-main">
      <!-- 去投稿 -->
      <div class="submit-bar">
        <div>
          <b>还想投稿？</b>
          <span>每个奖项每人限投 1 个作品，已在同类别投稿时会提示你。</span>
        </div>
        <button class="primary-btn" type="button" @click="router.push('/award/submit')">去投稿</button>
      </div>

      <div v-if="loading" class="empty">加载中…</div>
      <div v-else-if="!list.length" class="empty">
        <p>你还没有投稿记录</p>
        <button class="primary-btn" type="button" @click="router.push('/award/submit')">去投稿</button>
      </div>

      <div v-else class="card-list">
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
              <span>♥ {{ item.likeCount || 0 }}</span>
              <span>{{ fmtTime(item.createdAt) }}</span>
            </div>
            <p v-if="item.reviewNote" class="note">审核意见：{{ item.reviewNote }}</p>
            <button class="detail-btn" type="button" @click="router.push(`/award/submission/${encodeURIComponent(item.id)}`)">
              查看详情
            </button>
          </div>
        </article>
      </div>
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
.mine-page { min-height: 100vh; color: #17231e; background: #f6f4ef; font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif; }
.mine-header { display: flex; align-items: center; gap: 16px; padding: 26px clamp(16px, 4vw, 52px); background: #102a2e; color: #fff; }
.back-link { color: rgba(255,255,255,.7); text-decoration: none; font-size: 13px; }
.mine-header h1 { margin: 0; font-size: 24px; flex: 1; }
.new-btn { border: 1px solid rgba(199,242,74,.5); background: transparent; color: #c7f24a; padding: 10px 18px; border-radius: 999px; font-size: 13px; cursor: pointer; }
.mine-main { max-width: 860px; margin: 0 auto; padding: 26px clamp(16px, 4vw, 52px) 90px; }
.submit-bar { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 18px; padding: 16px 18px; border-radius: 14px; background: #e8f4ef; border: 1px solid #cfe6dc; }
.submit-bar b { display: block; color: #0d6e5f; font-size: 15px; }
.submit-bar span { display: block; margin-top: 4px; color: #5f7d73; font-size: 12px; line-height: 1.6; }
.card-list { display: grid; gap: 14px; }
.mine-card { display: grid; grid-template-columns: 110px 1fr; gap: 14px; padding: 14px; border-radius: 16px; background: #fff; border: 1px solid #e8e4da; }
.cover img { width: 110px; height: 110px; border-radius: 10px; object-fit: cover; cursor: zoom-in; }
.no-img { width: 110px; height: 110px; display: grid; place-items: center; border-radius: 10px; background: #eeece4; color: #8a958f; font-size: 12px; }
.body { min-width: 0; }
.row1 { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.row1 b { font-size: 16px; }
.status { padding: 3px 10px; border-radius: 999px; font-size: 11px; }
.status.pending { background: #fff7e6; color: #b45309; }
.status.approved { background: #e6f7ef; color: #0a7a54; }
.status.rejected { background: #fdeeee; color: #b42318; }
.status.down { background: #eef2f7; color: #475569; }
.appeal-badge { padding: 3px 10px; border-radius: 999px; font-size: 11px; background: #fff7e6; color: #b45309; }
.winner-badge { padding: 3px 10px; border-radius: 999px; font-size: 11px; background: #fdece8; color: #c2410c; }
.desc { margin: 8px 0; color: #5f6d66; font-size: 13px; line-height: 1.65; }
.meta { display: flex; flex-wrap: wrap; gap: 8px; }
.meta span { font-size: 11px; color: #8a958f; background: #f3f1ea; padding: 3px 9px; border-radius: 999px; }
.note { margin: 8px 0 0; color: #b42318; font-size: 12px; }
.detail-btn { margin-top: 10px; border: 1px solid #0d9488; background: transparent; color: #0d9488; padding: 7px 16px; border-radius: 999px; font-size: 12px; cursor: pointer; }
.empty { padding: 60px 0; text-align: center; color: #8a958f; }
.empty p { margin: 0 0 16px; }
.primary-btn { border: 0; background: #0d9488; color: #fff; padding: 11px 24px; border-radius: 999px; font-size: 14px; cursor: pointer; }
.preview-mask { position: fixed; inset: 0; z-index: 90; display: grid; place-items: center; padding: 20px; background: rgba(8,18,15,.82); }
.preview-mask img { max-width: 92vw; max-height: 84vh; border-radius: 12px; }
.preview-mask button { position: fixed; top: 20px; right: 20px; border: 0; border-radius: 999px; background: rgba(255,255,255,.15); color: #fff; padding: 9px 16px; cursor: pointer; }
</style>
