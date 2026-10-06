<template>
  <aside v-if="showExpiredNotice" class="season-bar" aria-label="活动期">
    <label v-if="seasons.list.length > 1">活动期
      <select :value="seasons.selected" @change="selectSeason($event.target.value)">
        <option v-for="item in seasons.list" :key="item.seasonId" :value="item.seasonId">{{ item.name }}</option>
      </select>
    </label>
    <span v-if="seasons.config?.readOnly" class="season-readonly">{{ seasons.config.status === 'archived' ? '往届归档 · 只读' : '活动已截止' }}</span>
    <span v-else>{{ seasons.config?.name }}</span>
  </aside>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { seasons, selectSeason } from '@/stores/seasons'
import { request } from '@/utils/request'

const route = useRoute()
const verifiedParticipant = ref(false)
// Check the account with the server; cached profile data and a token alone
// do not establish that this visitor belongs to an expired activity.
watch(() => route.fullPath, async (_path, _previous, onCleanup) => {
  verifiedParticipant.value = false
  let cancelled = false
  onCleanup(() => { cancelled = true })
  if (!localStorage.getItem('token')) return
  const response = await request('/auth/me', 'GET', null, { cacheBust: true })
  if (!cancelled && response.ok && response.data?.code === 0 && response.data?.userInfo) {
    verifiedParticipant.value = true
  }
}, { immediate: true })
const showExpiredNotice = computed(() => verifiedParticipant.value
  && seasons.ready
  && seasons.participantSeasonId === seasons.selected
  && Boolean(seasons.participantSeasonId)
  && seasons.config?.readOnly === true)
</script>
<style scoped>
.season-bar{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:8px 16px;padding:10px 16px;background:#edf3ee;color:#244c3c;border-bottom:1px solid #d7e2d9;font-size:13px;position:relative;z-index:2}
label{display:flex;align-items:center;gap:8px}select{max-width:210px;border:1px solid #bdcec1;border-radius:6px;padding:6px 8px;background:#fff;color:inherit;font:inherit}.season-readonly{color:#6b624b}select:focus-visible{outline:2px solid #244c3c;outline-offset:3px}
</style>
