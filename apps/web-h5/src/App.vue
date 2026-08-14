<template>
  <RouterView />
  <MobilePrimaryNav v-if="showPrimaryNav" />
</template>
<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import MobilePrimaryNav from '@/components/MobilePrimaryNav.vue'

const route = useRoute()
const primaryRoutes = new Set(['/', '/map', '/myCheckins', '/points-rank'])
const showPrimaryNav = computed(() => primaryRoutes.has(route.path))
</script>
<style>
@import "@/styles/global.css";
</style>
