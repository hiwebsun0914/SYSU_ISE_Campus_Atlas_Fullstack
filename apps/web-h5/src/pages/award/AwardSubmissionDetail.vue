<template>
  <div class="detail-page">
    <header class="detail-header">
      <a class="back-link" href="#/award/my" @click.prevent="router.push('/award/my')">‹ 返回我的投稿</a>
      <div class="header-inner">
        <div class="header-title">
          <p class="eyebrow"><span></span> DETAIL / 投稿详情</p>
          <h1>{{ item?.title || '投稿详情' }}</h1>
        </div>
        <div class="header-side">
          <button class="primary-btn sm" type="button" @click="router.push('/award/submit')">
            <Plus :size="15" :stroke-width="2.4" aria-hidden="true" />
            <span>继续投稿</span>
          </button>
        </div>
      </div>
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
          <h2><Trophy :size="17" aria-hidden="true" /> 获奖详情</h2>
          <p class="winner-line">恭喜！你的作品获得 <b>{{ item.categoryName }}：{{ item.winnerLabel }}</b></p>
          <p class="winner-sub">奖项：{{ item.categoryName }} · 公示见“获奖结果公示”页面</p>
        </section>

        <!-- 查看作品详情（可展开） -->
        <section class="card">
          <button class="toggle-btn" type="button" :aria-expanded="showDetails" @click="showDetails = !showDetails">
            <span>查看作品详情</span>
            <ChevronDown class="chev" :class="{ open: showDetails }" :size="18" aria-hidden="true" />
          </button>
          <div v-if="showDetails" class="details-body">
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
              <div><dt>作品介绍</dt><dd class="desc-text">{{ item.description }}</dd></div>
              <div><dt>提交时间</dt><dd>{{ fmtTime(item.createdAt) }}</dd></div>
              <div>
                <dt>获得票数</dt>
                <dd class="like-count"><Heart :size="13" :stroke-width="2.2" aria-hidden="true" /> {{ item.likeCount || 0 }}</dd>
              </div>
              <div><dt>当前状态</dt><dd>{{ statusText }}{{ item.appealStatus === 'pending' ? '（申诉处理中）' : '' }}</dd></div>
              <div><dt>奖项</dt><dd>{{ item.categoryName }}{{ item.winnerRank ? ' · ' + item.winnerLabel : '' }}</dd></div>
              <div><dt>对应打卡点</dt><dd>{{ item.locationName }}</dd></div>
            </dl>
          </div>
        </section>

        <!-- 驳回理由 + 申诉 -->
        <section v-if="item.status === 'rejected'" class="card reject-card">
          <h2>驳回详情</h2>
          <div class="reject-box">
            <p class="reject-label">管理员驳回理由：</p>
            <p class="reject-text">{{ item.reviewNote || '（未填写理由）' }}</p>
          </div>

          <div v-if="item.appealStatus === 'pending'" class="appeal-note pending">
            <p class="appeal-note-title"><Clock :size="15" aria-hidden="true" /> 你的申诉处理中，请耐心等待管理员复核。</p>
            <p class="appeal-reason">申诉理由：{{ item.appealReason }}</p>
          </div>

          <div v-else-if="item.appealResult === 'approved'" class="appeal-note ok">
            <p class="appeal-note-title"><CircleCheck :size="15" aria-hidden="true" /> 申诉已通过，作品已恢复展示。</p>
          </div>

          <div v-else-if="item.appealResult === 'rejected'" class="appeal-note no">
            <p class="appeal-note-title"><CircleX :size="15" aria-hidden="true" /> 申诉未通过。</p>
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
            <p v-if="appealError" class="form-error" role="alert">{{ appealError }}</p>
            <button class="primary-btn" type="button" :disabled="appealing" @click="submitAppeal">
              {{ appealing ? '提交中…' : '提交申诉' }}
            </button>
          </div>
        </section>

        <!-- 操作区 -->
        <section class="card actions-card">
          <button class="primary-btn" type="button" @click="router.push('/award/submit')">
            <Plus :size="15" :stroke-width="2.4" aria-hidden="true" />
            <span>继续投稿</span>
          </button>
          <button class="danger-btn" type="button" :disabled="deleting" @click="openDeleteModal">
            {{ deleting ? '删除中…' : '删除作品' }}
          </button>
        </section>
      </template>
    </main>

    <!-- 删除确认弹窗 -->
    <div v-if="deleteModalVisible" class="modal-mask" @click.self="deleteModalVisible = false">
      <div class="modal-card">
        <h3>删除作品</h3>
        <p class="modal-warn">确定要删除《{{ item?.title }}》吗？<b>一旦删除无法找回</b>，请谨慎操作。</p>
        <p v-if="deleteError" class="form-error" role="alert">{{ deleteError }}</p>
        <div class="modal-actions">
          <button class="ghost-btn" type="button" @click="deleteModalVisible = false">取消</button>
          <button class="danger-btn" type="button" :disabled="deleting" @click="confirmDelete">
            {{ deleting ? '删除中…' : '确定删除' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="previewUrl" class="preview-mask" @click.self="previewUrl = ''">
      <img :src="previewUrl" alt="作品大图" />
      <button type="button" @click="previewUrl = ''">关闭</button>
    </div>

    <Transition name="toast">
      <div v-if="toast" class="page-toast" role="status">{{ toast }}</div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { request } from '@/utils/request'
import { AWARD_CONFIG } from '@/data/awards'
import { ChevronDown, CircleCheck, CircleX, Clock, Heart, Plus, Trophy } from '@lucide/vue'

const route = useRoute()
const router = useRouter()
const item = ref(null)
const loading = ref(true)
const showDetails = ref(true)
const appealReason = ref('')
const appealing = ref(false)
const appealError = ref('')
const previewUrl = ref('')
const deleteModalVisible = ref(false)
const deleting = ref(false)
const deleteError = ref('')
const toast = ref('')
let toastTimer = 0

const closed = computed(() => Date.now() > new Date(AWARD_CONFIG.deadline).getTime())
const ACTIVITY_ENDED_MSG = '活动已截止，无法进行操作，请耐心期待最终结果公布'

function showToast(msg) {
  toast.value = msg
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toast.value = '' }, 3200)
}

const statusText = computed(() => {
  if (!item.value) return ''
  if (item.value.status === 'approved') return item.value.winnerRank ? '已获奖' : '已通过'
  return { pending: '审核中', rejected: '被驳回', down: '已下架' }[item.value.status] || item.value.status
})

const statusDesc = computed(() => {
  if (!item.value) return ''
  if (item.value.status === 'pending') return '你的作品正在审核中，请耐心等待，结果会第一时间更新。'
  if (item.value.status === 'rejected') return '很遗憾，你的作品未通过审核，可在下方查看驳回理由或提交申诉。'
  if (item.value.status === 'down') return '该作品已被管理员下架，不再公开展示。'
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
  if (closed.value) {
    showToast(ACTIVITY_ENDED_MSG)
    return
  }
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
      appealReason.value = ''
      await load()
    } else {
      appealError.value = res?.data?.message || '提交失败，请重试'
    }
  } catch {
    appealError.value = '提交失败，请重试'
  } finally {
    appealing.value = false
  }
}

function openDeleteModal() {
  deleteModalVisible.value = true
  deleteError.value = ''
}

async function confirmDelete() {
  if (closed.value) {
    deleteModalVisible.value = false
    showToast(ACTIVITY_ENDED_MSG)
    return
  }
  if (deleting.value) return
  deleting.value = true
  try {
    const res = await request(`/submissions/${encodeURIComponent(route.params.id)}`, 'DELETE')
    if (res?.data?.code === 0) {
      deleteModalVisible.value = false
      router.replace('/award/my')
    } else {
      deleteError.value = res?.data?.message || '删除失败'
    }
  } catch {
    deleteError.value = '删除失败，请重试'
  } finally {
    deleting.value = false
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
.detail-page {
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

/* 轻量页头：无深色大色块，与其他奖项页面同一语言 */
.detail-header {
  padding: 20px clamp(16px, 4vw, 52px) 26px;
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
.header-inner { max-width: 760px; margin: 10px auto 0; display: flex; flex-wrap: wrap; align-items: flex-end; gap: 14px; }
.header-title { flex: 1 1 auto; min-width: 0; }
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
.detail-header h1 {
  margin: 12px 0 0;
  color: var(--ink);
  font-family: "DIN Alternate", "Avenir Next", "Noto Sans SC", sans-serif;
  font-size: clamp(28px, 5.5vw, 40px);
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -.03em;
  word-break: break-all;
}
.header-side { flex: 0 0 auto; }

.detail-main { max-width: 760px; margin: 0 auto; padding: 28px clamp(16px, 4vw, 52px) 90px; display: grid; gap: 16px; }
.card { padding: 22px; border-radius: 16px; background: var(--surface); border: 1px solid var(--border); }
.card h2 { display: flex; align-items: center; gap: 8px; margin: 0 0 16px; color: var(--ink); font-size: 17px; }
.card h2 svg { color: var(--primary); }

.status-card { padding: 20px 22px; border-radius: 16px; background: var(--surface); border: 1px solid var(--border); }
.status-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.status-badge { padding: 5px 14px; border-radius: 999px; font-size: 14px; font-weight: 700; }
.status-badge.pending { background: #fff7e6; color: #b45309; }
.status-badge.approved { background: #e6f7ef; color: #0a7a54; }
.status-badge.rejected { background: #fdeeee; color: #b42318; }
.status-badge.down { background: #eef2f7; color: #475569; }
.status-desc { margin: 12px 0 0; color: var(--muted); font-size: 14px; line-height: 1.7; }
.winner-badge { padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; background: #fdece8; color: #c2410c; }

/* 获奖卡：白底 + 酸橙左线，不用大面积 tint */
.winner-card { border-left: 3px solid var(--accent); }
.winner-card h2 svg { color: #b98a00; }
.winner-line { margin: 0; font-size: 16px; color: var(--text); }
.winner-line b { color: var(--primary-dark); font-size: 18px; }
.winner-sub { margin: 8px 0 0; color: var(--muted); font-size: 13px; }

.toggle-btn { width: 100%; display: flex; align-items: center; justify-content: space-between; border: 0; background: none; color: var(--ink); font-size: 17px; font-weight: 700; cursor: pointer; padding: 0; }
.chev { color: #8a958f; transition: transform .2s ease; }
.chev.open { transform: rotate(180deg); }
.details-body { margin-top: 16px; border-top: 1px dashed var(--border); padding-top: 14px; }
.images { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
.images img { width: 110px; height: 110px; border-radius: 12px; object-fit: cover; cursor: zoom-in; background: #eef4f1; display: block; }
.info-list { margin: 0; }
.info-list div { display: grid; grid-template-columns: 110px 1fr; gap: 10px; padding: 8px 0; border-bottom: 1px dashed var(--border); }
.info-list div:last-child { border-bottom: 0; }
.info-list dt { color: #8a958f; font-size: 13px; }
.info-list dd { margin: 0; color: var(--text); font-size: 14px; line-height: 1.7; }
.info-list .desc-text { white-space: pre-wrap; }
.like-count { display: inline-flex; align-items: center; gap: 5px; }
.like-count svg { color: var(--primary); }

/* 驳回 / 申诉：细边框 + 轻 tint 的小提示条，非大色块 */
.reject-card { border-color: #ecc9c6; }
.reject-box { padding: 14px 16px; border: 1px solid #f0ccc9; border-radius: 12px; background: #fdf4f3; }
.reject-label { margin: 0 0 6px; color: #b42318; font-size: 13px; font-weight: 700; }
.reject-text { margin: 0; color: #7c2d28; font-size: 14px; line-height: 1.7; }
.appeal-note { margin-top: 16px; padding: 14px 16px; border: 1px solid; border-radius: 12px; font-size: 14px; }
.appeal-note.pending { border-color: #eed9ae; background: #fffaef; color: #7a5200; }
.appeal-note.ok { border-color: #bce3d2; background: #f0faf5; color: #0a7a54; }
.appeal-note.no { border-color: #f0ccc9; background: #fdf4f3; color: #b42318; }
.appeal-note-title { display: flex; align-items: center; gap: 7px; margin: 0; font-weight: 700; }
.appeal-reason { margin: 6px 0 0; font-size: 13px; line-height: 1.6; opacity: .85; }
.appeal-form { margin-top: 16px; }
.appeal-hint { margin: 0 0 14px; color: var(--muted); font-size: 13px; }
.field { display: grid; gap: 8px; }
.field > span { color: #405a5c; font-size: 13px; font-weight: 700; }
.field em { color: #8a958f; font-style: normal; font-size: 11px; font-weight: 400; }
.field textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  padding: 12px 14px;
  font-size: 14px;
  color: var(--text);
  outline: none;
  resize: vertical;
  font-family: inherit;
  line-height: 1.7;
  transition: border-color .18s ease, box-shadow .18s ease;
}
.field textarea:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(13, 148, 136, .12); }
.form-error { margin: 10px 0 0; padding: 10px 12px; border: 1px solid #f0ccc9; border-radius: 10px; background: #fdf4f3; color: #b42318; font-size: 13px; }

/* 主 CTA：酸橙胶囊 + 深青文字；危险/次级操作为描边按钮 */
.primary-btn {
  display: inline-flex;
  min-height: 46px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid var(--accent);
  border-radius: 999px;
  background: var(--accent);
  color: var(--ink);
  padding: 0 22px;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  transition: transform .2s cubic-bezier(.16, 1, .3, 1), background .2s ease;
}
.primary-btn:hover:not(:disabled) { transform: translateY(-2px); background: #d3fa61; }
.primary-btn:active:not(:disabled) { transform: scale(.99); }
.primary-btn:disabled { border-color: var(--border); background: var(--border); color: var(--muted); cursor: wait; }
.primary-btn.sm { min-height: 44px; padding: 0 18px; font-size: 13px; }
.ghost-btn {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  border: 1px solid var(--primary);
  border-radius: 999px;
  background: transparent;
  color: var(--primary);
  padding: 0 20px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: background .2s ease, color .2s ease;
}
.ghost-btn:hover { background: var(--primary); color: #fff; }
.actions-card { display: flex; gap: 12px; flex-wrap: wrap; }
.danger-btn {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  border: 1px solid #e2b6b1;
  border-radius: 999px;
  background: transparent;
  color: #b42318;
  padding: 0 20px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: background .2s ease, color .2s ease;
}
.danger-btn:hover:not(:disabled) { background: #b42318; border-color: #b42318; color: #fff; }
.danger-btn:disabled { opacity: .6; cursor: wait; }

.empty { padding: 60px 0; text-align: center; color: #8a958f; font-size: 14px; }
.empty p { margin: 0 0 16px; }
.preview-mask { position: fixed; inset: 0; z-index: 90; display: grid; place-items: center; padding: 20px; background: rgba(8, 18, 15, .82); }
.preview-mask img { max-width: 92vw; max-height: 84vh; border-radius: 12px; }
.preview-mask button { position: fixed; top: 20px; right: 20px; border: 0; border-radius: 999px; background: rgba(255, 255, 255, .15); color: #fff; padding: 9px 16px; cursor: pointer; }
.modal-mask { position: fixed; inset: 0; z-index: 95; display: grid; place-items: center; padding: 20px; background: rgba(8, 18, 15, .7); }
.modal-card { width: min(420px, 100%); padding: 24px; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); }
.modal-card h3 { margin: 0 0 10px; color: var(--ink); font-size: 18px; }
.modal-warn { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.7; }
.modal-warn b { color: #b42318; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
.page-toast { position: fixed; left: 50%; bottom: 30px; z-index: 120; transform: translateX(-50%); max-width: calc(100% - 32px); padding: 11px 18px; border-radius: 999px; background: rgba(17, 35, 30, .92); color: #fff; font-size: 13px; text-align: center; box-shadow: 0 12px 32px rgba(0, 0, 0, .22); }
.toast-enter-active, .toast-leave-active { transition: opacity .2s ease, transform .2s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 10px); }

.back-link:focus-visible,
.primary-btn:focus-visible,
.ghost-btn:focus-visible,
.danger-btn:focus-visible,
.toggle-btn:focus-visible,
.preview-mask button:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 3px;
  box-shadow: 0 0 0 1px var(--ink);
}

@media (prefers-reduced-motion: reduce) {
  .back-link, .primary-btn, .ghost-btn, .danger-btn, .chev,
  .toast-enter-active, .toast-leave-active { transition: none; }
  .primary-btn:hover:not(:disabled) { transform: none; }
}
</style>
