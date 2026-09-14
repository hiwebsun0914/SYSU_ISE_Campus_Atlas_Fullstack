<template>
  <RouterView />
  <MobilePrimaryNav v-if="showPrimaryNav" />
  <DevResultPreview v-if="dev && previewable" />
</template>
<script setup>
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
</style>
