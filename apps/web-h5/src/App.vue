<template>
  <template v-if="seasons.ready"><SeasonBar /><RouterView /></template>
  <div v-else class="season-loading" role="status">{{ seasons.error || '正在读取活动期…' }}<button v-if="seasons.error" @click="boot">重试</button></div>
  <MobilePrimaryNav v-if="showPrimaryNav" />
  <DevResultPreview v-if="dev && previewable" />
</template>
<script setup>
import { onMounted } from 'vue'
import SeasonBar from '@/components/SeasonBar.vue'
import { seasons, ensureSeasons } from '@/stores/seasons'
const boot = () => ensureSeasons().catch(() => {})
onMounted(boot)

import { computed, defineAsyncComponent } from 'vue'
import { useRoute } from 'vue-router'
import MobilePrimaryNav from '@/components/MobilePrimaryNav.vue'
const DevResultPreview = import.meta.env.DEV
  ? defineAsyncComponent(() => import('@/components/DevResultPreview.vue'))
  : null

const route = useRoute()
const primaryRoutes = new Set(['/', '/map', '/myCheckins', '/points-rank'])
const showPrimaryNav = computed(() => primaryRoutes.has(route.path))
const previewable = computed(() => ['/points-rank', '/rank', '/award'].includes(route.path))
const dev = import.meta.env.DEV
</script>
<style>
@import "@/styles/global.css";

.season-loading{padding:48px 20px;text-align:center}.season-loading button{margin-left:12px}
</style>
