<!-- src/pages/HiddenCheckpointDetail.vue -->
<template>
  <div class="hd-shell">
    <header class="hd-header">
      <button class="icon-btn" type="button" aria-label="返回" @click="router.back()">
        <ArrowLeft :size="22" />
      </button>
      <div class="header-title">
        <h1>隐藏打卡点</h1>
        <span>HIDDEN CHECKPOINT · {{ place ? place.name : '加载中' }}</span>
      </div>
    </header>

    <main v-if="place" class="hd-content">
      <div class="hd-hero">
        <img
          class="hd-img"
          :src="place.image"
          :alt="place.name"
          draggable="false"
        />
        <div v-if="!isPlaceChecked(place.id)" class="hd-mask">
          <span class="hd-lock">{{ reviewState.status === 'pending' || reviewState.status === 'appealed' ? '⏳' : '🔒' }}</span>
          <span class="hd-mask-text">{{ heroStatusText }}</span>
        </div>
        <span v-else class="hd-found-badge">✅ 已发现</span>
      </div>

      <section class="hd-info">
        <div class="hd-name">{{ place.name }}</div>

        <div class="hd-tags">
          <span class="hd-tag status" :class="isPlaceChecked(place.id) ? 'found' : 'locked'">
            {{ statusLabel }}
          </span>
        </div>

        <aside v-if="reviewState.status === 'rejected'" class="review-feedback review-feedback--rejected" role="status">
          <AlertCircle :size="19" aria-hidden="true" />
          <div>
            <strong>本次照片未通过审核</strong>
            <p>{{ reviewState.note || '照片未满足打卡要求，你可以重新提交照片或发起申诉。' }}</p>
          </div>
        </aside>

        <aside v-else-if="reviewState.status === 'pending' || reviewState.status === 'appealed'" class="review-feedback" role="status">
          <Clock3 :size="19" aria-hidden="true" />
          <div>
            <strong>{{ reviewState.status === 'appealed' ? '申诉正在复核' : '照片正在审核' }}</strong>
            <p>审核期间不能重复打卡；管理员处理后，这里会显示结果。</p>
          </div>
        </aside>

        <div class="hd-block">
          <p class="hd-label">地点介绍</p>
          <article
            class="hd-richtext"
            v-html="place.description || '<p>暂无介绍。</p>'"
          ></article>
        </div>

        <button
          class="hd-action"
          type="button"
          :disabled="reviewState.status === 'pending' || reviewState.status === 'appealed' || checking"
          @click="onStartCheckin(place)"
        >
          {{ actionLabel }}
        </button>

        <form v-if="reviewState.status === 'rejected'" class="appeal-form" @submit.prevent="submitAppeal">
          <label for="checkin-appeal">认为审核结果有误？提交申诉说明</label>
          <textarea
            id="checkin-appeal"
            v-model.trim="appealReason"
            maxlength="500"
            rows="3"
            placeholder="请说明照片与地点的对应关系，至少 4 个字符"
          ></textarea>
          <div>
            <small :class="{ error: appealError }">{{ appealError || `${appealReason.length}/500` }}</small>
            <button type="submit" :disabled="appealing">
              <Send :size="16" aria-hidden="true" />{{ appealing ? '正在提交' : '提交申诉' }}
            </button>
          </div>
        </form>
      </section>
    </main>

    <main v-else class="hd-empty">
      <p>未找到该隐藏打卡点</p>
      <button class="hd-back-link" type="button" @click="goList">返回列表</button>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertCircle, ArrowLeft, Clock3, Send } from '@lucide/vue'
import { campusLocations } from '@/data/campusPlaces'
import { appealCheckin, fetchUserProgress, getPlaceReviewState, isPlaceChecked } from '@/stores/userProgress'
import { placeIdToBackend } from '@/data/campusPlaces'
import { checkinFlow } from '@/utils/checkinFlow'

document.title = '隐藏打卡点详情'

const route = useRoute()
const router = useRouter()

const place = computed(() =>
  campusLocations.find(p => String(p.id) === String(route.params.id))
)

// 后端数字 locationId（共享拍照打卡流程，由同一张映射表转换）
const backendLocationId = computed(() => {
  const pid = place.value?.id
  return pid != null ? placeIdToBackend[pid] : undefined
})

const checking = ref(false)
const appealing = ref(false)
const appealReason = ref('')
const appealError = ref('')
const reviewState = computed(() => place.value ? getPlaceReviewState(place.value.id) : { status: 'idle' })
const statusLabel = computed(() => ({
  approved: '✅ 已发现',
  pending: '⏳ 审核中',
  appealed: '↻ 申诉复核中',
  rejected: '⚠️ 未通过，可重新打卡',
}[reviewState.value.status] || '🔒 未发现'))
const heroStatusText = computed(() => ({
  pending: '隐藏地点 · 照片审核中',
  appealed: '隐藏地点 · 申诉复核中',
  rejected: '隐藏地点 · 上次审核未通过',
}[reviewState.value.status] || '隐藏地点 · 尚未发现'))
const actionLabel = computed(() => {
  if (isPlaceChecked(place.value?.id)) return '在地图中查看'
  if (reviewState.value.status === 'pending') return '照片审核中，请耐心等待'
  if (reviewState.value.status === 'appealed') return '申诉复核中'
  if (checking.value) return '正在提交…'
  return reviewState.value.status === 'rejected' ? '重新拍照打卡' : '立即打卡'
})

onMounted(() => {
  if (checkinFlow.isAuthed()) fetchUserProgress().catch(() => {})
})

async function onStartCheckin(p) {
  // 已解锁：仅在地图中定位查看
  if (isPlaceChecked(p.id)) {
    router.push({ path: '/map', query: { placeId: p.id } })
    return
  }

  // 共享拍照打卡流程：拍照→上传→审核
  if (!checkinFlow.isAuthed()) {
    checkinFlow.pushOrRedirect('/signin', route, router)
    return
  }

  if (checking.value) return
  checking.value = true
  try {
    await checkinFlow.runCheckin({
      locationId: backendLocationId.value,
      onError: (reason) => {
        if (reason === 'unauthorized') {
          checkinFlow.pushOrRedirect('/signin', route, router)
        }
      },
      // 提交成功后只进入待审核状态；审核通过后才算发现地点并计分。
      onSubmitted: async () => {
        try { await fetchUserProgress() } catch (e) { /* 忽略刷新异常 */ }
      },
    })
  } finally {
    checking.value = false
  }
}

async function submitAppeal() {
  const reason = appealReason.value.trim()
  appealError.value = reason.length < 4 ? '请填写至少 4 个字符的申诉说明' : ''
  if (appealError.value || appealing.value || !place.value) return
  appealing.value = true
  try {
    await appealCheckin(place.value.id, reason)
    appealReason.value = ''
  } catch (error) {
    appealError.value = error?.message || '申诉提交失败，请稍后重试'
  } finally {
    appealing.value = false
  }
}

function goList() {
  router.push('/hidden-checkpoints')
}
</script>

<style scoped>
.hd-shell {
  min-height: 100vh;
  background: linear-gradient(180deg, #0f2e2a 0%, #14403a 100%);
  color: #eaf3ee;
  box-sizing: border-box;
  padding-bottom: 28px;
}
.hd-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 14px 10px;
  position: sticky;
  top: 0;
  background: rgba(15, 46, 42, 0.92);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  z-index: 10;
}
.icon-btn {
  width: 40px; height: 40px;
  display: flex; align-items: center; justify-content: center;
  border: none; border-radius: 50%;
  background: rgba(255,255,255,0.12);
  color: #eaf3ee;
  cursor: pointer;
}
.icon-btn:active { background: rgba(255,255,255,0.2); }
.header-title h1 { margin: 0; font-size: 19px; font-weight: 700; }
.header-title span {
  font-size: 11px;
  color: rgba(234,243,238,0.6);
  letter-spacing: 0.5px;
}

.hd-content { padding: 14px 14px 0; }
.hd-hero {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: 16px;
  overflow: hidden;
  background: #0f2e2a;
  box-shadow: 0 12px 30px rgba(0,0,0,0.3);
}
.hd-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.hd-mask {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 10px;
  background: rgba(8, 24, 22, 0.55);
}
.hd-lock { font-size: 40px; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.4)); }
.hd-mask-text { font-size: 13px; color: rgba(234,243,238,0.85); }
.hd-found-badge {
  position: absolute;
  top: 12px; right: 12px;
  background: rgba(23,92,40,0.92);
  color: #fff;
  font-size: 12px; font-weight: 700;
  padding: 5px 12px;
  border-radius: 999px;
}

.hd-info { padding: 16px 4px 0; }
.hd-name { font-size: 22px; font-weight: 700; margin-bottom: 12px; }
.hd-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
.hd-tag {
  font-size: 12px; font-weight: 700;
  padding: 5px 12px; border-radius: 999px;
}
.hd-tag.status.found { background: rgba(23,92,40,0.25); color: #7ee2a0; }
.hd-tag.status.locked { background: rgba(154,107,31,0.22); color: #e6b863; }

.review-feedback {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  gap: 10px;
  margin: 0 0 18px;
  padding: 13px 14px;
  border: 1px solid rgba(199, 242, 74, .22);
  border-radius: 14px;
  color: #dff7d8;
  background: rgba(199, 242, 74, .08);
}
.review-feedback--rejected { border-color: rgba(255, 153, 132, .3); color: #ffd5cc; background: rgba(169, 45, 31, .16); }
.review-feedback strong { display: block; font-size: 14px; }
.review-feedback p { margin: 4px 0 0; color: rgba(234, 243, 238, .72); font-size: 13px; line-height: 1.55; }

.hd-block { margin-bottom: 20px; }
.hd-label {
  margin: 0 0 8px;
  font-size: 12px; font-weight: 700;
  letter-spacing: 0.5px;
  color: rgba(234,243,238,0.65);
}
/* 富文本网页预览样式 */
.hd-richtext {
  margin: 0;
  font-size: 14px;
  line-height: 1.85;
  color: rgba(234,243,238,0.9);
  word-break: break-word;
}
.hd-richtext :deep(p) {
  margin: 0 0 12px;
}
.hd-richtext :deep(strong) {
  color: #ffe7a8;
  font-weight: 700;
}
.hd-richtext :deep(ul) {
  margin: 0 0 12px;
  padding-left: 20px;
}
.hd-richtext :deep(li) {
  margin-bottom: 6px;
  list-style: disc;
}
.hd-richtext :deep(em) {
  font-style: italic;
  color: rgba(234,243,238,0.78);
}

.hd-action {
  width: 100%;
  border: none;
  background: linear-gradient(90deg, #175c28, #1f8f4a);
  color: #fff;
  font-size: 15px; font-weight: 700;
  padding: 14px;
  border-radius: 999px;
  cursor: pointer;
}
.hd-action:active { transform: scale(0.98); }
.hd-action:disabled { cursor: wait; opacity: .58; filter: saturate(.55); }

.appeal-form { display: grid; gap: 9px; margin-top: 14px; padding: 15px; border: 1px solid rgba(255, 255, 255, .13); border-radius: 16px; background: rgba(255, 255, 255, .055); }
.appeal-form label { font-size: 13px; font-weight: 700; }
.appeal-form textarea { width: 100%; resize: vertical; border: 1px solid rgba(255, 255, 255, .16); border-radius: 11px; padding: 11px 12px; color: #fff; background: rgba(4, 22, 19, .55); font: inherit; line-height: 1.55; }
.appeal-form textarea:focus-visible { outline: 2px solid #c7f24a; outline-offset: 2px; }
.appeal-form > div { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.appeal-form small { color: rgba(234, 243, 238, .55); }.appeal-form small.error { color: #ffb4a5; }
.appeal-form button { min-height: 38px; display: inline-flex; align-items: center; gap: 7px; padding: 0 14px; border-radius: 999px; color: #0f2e2a; background: #c7f24a; font-weight: 800; }
.appeal-form button:disabled { opacity: .55; }

.hd-empty {
  padding: 60px 20px;
  text-align: center;
  color: rgba(234,243,238,0.7);
}
.hd-back-link {
  margin-top: 14px;
  border: none;
  background: rgba(255,255,255,0.14);
  color: #eaf3ee;
  padding: 10px 20px;
  border-radius: 999px;
  cursor: pointer;
}
</style>
