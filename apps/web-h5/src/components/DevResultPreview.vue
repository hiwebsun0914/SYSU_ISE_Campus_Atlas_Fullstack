<template>
  <label class="result-preview">本地揭晓预览
    <select :value="previewMode" @change="setPreviewMode($event.target.value)">
      <option value="live">实时状态</option>
      <option value="sealed">普通用户 · 保密期</option>
      <option value="owner">超管 · 保密期</option>
      <option value="revealed">公布后</option>
    </select>
  </label>
</template>

<script setup>
import { previewMode, setPreviewMode } from '@/stores/resultReveal'
</script>

<style scoped>
.result-preview { position: fixed; right: 12px; bottom: 88px; z-index: 1000; display: grid; gap: 5px; padding: 8px 10px; border: 1px solid #0d9488; border-radius: 12px; background: #fff; color: #0a2e3b; font: 12px sans-serif; box-shadow: 0 8px 24px #092c2740; }
.result-preview select { max-width: 200px; color: #0a2e3b; }
</style>
