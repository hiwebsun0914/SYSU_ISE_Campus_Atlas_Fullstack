<template>
  <div class="route-panel-wrapper">
    <!-- 隐藏打卡点入口（位于推荐路线上方） -->
    <button
      class="extra-fab"
      @click="onHiddenClick"
      title="隐藏打卡点"
    >
      隐藏打卡点
    </button>
    <!-- 收起态浮动按钮 -->
    <button
      v-if="!expanded"
      class="route-fab"
      @click="expanded = true"
      title="推荐路线"
    >
      推荐路线
    </button>

    <!-- 展开面板 -->
    <div
      v-if="expanded"
      class="route-panel-overlay"
      aria-hidden="true"
      @click="expanded = false"
    ></div>
    <aside v-if="expanded" class="route-panel">
      <div class="route-panel-header">
        <span class="route-panel-title">推荐路线</span>
        <button @click="expanded = false" title="收起">✕</button>
      </div>
      <ul class="route-list">
        <li
          v-for="route in routes"
          :key="route.id"
        >
          <button
            class="route-card"
            :class="{ 'route-card--active': selectedRouteId === route.id }"
            @click="onCardClick(route)"
          >
            <span class="route-icon">{{ route.icon }}</span>
            <span class="route-body">
              <span class="route-name">{{ route.name }}</span>
              <span class="route-desc">{{ route.description }}</span>
              <span class="route-meta">
                {{ route.points?.length || 0 }}个地点 · {{ getRouteProgress(route.id) }}/{{ route.points?.length || 0 }}
              </span>

              <!-- 进度条 -->
              <span class="route-progress-bar">
                <span
                  class="route-progress-fill"
                  :style="{ width: routeProgressPercent(route) + '%' }"
                />
              </span>

              <!-- 下一目标 / 已完成 -->
              <span
                v-if="routeProgressPercent(route) >= 100"
                class="route-next-target route-next-target--completed"
              >✅ 已完成</span>
              <span
                v-else-if="getNextTarget(route.id, route.points)"
                class="route-next-target"
              >下一目标：{{ getNextTarget(route.id, route.points)?.name }}</span>
            </span>
            <span
              class="route-start"
              title="开始探索"
              @click.stop="onStartClick(route)"
            >▶</span>
          </button>
        </li>
      </ul>

      <!-- 当前探索进度卡片 -->
      <div v-if="isExploring && exploringRouteId" class="route-progress-card">
        <span class="route-progress-icon">🚩</span>
        <span class="route-progress-body">
          <span class="route-progress-name">{{ exploringRouteName }}</span>
          <span class="route-progress-step">{{ currentStepText }}</span>
        </span>
      </div>
    </aside>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import routes from '../data/routes.js'
import { getRouteProgress, getNextTarget, currentStepText, isExploring } from '@/stores/routeCheckin'

const props = defineProps({
  selectedRouteId: { type: String, default: null },
  exploringRouteId: { type: String, default: null },
})

const emit = defineEmits(['route-select', 'start-explore', 'open-hidden'])

const expanded = ref(false)

const exploringRouteName = computed(() => {
  return routes.find(r => r.id === props.exploringRouteId)?.name ?? ''
})

function routeProgressPercent(route) {
  const total = route.points?.length || 0
  if (total === 0) return 0
  const done = getRouteProgress(route.id)
  return Math.min(100, Math.round((done / total) * 100))
}

function onCardClick(route) {
  // 点击已选中路线：取消选中
  if (props.selectedRouteId === route.id) {
    emit('route-select', null)
  } else {
    emit('route-select', route)
  }
}

function onStartClick(route) {
  emit('start-explore', route)
}

function onHiddenClick() {
  emit('open-hidden')
}
</script>

<style scoped>
.route-panel-wrapper {
  position: absolute;
  left: 12px;
  top: 64px;
  z-index: 15;
  max-height: 60vh;
}

/* ---- 移动端点击外部收起的透明遮罩 ---- */
.route-panel-overlay {
  display: none;
}

@media (max-width: 899px) {
  .route-panel-overlay {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 0;
    background: transparent;
    -webkit-tap-highlight-color: transparent;
  }
}

/* ---- 隐藏打卡点入口浮动按钮（位于推荐路线上方） ---- */
.extra-fab {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  padding: 0 16px;
  border-radius: 20px;
  background: #ffffff;
  box-shadow: 0 2px 14px rgba(0, 0, 0, 0.12);
  border: none;
  font-size: 14px;
  font-weight: 600;
  color: #0a2e3b;
  white-space: nowrap;
  cursor: pointer;
  transition: box-shadow 0.18s ease;
  outline: none;
  -webkit-tap-highlight-color: transparent;
  margin-bottom: 10px;
}

.extra-fab:hover {
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.18);
}
/* ---- 收起态浮动按钮 ---- */
.route-fab {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  padding: 0 16px;
  border-radius: 20px;
  background: #ffffff;
  box-shadow: 0 2px 14px rgba(0, 0, 0, 0.12);
  border: none;
  font-size: 14px;
  font-weight: 600;
  color: #0a2e3b;
  white-space: nowrap;
  cursor: pointer;
  transition: box-shadow 0.18s ease;
  outline: none;
  -webkit-tap-highlight-color: transparent;
}

.route-fab:hover {
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.18);
}

/* ---- 展开面板 ---- */
.route-panel {
  position: relative;
  z-index: 1;
  width: 220px;
  max-height: 60vh;
  background: #ffffff;
  border-radius: 14px;
  box-shadow: 0 6px 28px rgba(0, 0, 0, 0.14);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.route-panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px 6px;
}

.route-panel-title {
  font-weight: 600;
  font-size: 15px;
  color: #0a2e3b;
}

.route-panel-header button {
  width: 26px;
  height: 26px;
  margin-left: 4px;
  border: none;
  background: #eef2f3;
  border-radius: 50%;
  font-size: 12px;
  color: #5a6b72;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  outline: none;
}

/* ---- 路线列表 ---- */
.route-list {
  list-style: none;
  margin: 0;
  padding: 8px 12px 10px;
  overflow-y: auto;
}

.route-card {
  width: 100%;
  border: 2px solid transparent;
  background: #f6f9f9;
  border-radius: 12px;
  padding: 6px 10px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  cursor: pointer;
  text-align: left;
  color: #0a2e3b;
  outline: none;
  -webkit-tap-highlight-color: transparent;
  transition: border-color 0.18s ease, background 0.18s ease;
  box-sizing: border-box;
}

.route-card:focus,
.route-card:focus-visible {
  outline: none;
  box-shadow: none;
}

.route-card + .route-card {
  margin-top: 36px;
}

.route-card:hover {
  background: #eef4f5;
}

.route-card--active {
  border-color: #388e6e;
  background: #e8f5e9;
}

.route-icon {
  font-size: 22px;
  flex-shrink: 0;
  line-height: 1;
  margin-top: 1px;
}

.route-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.route-name {
  font-size: 14px;
  font-weight: 600;
}

.route-desc {
  font-size: 12px;
  color: #63737b;
  margin-top: 3px;
}

.route-meta {
  font-size: 11px;
  color: #909ea5;
  margin-top: 4px;
}

.route-progress-bar {
  display: block;
  width: 100%;
  height: 5px;
  background: #e0e7e9;
  border-radius: 999px;
  margin-top: 8px;
  overflow: hidden;
}

.route-progress-fill {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #388e6e, #66bb6a);
  border-radius: 999px;
  transition: width 0.35s ease;
}

.route-next-target {
  display: block;
  font-size: 11px;
  color: #63737b;
  margin-top: 6px;
  line-height: 1.3;
}

.route-next-target--completed {
  color: #388e6e;
  font-weight: 600;
}

.route-start {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  margin-left: auto;
  align-self: center;
  border-radius: 50%;
  background: #388e6e;
  color: #fff;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.18s ease;
  -webkit-tap-highlight-color: transparent;
}

.route-start:hover {
  background: #2e755a;
}

/* ---- 当前探索进度卡片 ---- */
.route-progress-card {
  margin: 12px;
  margin-top: 0;
  border: 2px solid #388e6e;
  background: #e8f5e9;
  border-radius: 12px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  box-sizing: border-box;
}

.route-progress-icon {
  font-size: 22px;
  flex-shrink: 0;
}

.route-progress-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.route-progress-name {
  font-size: 13px;
  font-weight: 600;
  color: #0a2e3b;
}

.route-progress-step {
  font-size: 12px;
  color: #388e6e;
  font-weight: 600;
  margin-top: 2px;
}

/* Transition */
.route-panel-wrapper > .route-panel {
  animation: panel-in 0.22s ease-out;
}

@keyframes panel-in {
  from {
    opacity: 0;
    transform: translateX(-18px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>
