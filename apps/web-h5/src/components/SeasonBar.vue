<template>
  <aside class="season-bar" aria-label="活动期">
    <label v-if="seasons.list.length > 1">活动期
      <select :value="seasons.selected" @change="selectSeason($event.target.value)">
        <option v-for="item in seasons.list" :key="item.seasonId" :value="item.seasonId">{{ item.name }}</option>
      </select>
    </label>
    <span v-if="seasons.config?.readOnly" class="season-readonly">{{ seasons.config.status === 'archived' ? '往届归档 · 只读' : '活动已截止' }}</span>
    <span v-else>{{ seasons.config?.name }}</span>
    <RouterLink to="/seasons">我的活动记录</RouterLink>
  </aside>
</template>
<script setup>
import { seasons, selectSeason } from '@/stores/seasons'
</script>
<style scoped>
.season-bar{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:8px 16px;padding:10px 16px;background:#edf3ee;color:#244c3c;border-bottom:1px solid #d7e2d9;font-size:13px;position:relative;z-index:2}
label{display:flex;align-items:center;gap:8px}select{max-width:210px;border:1px solid #bdcec1;border-radius:6px;padding:6px 8px;background:#fff;color:inherit;font:inherit}.season-readonly{color:#6b624b}a{color:#244c3c;text-underline-offset:3px}select:focus-visible,a:focus-visible{outline:2px solid #244c3c;outline-offset:3px}
</style>
