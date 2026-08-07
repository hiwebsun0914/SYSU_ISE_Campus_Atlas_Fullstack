<template>
  <article v-if="place" class="checkin-card">
    <button class="checkin-close" type="button" @click="emit('close')">
      <X :size="20" />
    </button>

    <div
      class="checkin-cover"
      :style="coverStyle"
    >
      <div class="checkin-cover-overlay" />
      <img
        v-if="place.cover"
        :src="place.cover"
        :alt="place.name"
        class="checkin-cover-img"
        @error="onCoverError"
      >
      <div v-else class="checkin-cover-placeholder">{{ place.name?.[0] ?? '地' }}</div>
    </div>

    <div class="checkin-body">
      <div class="checkin-tags">
        <span class="checkin-category">{{ categoryLabel }}</span>
        <span
          v-for="tag in place.tags?.slice(0, 3)"
          :key="tag"
          class="checkin-tag"
        >{{ tag }}</span>
        <span v-if="checked" class="checkin-status-tag checkin-status-tag--checked">已打卡</span>
      </div>

      <h2 class="checkin-title">{{ place.name }}</h2>

      <div class="checkin-description" v-html="place.description || '<p>暂无描述</p>'" />

      <!-- 定位打卡状态区 -->
      <div v-if="!checked && geoStatus !== 'idle'" class="checkin-geo-status">
        <!-- 定位中 -->
        <div v-if="geoStatus === 'locating'" class="checkin-geo-row checkin-geo-row--locating">
          <span class="checkin-geo-spinner" />
          <span>正在获取位置...</span>
        </div>

        <!-- 距离检测通过（临时展示，马上完成打卡） -->
        <div v-if="geoStatus === 'success'" class="checkin-geo-row checkin-geo-row--ok">
          <span class="checkin-geo-icon">✅</span>
          <span>距离 {{ geoDistance }} 米，附近打卡</span>
        </div>

        <!-- 距离不足 -->
        <div v-if="geoStatus === 'too_far'" class="checkin-geo-row checkin-geo-row--warn">
          <span class="checkin-geo-icon">⚠️</span>
          <span>距离过远（{{ geoDistance }} 米），超出打卡范围</span>
        </div>

        <!-- 定位失败 -->
        <div v-if="geoStatus === 'error'" class="checkin-geo-row checkin-geo-row--error">
          <span class="checkin-geo-icon">❌</span>
          <span>{{ geoError || '定位失败，请检查位置权限' }}</span>
        </div>
      </div>

      <div class="checkin-actions">
        <!-- 未打卡：定位打卡流程 -->
        <template v-if="!checked">
          <!-- 空闲 → 开始定位打卡 -->
          <button
            v-if="geoStatus === 'idle' || geoStatus === 'success'"
            class="checkin-btn checkin-btn--primary"
            type="button"
            @click="emit('geo-checkin')"
          >
            <Camera :size="18" />开始定位打卡
          </button>

          <!-- 定位中 -->
          <button
            v-if="geoStatus === 'locating'"
            class="checkin-btn checkin-btn--locating"
            type="button"
            disabled
          >
            <span class="checkin-geo-spinner" />正在获取位置
          </button>

          <!-- 距离过远 / 定位失败：重新定位 -->
          <template v-if="geoStatus === 'too_far' || geoStatus === 'error'">
            <button
              class="checkin-btn checkin-btn--ghost"
              type="button"
              @click="emit('geo-checkin')"
            >
              重新定位
            </button>
          </template>
        </template>

        <!-- 已打卡 -->
        <button
          v-else
          class="checkin-btn checkin-btn--checked"
          type="button"
          disabled
        >
          <Check :size="18" />已打卡
        </button>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { Camera, Check, X } from '@lucide/vue'
import { isPlaceChecked } from '@/stores/userProgress'

const props = defineProps({
  place: { type: Object, default: null },
  primaryLabel: { type: String, default: '' },
  /** 定位打卡状态：'idle' | 'locating' | 'too_far' | 'success' | 'error' */
  geoStatus: { type: String, default: 'idle' },
  /** 用户到目标地点的距离（米），保留一位小数 */
  geoDistance: { type: Number, default: null },
  /** 定位失败信息 */
  geoError: { type: String, default: '' },
})

const emit = defineEmits(['geo-checkin', 'close'])

const checked = computed(() => props.place ? isPlaceChecked(props.place.id) : false)

const categoryLabel = computed(() => {
  const map = {
    landmark: '地标',
    study: '学习',
    life: '生活',
    scenery: '景观',
    sport: '运动',
    dorm: '宿舍',
    gate: '校门',
    canteen: '餐饮',
  }
  return map[props.place?.category] || '地点'
})

const coverStyle = computed(() => {
  if (props.place?.cover) return {}
  return { background: '#e8f5e9' }
})

function onCoverError(e) {
  e.target.style.display = 'none'
}
</script>

<style scoped>
.checkin-card {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-radius: 20px 20px 0 0;
  overflow: hidden;
}

.checkin-close {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 5;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  color: #5a6b72;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.checkin-cover {
  position: relative;
  width: 100%;
  height: 160px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #eef4f3;
}

.checkin-cover-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.25));
  z-index: 1;
}

.checkin-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.checkin-cover-placeholder {
  font-size: 64px;
  font-weight: 700;
  color: #388e6e;
  z-index: 2;
}

.checkin-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 16px;
  overflow-y: auto;
}

.checkin-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.checkin-category,
.checkin-tag,
.checkin-status-tag {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
}

.checkin-category {
  background: #388e6e;
  color: #fff;
}

.checkin-tag {
  background: #eef5f2;
  color: #63737b;
}

.checkin-status-tag {
  background: #fff3e0;
  color: #ff9800;
}

.checkin-status-tag--checked {
  background: #e8f5e9;
  color: #388e6e;
}

.checkin-title {
  font-size: 20px;
  font-weight: 700;
  color: #0a2e3b;
  margin: 0 0 10px;
}

.checkin-description {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  font-size: 15px;
  line-height: 1.7;
  color: #3d4f57;
}

.checkin-description :deep(p) {
  margin: 0 0 10px;
}

.checkin-description :deep(p:last-child) {
  margin-bottom: 0;
}

/* ---- 定位打卡状态区 ---- */
.checkin-geo-status {
  margin-top: 12px;
}

.checkin-geo-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
}

.checkin-geo-row--locating {
  background: #eef5ff;
  color: #1976d2;
}

.checkin-geo-row--ok {
  background: #e8f5e9;
  color: #2e7d32;
}

.checkin-geo-row--warn {
  background: #fff3e0;
  color: #e65100;
}

.checkin-geo-row--error {
  background: #fce4ec;
  color: #c62828;
}

.checkin-geo-icon {
  flex-shrink: 0;
  font-size: 16px;
}

.checkin-geo-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: geo-spin .6s linear infinite;
  flex-shrink: 0;
}

@keyframes geo-spin {
  to { transform: rotate(360deg); }
}

/* ---- 操作按钮 ---- */
.checkin-actions {
  display: flex;
  gap: 10px;
  padding-top: 14px;
  margin-top: auto;
}

.checkin-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 16px;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.18s ease, transform 0.1s ease;
}

.checkin-btn--primary {
  background: #388e6e;
  color: #fff;
}

.checkin-btn--primary:hover {
  background: #2e755a;
}

.checkin-btn--primary:active {
  transform: scale(0.98);
}

.checkin-btn--locating {
  background: #90a4ae;
  color: #fff;
  cursor: default;
}

.checkin-btn--checked {
  background: #e8f5e9;
  color: #388e6e;
  cursor: default;
}

.checkin-btn--ghost {
  flex: 0 0 auto;
  min-width: 90px;
  background: #eef2f3;
  color: #5a6b72;
}
</style>
