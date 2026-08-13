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
          <span class="hd-lock">🔒</span>
          <span class="hd-mask-text">隐藏地点 · 尚未发现</span>
        </div>
        <span v-else class="hd-found-badge">✅ 已发现</span>
      </div>

      <section class="hd-info">
        <div class="hd-name">{{ place.name }}</div>

        <div class="hd-tags">
          <span class="hd-tag status" :class="isPlaceChecked(place.id) ? 'found' : 'locked'">
            {{ isPlaceChecked(place.id) ? '✅ 已发现' : '🔒 未发现' }}
          </span>
        </div>

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
          @click="onStartCheckin(place)"
        >
          {{ isPlaceChecked(place.id) ? '在地图中查看' : '立即打卡' }}
        </button>
      </section>
    </main>

    <main v-else class="hd-empty">
      <p>未找到该隐藏打卡点</p>
      <button class="hd-back-link" type="button" @click="goList">返回列表</button>
    </main>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@lucide/vue'
import { campusLocations } from '@/data/campusPlaces'
import { isPlaceChecked, fetchUserProgress } from '@/stores/userProgress'
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
      // 提交成功后：刷新用户解锁状态（含隐藏地点），随后提示与触发故事
      onSubmitted: async () => {
        try { await fetchUserProgress() } catch (e) { /* 忽略刷新异常 */ }
        alert('恭喜发现隐藏地点！')
        // 触发隐藏故事：跳转至地图，由 Map 页面统一处理隐藏点故事
        router.replace({ path: '/map', query: { placeId: p.id, hiddenStory: '1' } })
      },
    })
  } finally {
    checking.value = false
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
