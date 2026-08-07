<template>
  <div class="point-display">
    <span class="point-icon">⭐</span>
    <span class="point-count">{{ points }}积分</span>
  </div>
</template>

<script setup>
import { points } from '@/stores/userProgress'
</script>

<style scoped>
.point-display {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: #ffffff;
  border-radius: 999px;
  box-shadow: 0 2px 14px rgba(0, 0, 0, 0.12);
  font-size: 14px;
  font-weight: 600;
  color: #0a2e3b;
}

.point-icon {
  font-size: 16px;
}

.point-count {
  white-space: nowrap;
}
</style>
