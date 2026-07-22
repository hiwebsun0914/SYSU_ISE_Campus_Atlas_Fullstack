<template>
  <RouterView />
  <button
    v-if="showHomeButton"
    class="home-fab"
    type="button"
    aria-label="返回首页"
    @click="goHome"
  >
    ← 首页
  </button>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const showHomeButton = computed(() => route.path !== '/')

function goHome() {
  if (route.path === '/') return
  router.push('/')
}
</script>

<style>
@import "@/styles/global.css";

html, body {
  font-family: "SimHei", "黑体", sans-serif !important;
}

.home-fab {
  position: fixed;
  top: calc(10px + var(--app-top-offset));
  left: 10px;
  z-index: 12000;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 17px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(255, 255, 255, 0.92);
  color: #0f172a;
  font-size: 13px;
  font-weight: 700;
  line-height: 34px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.16);
  backdrop-filter: blur(6px);
}

.home-fab:active {
  transform: translateY(1px);
}
</style>
