<!-- src/pages/HiddenCheckpoints.vue -->
<template>
  <div class="hc-shell">
    <header class="hc-header">
      <button class="icon-btn" type="button" aria-label="返回" @click="router.back()">
        <ArrowLeft :size="22" />
      </button>
      <div class="header-title">
        <h1>隐藏打卡点</h1>
        <span>HIDDEN CHECKPOINTS · 已发现 {{ foundCount }} / {{ hiddenPlaces.length }}</span>
      </div>
    </header>

    <main class="hc-content">
      <div class="hc-grid">
        <button
          v-for="place in hiddenPlaces"
          :key="place.id"
          type="button"
          class="hc-card"
          :class="isPlaceChecked(place.id) ? 'is-found' : 'is-locked'"
          @click="onOpenDetail(place)"
        >
          <div class="hc-thumb">
            <img
              class="hc-img"
              :src="place.image"
              :alt="place.name"
              loading="lazy"
              draggable="false"
            />
            <div v-if="!isPlaceChecked(place.id)" class="hc-mask">
              <span class="hc-lock">🔒</span>
            </div>
            <span v-else class="hc-found-badge">✅</span>
          </div>

          <div class="hc-body">
            <div class="hc-name">{{ place.name }}</div>
            <div class="hc-meta">
              <span
                class="hc-status"
                :class="isPlaceChecked(place.id) ? 'found' : 'locked'"
              >{{ isPlaceChecked(place.id) ? '已发现' : '🔒未发现' }}</span>
            </div>
          </div>
        </button>

        <p v-if="!hiddenPlaces.length" class="hc-empty">暂无隐藏打卡点</p>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft } from '@lucide/vue'
import { campusLocations } from '@/data/campusPlaces'
import { isPlaceChecked } from '@/stores/userProgress'

document.title = '隐藏打卡点'

const router = useRouter()

// 所有隐藏打卡点（isHidden = 1）均来自 campusPlaces，不单独维护数据
const hiddenPlaces = computed(() =>
  campusLocations.filter(place => place.isHidden === 1)
)

const foundCount = computed(() =>
  hiddenPlaces.value.filter(p => isPlaceChecked(p.id)).length
)

// 点击卡片进入详情页（介绍在详情页展示）
function onOpenDetail(place) {
  router.push({ path: '/hidden-checkpoints/' + place.id })
}
</script>

<style scoped>
.hc-shell {
  min-height: 100vh;
  background: linear-gradient(180deg, #0f2e2a 0%, #14403a 100%);
  color: #eaf3ee;
  box-sizing: border-box;
  padding-bottom: 24px;
}
.hc-header {
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
.header-title h1 {
  margin: 0;
  font-size: 19px;
  font-weight: 700;
}
.header-title span {
  font-size: 11px;
  color: rgba(234,243,238,0.6);
  letter-spacing: 0.5px;
}

.hc-content { padding: 12px 14px 0; }

/* 响应式网格：移动端 2 列 / 平板 3 列 / 桌面 4 列 */
.hc-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
@media (min-width: 600px) {
  .hc-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (min-width: 900px) {
  .hc-grid { grid-template-columns: repeat(4, 1fr); }
}

/* 小卡片：图片 + 名称 + 等级 + 状态 */
.hc-card {
  display: flex;
  flex-direction: column;
  padding: 0;
  border: none;
  background: rgba(255,255,255,0.96);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 4px 14px rgba(0,0,0,0.22);
  color: #1a2b27;
  cursor: pointer;
  text-align: left;
  transition: transform 0.14s ease, box-shadow 0.18s ease;
}
.hc-card:hover { box-shadow: 0 10px 24px rgba(0,0,0,0.32); }
.hc-card:active { transform: scale(0.96); }

.hc-thumb {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  background: #0f2e2a;
  overflow: hidden;
}
.hc-img {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
}
.hc-mask {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(8, 24, 22, 0.5);
}
.hc-lock { font-size: 26px; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.4)); }
.hc-found-badge {
  position: absolute;
  top: 6px; right: 6px;
  background: rgba(23,92,40,0.92);
  color: #fff;
  font-size: 11px;
  width: 20px; height: 20px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
}

.hc-body { padding: 8px 10px 10px; }
.hc-name {
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hc-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.hc-status {
  font-size: 11px;
  font-weight: 700;
}
.hc-status.found { color: #1f8f4a; }
.hc-status.locked { color: #9a6b1f; }

.is-found { border: 1px solid rgba(23,92,40,0.35); }

.hc-empty {
  grid-column: 1 / -1;
  text-align: center;
  color: rgba(234,243,238,0.6);
  font-size: 14px;
  margin-top: 32px;
}
</style>
