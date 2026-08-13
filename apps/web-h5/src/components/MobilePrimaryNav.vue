<template>
  <nav class="mobile-primary-nav" aria-label="移动端主要导航">
    <RouterLink to="/" :aria-current="route.path === '/' ? 'page' : undefined">
      <House :size="21" aria-hidden="true" />
      <span>首页</span>
    </RouterLink>
    <RouterLink to="/map" :aria-current="route.path === '/map' ? 'page' : undefined">
      <MapPinned :size="21" aria-hidden="true" />
      <span>地图</span>
    </RouterLink>
    <button
      type="button"
      :class="{ active: route.path === '/myCheckins' }"
      :aria-current="route.path === '/myCheckins' ? 'page' : undefined"
      @click="goToProfile"
    >
      <CircleUserRound :size="21" aria-hidden="true" />
      <span>我的</span>
    </button>
  </nav>
</template>

<script setup>
import { CircleUserRound, House, MapPinned } from '@lucide/vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

function goToProfile() {
  const path = '/myCheckins'
  if (localStorage.getItem('token')) router.push(path)
  else router.push({ path: '/signin', query: { redirect: path } })
}
</script>

<style scoped>
.mobile-primary-nav {
  position: fixed;
  z-index: 100;
  left: 12px;
  right: 12px;
  bottom: max(10px, env(safe-area-inset-bottom, 0px));
  height: 66px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding: 6px;
  border: 1px solid rgba(255, 255, 255, .65);
  border-radius: 20px;
  background: rgba(10, 46, 59, .94);
  box-shadow: 0 14px 40px rgba(10, 46, 59, .28);
  backdrop-filter: blur(14px);
}

.mobile-primary-nav a,
.mobile-primary-nav button {
  min-width: 0;
  min-height: 52px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  border-radius: 14px;
  color: rgba(255, 255, 255, .65);
  text-decoration: none;
  font-size: 10px;
}

.mobile-primary-nav :is(a, button)[aria-current="page"] {
  color: #c7f24a;
  background: rgba(255, 255, 255, .08);
}

@media (min-width: 1024px) {
  .mobile-primary-nav { display: none; }
}
</style>
