<template>
  <RouterView />
  <button v-if="showHomeButton" class="home-fab" type="button" aria-label="返回迎新首页" @click="goHome">
    <Home :size="18" aria-hidden="true" />
    <span>首页</span>
  </button>
</template>
<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Home } from '@lucide/vue'

const route = useRoute()
const router = useRouter()
const showHomeButton = computed(() => route.path !== '/')
function goHome() { router.push('/') }
</script>
<style>
@import "@/styles/global.css";
.home-fab {
  position: fixed;
  z-index: 12000;
  right: 14px;
  bottom: max(14px, env(safe-area-inset-bottom, 0px));
  min-width: 64px;
  min-height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 15px;
  border: 1px solid rgba(255,255,255,.18);
  border-radius: 999px;
  color: #fff;
  background: rgba(10,46,59,.94);
  box-shadow: 0 12px 34px rgba(10,46,59,.25);
  backdrop-filter: blur(10px);
  font-size: 13px;
  font-weight: 800;
}
.home-fab:active { transform: scale(.97); }
@media (min-width: 1024px) {
  .home-fab { right: 24px; bottom: 24px; }
}
</style>
