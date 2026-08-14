<template>
  <main class="not-found">
    <div class="map-grid" aria-hidden="true"></div>

    <section class="error-card" aria-labelledby="not-found-title">
      <div class="error-code" aria-hidden="true">
        <span>4</span>
        <MapPin :size="54" stroke-width="1.7" />
        <span>4</span>
      </div>

      <p class="eyebrow">ROUTE NOT FOUND · 路线偏航</p>
      <h1 id="not-found-title">这里还没有校园坐标</h1>
      <p class="description">你访问的页面可能已移动或不存在。回到迎新首页，继续探索校园路线吧。</p>

      <div class="actions">
        <RouterLink class="primary-action" to="/">
          <House :size="18" aria-hidden="true" />
          返回首页
        </RouterLink>
        <RouterLink class="secondary-action" to="/map">
          打开校园地图
          <ArrowRight :size="18" aria-hidden="true" />
        </RouterLink>
      </div>
    </section>

    <p class="coordinate" aria-hidden="true">SYSU · ISE / 23.0961° N · 113.2970° E</p>
  </main>
</template>

<script setup>
import { onMounted } from 'vue'
import { ArrowRight, House, MapPin } from '@lucide/vue'

onMounted(() => {
  document.title = '页面未找到｜中山大学智能工程学院'
})
</script>

<style scoped>
.not-found {
  --ink: #0a2e3b;
  --accent: #c7f24a;
  min-height: 100dvh;
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: 28px 20px;
  color: #fff;
  background: var(--ink);
}

.map-grid {
  position: absolute;
  inset: -36px;
  opacity: .22;
  background-image:
    linear-gradient(rgba(255, 255, 255, .13) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, .13) 1px, transparent 1px);
  background-size: 42px 42px;
  transform: rotate(-4deg) scale(1.08);
  mask-image: radial-gradient(circle at center, #000 12%, transparent 72%);
}

.error-card {
  width: min(100%, 660px);
  position: relative;
  z-index: 1;
  padding: clamp(28px, 7vw, 58px);
  border: 1px solid rgba(255, 255, 255, .16);
  border-radius: 30px;
  background: rgba(255, 255, 255, .075);
  box-shadow: 0 32px 80px rgba(0, 0, 0, .24);
  backdrop-filter: blur(18px);
}

.error-code {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--accent);
  font-family: "Space Grotesk", "Avenir Next", sans-serif;
  font-size: clamp(76px, 22vw, 132px);
  font-weight: 800;
  line-height: .8;
  letter-spacing: -.08em;
}

.error-code svg { flex: 0 0 auto; filter: drop-shadow(0 10px 24px rgba(199, 242, 74, .18)); }
.eyebrow { margin: 34px 0 10px; color: var(--accent); font-family: "SFMono-Regular", Menlo, monospace; font-size: 11px; font-weight: 700; }
h1 { margin: 0; font-size: clamp(28px, 7vw, 48px); line-height: 1.12; letter-spacing: -.03em; }
.description { max-width: 510px; margin: 16px 0 0; color: rgba(255, 255, 255, .68); font-size: 15px; line-height: 1.75; }
.actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 30px; }
.actions a { min-height: 48px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0 18px; border-radius: 999px; color: #fff; text-decoration: none; font-weight: 800; }
.primary-action { color: var(--ink) !important; background: var(--accent); }
.secondary-action { border: 1px solid rgba(255, 255, 255, .2); background: rgba(255, 255, 255, .06); }
.coordinate { position: absolute; z-index: 1; right: 22px; bottom: max(18px, env(safe-area-inset-bottom)); margin: 0; color: rgba(255, 255, 255, .34); font-family: "SFMono-Regular", Menlo, monospace; font-size: 9px; }

@media (hover: hover) {
  .actions a { transition: transform .2s ease, background .2s ease; }
  .actions a:hover { transform: translateY(-2px); }
  .primary-action:hover { background: #d7ff63; }
  .secondary-action:hover { background: rgba(255, 255, 255, .12); }
}

@media (max-width: 480px) {
  .error-card { border-radius: 24px; }
  .error-code svg { width: 42px; height: 42px; }
  .actions { display: grid; }
}

@media (prefers-reduced-motion: reduce) {
  .actions a { transition: none; }
}
</style>
