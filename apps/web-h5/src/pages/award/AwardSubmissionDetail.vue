<template>
  <div class="detail-page">
    <header class="detail-header">
      <a class="back-link" href="#/award/my" @click.prevent="router.push('/award/my')">‹ 返回我的投稿</a>
      <h1>投稿详情</h1>
    </header>

    <main class="detail-main">
      <div v-if="loading" class="empty">加载中…</div>
      <div v-else-if="!item" class="empty">
        <p>投稿不存在或已被删除</p>
        <button class="ghost-btn" type="button" @click="router.push('/award/my')">返回我的投稿</button>
      </div>

      <template v-else>
        <!-- 审核状态 -->
        <section class="status-card" :class="item.status">
          <div class="status-head">
            <span class="status-badge" :class="item.status">{{ statusText }}</span>
            <span v-if="item.winnerRank" class="winner-badge">{{ item.winnerLabel }}</span>
          </div>
          <p class="status-desc">{{ statusDesc }}</p>
        </section>

        <!-- 获奖详情 -->
        <section v-if="item.status === 'approved' && item.winnerRank" class="card winner-card">
          <h2>🏆 获奖详情</h2>
          <p class="winner-line">恭喜！你的作品获得 <b>{{ item.winnerLabel }}</b></p>
          <p class="winner-sub">奖项：{{ item.categoryName }} · 公示见“获奖结果公示”页面</p>
        </section>

        <!-- 作品信息 -->
        <section class="card">
          <h2>作品信息</h2>
          <div class="images">
            <img
              v-for="(img, i) in item.images"
              :key="i"
              :src="img.url"
              :alt="`${item.title} 图${i + 1}`"
              @click="preview(img.url)"
            />
          </div>
          <dl class="info-list">
            <div><dt>作品名称</dt><dd>{{ item.title }}</dd></div>
            <div><dt>作品说明</dt><dd class="desc-text">{{ item.description }}</dd></div>
            <div><dt>奖项</dt><dd>{{ item.categoryName }}</dd></div>
            <div><dt>对应打卡点</dt><dd>{{ item.locationName }}</dd></div>
            <div><dt>提交时间</dt><dd>{{ fmtTime(item.createdAt) }}</dd></div>
            <div><dt>获得票数</dt><dd>♥ {{ item.likeCount || 0 }}</dd></div>
          </dl>
        </section>

        <!-- 驳回理由 + 申诉 -->
        <section v-if="item.status === 'rejected'" class="card reject-card">
          <h2>驳回详情</h2>
          <div class="reject-box">
            <p class="reject-label">管理员驳回理由：</p>
            <p class="reject-text">{{ item.reviewNote || '（未填写理由）' }}</p>
          </div>

          <div v-if="item.appealStatus === 'pending'" class="appeal-pending">
            <p>⏳ 你的申诉处理中，请耐心等待管理员复核。</p>
            <p class="appeal-reason">申诉理由：{{ item.appealReason }}</p>
          </div>

          <div v-else-if="item.appealResult === 'approved'" class="appeal-done ok">
            <p>✅ 申诉已通过，作品已恢复展示。</p>
          </div>

          <div v-else-if="item.appealResult === 'rejected'" class="appeal-done no">
            <p>❌ 申诉未通过。</p>
            <p class="appeal-reason">你的申诉理由：{{ item.appealReason }}</p>
            <p class="appeal-reason">复核意见：{{ item.reviewNote }}</p>
          </div>

          <div v-else class="appeal-form">
            <p class="appeal-hint">如果你认为驳回有误，可以提交申诉，管理员会重新复核。</p>
            <label class="field">
              <span>申诉理由 <em>（{{ appealReason.length }}/300）</em></span>
              <textarea
                v-model="appealReason"
                maxlength="300"
                rows="4"
                placeholder="请说明你的申诉理由"
              />
            </label>
            <p v-if="appealError" class="form-error">{{ appealError }}</p>
            <button class="primary-btn" type="button" :disabled="appealing" @click="submitAppeal">
              {{ appealing ? '提交中…' : '提交申诉' }}
            </button>
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
import { useRoute, useRouter } from 'vue-router'
import { request } from '@/utils/request'

const route = useRoute()
const router = useRouter()
const item = ref(null)
const loading = ref(true)
const appealReason = ref('')
const appealing = ref(false)
const appealError = ref('')
const previewUrl = ref('')

const statusText = computed(() => {
  if (!item.value) return ''
  if (item.value.status === 'approved') return item.value.winnerRank ? '已获奖' : '已通过'
  return { pending: '审核中', rejected: '被驳回' }[item.value.status] || item.value.status
})

const statusDesc = computed(() => {
  if (!item.value) return ''
  if (item.value.status === 'pending') return '你的作品正在审核中，请耐心等待，结果会第一时间更新。'
  if (item.value.status === 'rejected') return '很遗憾，你的作品未通过审核，可在下方查看驳回理由或提交申诉。'
  if (item.value.winnerRank) return '你的作品已获奖，感谢你的参与！'
  return '你的作品已通过审核，正在作品展示区展出。'
})

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
    const res = await request(`/submissions/${encodeURIComponent(route.params.id)}`, 'GET')
    if (res?.data?.code === 0) item.value = res.data.data.submission
    else {
      item.value = null
      if (res?.status === 401) {
        router.push({ path: '/signin', query: { redirect: route.fullPath } })
      }
    }
  } catch {
    item.value = null
  } finally {
    loading.value = false
  }
}

async function submitAppeal() {
  appealError.value = ''
  const reason = appealReason.value.trim()
  if (!reason) {
    appealError.value = '请填写申诉理由'
    return
  }
  appealing.value = true
  try {
    const res = await request(`/submissions/${encodeURIComponent(route.params.id)}/appeal`, 'POST', { reason })
    if (res?.data?.code === 0) {
      alert('申诉已提交，等待管理员复核')
      load()
    } else {
      appealError.value = res?.data?.message || '提交失败，请重试'
    }
  } catch {
    appealError.value = '提交失败，请重试'
  } finally {
    appealing.value = false
  }
}

function preview(url) {
  if (url) previewUrl.value = url
}

onMounted(() => {
  document.title = '投稿详情'
  load()
})
</script>

<style scoped>
.detail-page { min-height: 100vh; color: #17231e; background: #f6f4ef; font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif; }
.detail-header { display: flex; align-items: center; gap: 16px; padding: 24px clamp(16px, 4vw, 52px); background: #102a2e; color: #fff; }
.back-link { color: rgba(255,255,255,.7); text-decoration: none; font-size: 13px; }
.detail-header h1 { margin: 0; font-size: 22px; flex: 1; }
.detail-main { max-width: 760px; margin: 0 auto; padding: 26px clamp(16px, 4vw, 52px) 90px; display: grid; gap: 16px; }
.card { padding: 22px; border-radius: 16px; background: #fff; border: 1px solid #e8e4da; }
.card h2 { margin: 0 0 16px; font-size: 17px; }

.status-card { padding: 20px 22px; border-radius: 16px; background: #fff; border: 1px solid #e8e4da; }
.status-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.status-badge { padding: 5px 14px; border-radius: 999px; font-size: 14px; font-weight: 700; }
.status-badge.pending { background: #fff7e6; color: #b45309; }
.status-badge.approved { background: #e6f7ef; color: #0a7a54; }
.status-badge.rejected { background: #fdeeee; color: #b42318; }
.status-desc { margin: 12px 0 0; color: #5f6d66; font-size: 14px; line-height: 1.7; }
.winner-badge { padding: 4px 12px; border-radius: 999px; font-size: 12px; background: #fdece8; color: #c2410c; }

.winner-card { background: #fffaf2; border-color: #f0d9a8; }
.winner-line { margin: 0; font-size: 16px; }
.winner-line b { color: #9a6200; font-size: 18px; }
.winner-sub { margin: 8px 0 0; color: #8a6a2f; font-size: 13px; }

.images { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
.images img { width: 110px; height: 110px; border-radius: 10px; object-fit: cover; cursor: zoom-in; background: #f1efe8; }
.info-list { margin: 0; }
.info-list div { display: grid; grid-template-columns: 110px 1fr; gap: 10px; padding: 8px 0; border-bottom: 1px dashed #eeece4; }
.info-list div:last-child { border-bottom: 0; }
.info-list dt { color: #8a958f; font-size: 13px; }
.info-list dd { margin: 0; color: #17231e; font-size: 14px; line-height: 1.7; }
.info-list .desc-text { white-space: pre-wrap; }

.reject-card { background: #fffdfd; border-color: #f0d0cd; }
.reject-box { padding: 14px 16px; border-radius: 12px; background: #fdeeee; }
.reject-label { margin: 0 0 6px; color: #b42318; font-size: 13px; font-weight: 700; }
.reject-text { margin: 0; color: #7c2d28; font-size: 14px; line-height: 1.7; }
.appeal-pending { margin-top: 16px; padding: 14px 16px; border-radius: 12px; background: #fff7e6; color: #7a5200; font-size: 14px; }
.appeal-reason { margin: 6px 0 0; color: #8a6a2f; font-size: 13px; line-height: 1.6; }
.appeal-done { margin-top: 16px; padding: 14px 16px; border-radius: 12px; font-size: 14px; }
.appeal-done.ok { background: #e6f7ef; color: #0a7a54; }
.appeal-done.no { background: #fdeeee; color: #b42318; }
.appeal-form { margin-top: 16px; }
.appeal-hint { margin: 0 0 14px; color: #5f6d66; font-size: 13px; }
.field { display: grid; gap: 8px; }
.field > span { color: #49584f; font-size: 13px; }
.field em { color: #8a958f; font-style: normal; font-size: 11px; }
.field textarea { width: 100%; box-sizing: border-box; border: 1px solid #d8d4c9; border-radius: 10px; background: #fff; padding: 12px 14px; font-size: 14px; color: #17231e; outline: none; resize: vertical; font-family: inherit; line-height: 1.7; }
.field textarea:focus { border-color: #0d9488; box-shadow: 0 0 0 3px rgba(13,148,136,.12); }
.form-error { margin: 10px 0 0; color: #b42318; font-size: 13px; }
.primary-btn { margin-top: 14px; border: 0; background: #0d9488; color: #fff; padding: 11px 24px; border-radius: 999px; font-size: 14px; font-weight: 700; cursor: pointer; }
.primary-btn:disabled { opacity: .6; cursor: wait; }
.ghost-btn { border: 1px solid #0d9488; background: transparent; color: #0d9488; padding: 10px 20px; border-radius: 999px; font-size: 13px; cursor: pointer; }

.empty { padding: 60px 0; text-align: center; color: #8a958f; }
.empty p { margin: 0 0 16px; }
.preview-mask { position: fixed; inset: 0; z-index: 90; display: grid; place-items: center; padding: 20px; background: rgba(8,18,15,.82); }
.preview-mask img { max-width: 92vw; max-height: 84vh; border-radius: 12px; }
.preview-mask button { position: fixed; top: 20px; right: 20px; border: 0; border-radius: 999px; background: rgba(255,255,255,.15); color: #fff; padding: 9px 16px; cursor: pointer; }
</style>
