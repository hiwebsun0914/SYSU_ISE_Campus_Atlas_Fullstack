<template>
  <article v-if="place" class="checkin-card" :class="{ 'checkin-card--scroll-all': scrollAll }">
    <button class="checkin-close" type="button" @click="emit('close')">
      <X :size="20" />
    </button>

    <div class="checkin-scroll">
    <div
      class="checkin-cover"
      :style="coverStyle"
    >
      <div class="checkin-cover-overlay" />
      <img
        v-if="place.image && !imageError"
        :key="place.id"
        :src="place.image"
        :alt="place.name"
        class="checkin-cover-img"
        @error="imageError = true"
      >
      <div v-else class="checkin-cover-placeholder">
        <span class="checkin-cover-placeholder__text">{{ place.name?.[0] ?? '地' }}</span>
      </div>
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
        <span v-else-if="reviewState.status === 'pending'" class="checkin-status-tag">审核中</span>
        <span v-else-if="reviewState.status === 'appealed'" class="checkin-status-tag">申诉复核中</span>
        <span v-else-if="reviewState.status === 'rejected'" class="checkin-status-tag checkin-status-tag--rejected">上次未通过</span>
      </div>

      <h2 class="checkin-title">{{ place.name }}</h2>

      <div class="checkin-description" v-html="place.description || '<p>暂无描述</p>'" />

      <!-- 定位打卡状态区 -->
      <div v-if="!checked && !reviewPending && geoStatus !== 'idle'" class="checkin-geo-status">
        <!-- 定位中 -->
        <div v-if="geoStatus === 'locating'" class="checkin-geo-row checkin-geo-row--locating">
          <span class="checkin-geo-spinner" />
          <span>正在获取位置...</span>
        </div>

        <!-- 距离检测通过（等待用户点击拍照上传） -->
        <div v-if="geoStatus === 'success'" class="checkin-geo-row checkin-geo-row--ok">
          <span class="checkin-geo-icon">✅</span>
          <span>距离 {{ geoDistance }} 米，在打卡范围内{{ accuracyHint }}，请拍照上传</span>
        </div>

        <!-- 距离不足 -->
        <div v-if="geoStatus === 'too_far'" class="checkin-geo-row checkin-geo-row--warn">
          <span class="checkin-geo-icon">⚠️</span>
          <span>距离过远（{{ geoDistance }} 米），超出打卡范围（{{ geoRadius }} 米内可打卡）{{ accuracyHint }}</span>
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
          <button
            v-if="reviewPending"
            class="checkin-btn checkin-btn--locating"
            type="button"
            disabled
          >
            <Clock3 :size="18" />{{ reviewState.status === 'appealed' ? '申诉复核中' : '照片审核中' }}
          </button>
          <!-- 空闲 → 开始定位打卡 -->
          <button
            v-else-if="geoStatus === 'idle'"
            class="checkin-btn checkin-btn--primary"
            type="button"
            @click="emit('geo-checkin')"
          >
            <Camera :size="18" />定位并拍照打卡
          </button>

          <!-- 距离达标 → 拍照上传（真实点击触发，保证文件选择器能弹出） -->
          <button
            v-else-if="geoStatus === 'success'"
            class="checkin-btn"
            :class="photoBusy ? 'checkin-btn--locating' : 'checkin-btn--primary'"
            type="button"
            :disabled="photoBusy"
            @click="emit('photo-checkin')"
          >
            <template v-if="photoBusy"><span class="checkin-geo-spinner" />正在上传照片</template>
            <template v-else><Camera :size="18" />拍照上传</template>
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
    </div>
  </article>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Camera, Check, Clock3, X } from '@lucide/vue'
import { getPlaceReviewState, isPlaceChecked } from '@/stores/userProgress'

const props = defineProps({
  place: { type: Object, default: null },
  primaryLabel: { type: String, default: '' },
  /** 定位打卡状态：'idle' | 'locating' | 'too_far' | 'success' | 'error' */
  geoStatus: { type: String, default: 'idle' },
  /** 用户到目标地点的距离（米），保留一位小数 */
  geoDistance: { type: Number, default: null },
  /** 定位精度半径（米），未知为 null */
  geoAccuracy: { type: Number, default: null },
  /** 当前地点的打卡半径（米） */
  geoRadius: { type: Number, default: 50 },
  /** 拍照上传进行中（含选图与上传），禁用按钮防重复提交 */
  photoBusy: { type: Boolean, default: false },
  /** 定位失败信息 */
  geoError: { type: String, default: '' },
  /** 整体滚动模式：封面、名称、标签随内容一起滚动，打卡按钮跟随内容末尾（移动端手势底卡用） */
  scrollAll: { type: Boolean, default: false },
})

const emit = defineEmits(['geo-checkin', 'photo-checkin', 'close'])

const imageError = ref(false)

watch(() => props.place?.id, () => {
  imageError.value = false
})

/** 定位误差提示：精度已知且较差时追加展示，帮用户理解距离读数 */
const accuracyHint = computed(() => {
  const acc = Number(props.geoAccuracy)
  if (!Number.isFinite(acc) || acc <= 0) return ''
  return `（定位误差 ±${acc} 米）`
})

const checked = computed(() => props.place ? isPlaceChecked(props.place.id) : false)
const reviewState = computed(() => props.place ? getPlaceReviewState(props.place.id) : { status: 'idle' })
const reviewPending = computed(() => reviewState.value.status === 'pending' || reviewState.value.status === 'appealed')

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
  if (props.place?.image && !imageError.value) return {}
  return { background: '#e8f5e9' }
})
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

.checkin-scroll {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
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
  aspect-ratio: 16 / 10;
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
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 64px;
  font-weight: 700;
  color: #388e6e;
  background: #e8f5e9;
  z-index: 2;
}

.checkin-cover-placeholder__text {
  line-height: 1;
}

.checkin-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 12px 16px 16px;
  overflow-y: auto;
}

.checkin-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
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
.checkin-status-tag--rejected { background: #fce8e6; color: #b42318; }

.checkin-title {
  font-size: 20px;
  font-weight: 700;
  color: #0a2e3b;
  margin: 0 0 8px;
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

/* ---- 整体滚动模式（移动端手势底卡）：封面/名称/标签随内容滚动，按钮跟在内容末尾 ---- */
.checkin-card--scroll-all .checkin-scroll {
  display: block;
  overflow-y: auto;
}

.checkin-card--scroll-all .checkin-body {
  overflow-y: visible;
}

.checkin-card--scroll-all .checkin-description {
  flex: none;
  overflow-y: visible;
}

.checkin-card--scroll-all .checkin-actions {
  margin-top: 14px;
  padding-bottom: 4px;
}
</style>
