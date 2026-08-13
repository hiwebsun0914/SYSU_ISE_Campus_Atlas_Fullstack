<template>
  <div class="home-shell">
    <a class="skip-link" href="#main-content">跳到主要内容</a>

    <header class="site-header" aria-label="网站页眉">
      <a class="brand" href="https://ise.sysu.edu.cn/" target="_blank" rel="noopener" aria-label="打开中山大学智能工程学院官网">
        <span class="brand-logo">
          <img src="https://ise.sysu.edu.cn/sites/default/files/logo-ise-w.png" alt="" />
        </span>
      </a>

      <nav class="desktop-nav" aria-label="桌面端主要导航">
        <RouterLink to="/" aria-current="page">首页</RouterLink>
        <RouterLink to="/map">校园地图</RouterLink>
        <button type="button" @click="goProtected('/myCheckins')">我的主页</button>
      </nav>
    </header>

    <main id="main-content" class="home-main" tabindex="-1">
      <section class="intro-row" aria-labelledby="page-title">
        <div>
          <p class="eyebrow"><span></span> SYSU · ISE / 2026</p>
          <h1 id="page-title">
            <span>Hi，新同学。</span>
            <span>欢迎来到智工！</span>
          </h1>
        </div>
        <p class="intro-copy">探索校园路线，解锁人格测试、作品投稿与未来寄语，在这里开启你的智工新生活。</p>
      </section>

      <section class="dashboard-grid" aria-label="迎新活动与校园探索">
        <article class="explore-card grid-item">
          <div class="map-grid" aria-hidden="true"></div>
          <div class="coordinate coordinate-top">23.0961° N</div>
          <div class="coordinate coordinate-side">113.2970° E</div>

          <div class="explore-head">
            <span class="icon-tile icon-tile-accent"><MapPinned :size="24" aria-hidden="true" /></span>
            <div>
              <p class="card-kicker">MAP ROUTES · 新生路线</p>
              <h2>从一条新生路线认识校园</h2>
            </div>
          </div>

          <div v-if="loading" class="progress-skeleton" aria-label="正在加载路线进度">
            <span></span><span></span><span></span>
          </div>

          <div v-else class="progress-content">
            <div class="progress-number">
              <span>{{ completedCount }}</span><small>/ {{ totalCount }} 站</small>
            </div>
            <p>{{ selectedRoute.name }} · 路线进度 {{ progressPercent }}%</p>

            <div class="route-progress-list" aria-label="选择要查看的路线进度">
              <button
                v-for="summary in routeSummaries"
                :key="summary.route.id"
                type="button"
                :class="['route-progress-option', { active: summary.route.id === selectedRoute.id }]"
                :aria-pressed="summary.route.id === selectedRoute.id"
                @click="selectRoute(summary.route.id)"
              >
                <span class="route-progress-meta">
                  <strong>{{ summary.route.name }}</strong>
                  <small>{{ summary.completed }}/{{ summary.total }} · {{ summary.percent }}%</small>
                </span>
                <span
                  class="route-progress-track"
                  role="progressbar"
                  :aria-label="`${summary.route.name}路线进度`"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  :aria-valuenow="summary.percent"
                >
                  <i :style="{ '--progress-scale': summary.percent / 100 }"></i>
                </span>
              </button>
            </div>

            <div v-if="nextLocation" class="next-stop">
              <Navigation :size="18" aria-hidden="true" />
              <span><small>下一站</small><strong>{{ nextLocation.name }}</strong></span>
              <em>{{ nextLocationMeta }}</em>
            </div>
            <div v-else class="next-stop next-stop-complete">
              <MapPinned :size="18" aria-hidden="true" />
              <span><small>路线状态</small><strong>这条路线已经全部打卡</strong></span>
            </div>
          </div>

          <div class="explore-actions explore-meta">
            <RouterLink class="primary-action" :to="primaryMapTarget">
              {{ primaryActionLabel }}
              <MapPinned :size="19" aria-hidden="true" />
            </RouterLink>
            <RouterLink class="text-action" to="/map">打开完整地图</RouterLink>
          </div>
        </article>

        <button class="feature-card future-card grid-item" type="button" @click="goProtected('/future-card')">
          <span class="feature-top">
            <span class="icon-tile"><Send :size="22" aria-hidden="true" /></span>
            <span class="coming-label">立即进入</span>
          </span>
          <span class="feature-copy">
            <small>TO FUTURE ME / 四年后见</small>
            <strong>给未来的自己留一张坐标</strong>
            <span>写下此刻的期盼，在毕业时重新打开</span>
          </span>
          <span class="future-year" aria-hidden="true">2030</span>
        </button>

        <button class="feature-card award-card grid-item" type="button" @click="goProtected('/award')" aria-label="进入奖项投稿页面">
          <span class="feature-top">
            <span class="icon-tile"><Sparkles :size="22" aria-hidden="true" /></span>
            <span class="coming-label">立即投稿</span>
          </span>
          <span class="feature-copy">
            <small>CHECK-IN GALLERY / 打卡作品投稿</small>
            <strong>最佳创意奖 · 最佳摄影奖</strong>
            <span>上传你的创意与摄影作品，赢取属于你的校园高光时刻</span>
          </span>
          <span class="award-chips" aria-hidden="true">
            <span>💡 创意</span>
            <span>📷 摄影</span>
          </span>
        </button>

        <button class="feature-card test-card grid-item" type="button" aria-label="进入 PLACE 校园人格测试" @click="router.push('/place')">
          <span class="feature-top">
            <span class="icon-tile icon-tile-dark"><ScanFace :size="23" aria-hidden="true" /></span>
            <span class="coming-label coming-label-dark">立即进入</span>
          </span>
          <span class="feature-copy">
            <small>PLACE / 校园人格</small>
            <strong>测测你的校园人格类型</strong>
            <span>从 28 个选择里找到你的校园人格与探索偏好</span>
          </span>
          <span class="scan-line" aria-hidden="true"></span>
        </button>

      </section>

      <footer class="site-footer">
        <span>中山大学智能工程学院 · 2026 级迎新</span>
        <span class="footer-code">SYSU / ISE / 2026</span>
      </footer>
    </main>

  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  MapPinned, Navigation, ScanFace,
  Send, Sparkles,
} from '@lucide/vue'
import { CATEGORY_MAP, getPlaceById } from '@/data/campusPlaces'
import routes from '@/data/routes'
import { checkedSet, fetchUserProgress, getRouteCheckedCount } from '@/stores/userProgress'

const router = useRouter()
const loading = ref(false)
const selectedRouteId = ref(null)

function routeProgress(route) {
  const total = route?.points?.length || 0
  const completed = route ? getRouteCheckedCount(route.id) : 0
  return {
    completed,
    total,
    percent: total ? Math.min(100, Math.round((completed / total) * 100)) : 0,
  }
}

const routeSummaries = computed(() => routes.map((route, index) => ({
  route,
  index,
  ...routeProgress(route),
})))
const allRoutesComplete = computed(() => routeSummaries.value.every(item => item.total > 0 && item.completed >= item.total))
const recommendedRouteSummary = computed(() => {
  const incomplete = routeSummaries.value.filter(item => item.completed < item.total)
  if (!incomplete.length) return routeSummaries.value.at(-1)
  return [...incomplete].sort((a, b) => b.percent - a.percent || a.index - b.index)[0]
})
const selectedRouteSummary = computed(() => (
  routeSummaries.value.find(item => item.route.id === selectedRouteId.value)
  || recommendedRouteSummary.value
))
const selectedRoute = computed(() => selectedRouteSummary.value?.route || routes[0])
const completedCount = computed(() => selectedRouteSummary.value?.completed || 0)
const totalCount = computed(() => selectedRouteSummary.value?.total || 0)
const progressPercent = computed(() => selectedRouteSummary.value?.percent || 0)
const nextLocation = computed(() => {
  if (allRoutesComplete.value) return null
  for (const placeId of selectedRoute.value?.points || []) {
    const place = getPlaceById(placeId)
    if (place && place.isHidden !== 1 && !checkedSet.value.has(place.id) && !checkedSet.value.has(place.backendId)) return place
  }
  return null
})
const nextLocationMeta = computed(() => {
  if (!nextLocation.value) return ''
  const category = CATEGORY_MAP[nextLocation.value.category]?.label
  return [category, nextLocation.value.position].filter(Boolean).join(' · ')
})
const primaryActionLabel = computed(() => {
  if (allRoutesComplete.value) return '继续逛校园地图'
  if (completedCount.value >= totalCount.value) return '打开完整地图'
  return completedCount.value ? '继续探索' : '在地图中开始'
})
const primaryMapTarget = computed(() => {
  if (allRoutesComplete.value || !nextLocation.value) return '/map'
  return {
    path: '/map',
    query: { route: selectedRoute.value.id, place: nextLocation.value.id },
  }
})

function selectRoute(routeId) {
  selectedRouteId.value = routeId
}

function isAuthed() {
  return Boolean(localStorage.getItem('token'))
}

async function loadDashboard() {
  if (!isAuthed()) {
    loading.value = false
    return
  }
  loading.value = true
  try {
    await fetchUserProgress()
  } catch (error) {
    console.warn('[Home] fetchUserProgress failed, using local route fallback:', error)
  } finally {
    loading.value = false
  }
}

function goProtected(path) {
  if (isAuthed()) router.push(path)
  else router.push({ path: '/signin', query: { redirect: path } })
}

onMounted(() => {
  document.title = '2026 新生迎新｜中山大学智能工程学院'
  loadDashboard()
})
</script>

<style scoped>
.home-shell {
  --ink: #0a2e3b;
  --primary: #0d9488;
  --primary-dark: #08766d;
  --accent: #c7f24a;
  --canvas: #f3f7f5;
  --surface: #fff;
  --text: #102a2e;
  --muted: #5e7271;
  --border: #d6e4df;
  min-height: 100dvh;
  color: var(--text);
  background:
    linear-gradient(rgba(10, 46, 59, .035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(10, 46, 59, .035) 1px, transparent 1px),
    var(--canvas);
  background-size: 32px 32px;
  overflow-x: clip;
  padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px));
}

.skip-link { position: fixed; z-index: 2000; top: 8px; left: 8px; padding: 10px 14px; color: #fff; background: var(--ink); border-radius: 10px; transform: translateY(-150%); }
.skip-link:focus { transform: translateY(0); }

.site-header { width: min(calc(100% - 24px), 1240px); min-height: 72px; display: flex; align-items: center; gap: 10px; margin: calc(12px + env(safe-area-inset-top, 0px)) auto 0; padding: 11px 14px; border: 1px solid rgba(214,228,223,.68); border-radius: 14px; background: rgba(243,247,245,.56); box-shadow: 0 16px 42px rgba(10,46,59,.06), inset 0 1px 0 rgba(255,255,255,.62); backdrop-filter: blur(20px) saturate(1.22); position: relative; z-index: 30; }
.brand { display: inline-flex; align-items: center; min-width: 0; text-decoration: none; color: var(--ink); }
.brand-logo { width: min(260px, 72vw); height: 44px; display: flex; align-items: center; }
.brand-logo img { display: block; width: 100%; max-height: 100%; object-fit: contain; object-position: left center; filter: brightness(0) saturate(100%) invert(15%) sepia(28%) saturate(1349%) hue-rotate(146deg) brightness(90%) contrast(96%); }
.desktop-nav { display: none; }

.home-main { width: min(100% - 32px, 1240px); margin: 0 auto; outline: none; }
.intro-row { padding: 46px 0 30px; display: grid; gap: 20px; }
.eyebrow, .card-kicker, .feature-copy small { margin: 0; font-family: "SFMono-Regular", Menlo, monospace; letter-spacing: 0; text-transform: uppercase; }
.eyebrow { display: flex; align-items: center; gap: 9px; font-size: 11px; color: var(--primary-dark); font-weight: 700; opacity: 0; animation: fade-lift .34s cubic-bezier(.2,.75,.25,1) .04s forwards; }
.eyebrow span { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 3px var(--ink); animation: node-breathe 2.8s ease-in-out .7s infinite; }
.intro-row h1 { margin: 12px 0 0; color: var(--ink); font-family: "DIN Alternate", "Avenir Next", "Noto Sans SC", sans-serif; font-size: clamp(35px, 8vw, 72px); line-height: .98; letter-spacing: 0; overflow: hidden; }
.intro-row h1 span { display: block; opacity: 0; transform: translateY(110%) skewY(2deg); animation: title-line-in .62s cubic-bezier(.16,1,.3,1) forwards; will-change: transform, opacity; }
.intro-row h1 span:nth-child(2) { animation-delay: .12s; }
.intro-copy { max-width: 430px; margin: 0; color: var(--muted); font-size: 16px; line-height: 1.7; opacity: 0; transform: translateY(14px); animation: fade-lift .48s cubic-bezier(.2,.75,.25,1) .28s forwards; }

.dashboard-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
.grid-item { opacity: 0; animation: card-arrive .38s cubic-bezier(.2,.75,.25,1) .18s forwards; }
.grid-item:nth-child(2) { animation-delay: 220ms; }.grid-item:nth-child(3) { animation-delay: 260ms; }.grid-item:nth-child(4) { animation-delay: 300ms; }.grid-item:nth-child(5) { animation-delay: 340ms; }
@keyframes card-arrive { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes fade-lift { to { opacity: 1; transform: none; } }
@keyframes title-line-in { to { opacity: 1; transform: translateY(0) skewY(0); } }
@keyframes node-breathe { 50% { transform: scale(1.28); opacity: .72; } }
@keyframes map-drift { 50% { transform: translate3d(-10px, 6px, 0); } }
@keyframes route-fill { from { transform: scaleX(0); } to { transform: scaleX(var(--progress-scale, 0)); } }
@keyframes scan-sweep { 50% { opacity: .35; transform: translateY(-5px); } }

.explore-card, .feature-card { border: 1px solid var(--border); border-radius: 24px; position: relative; overflow: hidden; }
.explore-card { min-height: 510px; padding: 24px; background: var(--ink); color: #fff; box-shadow: 0 22px 50px rgba(10,46,59,.16); }
.map-grid { position: absolute; inset: -16px; opacity: .2; background-image: linear-gradient(rgba(255,255,255,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.16) 1px,transparent 1px); background-size: 44px 44px; mask-image: linear-gradient(to bottom, #000, transparent 86%); animation: map-drift 8s ease-in-out infinite; }
.map-grid::after { content: ""; position: absolute; width: 310px; height: 210px; right: -80px; top: 80px; border: 1px solid rgba(199,242,74,.65); border-radius: 48% 52% 61% 39%; transform: rotate(-18deg); box-shadow: 0 0 0 28px rgba(199,242,74,.04),0 0 0 56px rgba(199,242,74,.025); }
.coordinate { position: absolute; z-index: 1; font-family: "SFMono-Regular", Menlo, monospace; font-size: 9px; color: rgba(255,255,255,.45); letter-spacing: 0; }
.coordinate-top { right: 22px; top: 19px; }.coordinate-side { right: -25px; bottom: 100px; transform: rotate(90deg); }
.explore-head, .explore-actions, .progress-content, .progress-skeleton { position: relative; z-index: 2; }
.explore-head { display: flex; align-items: flex-start; gap: 13px; padding-right: 35px; }
.icon-tile { width: clamp(38px, 5.5vw, 46px); height: clamp(38px, 5.5vw, 46px); flex: 0 0 clamp(38px, 5.5vw, 46px); display: grid; place-items: center; border: 1px solid var(--border); border-radius: 14px 5px 14px 5px; background: #eef5f2; color: var(--ink); }
.icon-tile svg, .feature-card svg, .desktop-nav svg, .explore-actions svg { width: 1.35em; height: 1.35em; }
.icon-tile-accent { background: var(--accent); border-color: var(--accent); }.icon-tile-dark { background: var(--ink); color: var(--accent); border-color: var(--ink); }
.card-kicker { font-size: 10px; color: rgba(255,255,255,.58); }
.explore-head h2 { max-width: 460px; margin: 6px 0 0; font-size: clamp(24px, 6vw, 39px); line-height: 1.1; letter-spacing: 0; }
.progress-content { margin-top: 64px; }
.progress-number { display: flex; align-items: baseline; gap: 8px; }
.progress-number span { color: var(--accent); font-family: "DIN Alternate", "Avenir Next", sans-serif; font-size: clamp(64px, 19vw, 104px); font-weight: 800; line-height: .8; letter-spacing: 0; }
.progress-number small { font-family: "SFMono-Regular", Menlo, monospace; font-size: 12px; color: rgba(255,255,255,.6); }
.progress-content > p { margin: 15px 0 12px; color: rgba(255,255,255,.74); font-size: 14px; }
.route-progress-list { display: grid; gap: 7px; }
.route-progress-option { width: 100%; min-height: 52px; display: grid; gap: 8px; padding: 9px 11px; border: 1px solid rgba(255,255,255,.12); border-radius: 12px; color: #fff; background: rgba(255,255,255,.055); text-align: left; transition: border-color .2s ease, background .2s ease, transform .2s ease; }
.route-progress-option:hover { background: rgba(255,255,255,.09); }.route-progress-option:active { transform: scale(.99); }.route-progress-option:focus-visible { outline: 3px solid rgba(199,242,74,.42); outline-offset: 2px; }
.route-progress-option.active { border-color: rgba(199,242,74,.72); background: rgba(199,242,74,.11); }
.route-progress-meta { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }.route-progress-meta strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }.route-progress-meta small { flex: 0 0 auto; color: rgba(255,255,255,.58); font-family: "SFMono-Regular", Menlo, monospace; font-size: 10px; }.route-progress-option.active .route-progress-meta strong,.route-progress-option.active .route-progress-meta small { color: var(--accent); }
.route-progress-track { height: 4px; position: relative; display: block; overflow: hidden; background: rgba(255,255,255,.16); border-radius: 999px; }.route-progress-track i { position: absolute; inset: 0; transform: scaleX(var(--progress-scale,0)); transform-origin: left; background: var(--accent); border-radius: inherit; transition: transform .42s cubic-bezier(.2,.75,.25,1); animation: route-fill .7s cubic-bezier(.2,.75,.25,1) .16s both; }
.next-stop { min-height: 60px; display: grid; grid-template-columns: 24px minmax(0,1fr); align-items: center; gap: 10px; margin-top: 22px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,.12); }
.next-stop span { display: grid; min-width: 0; }.next-stop small { color: rgba(255,255,255,.52); font-size: 11px; }.next-stop strong { margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.next-stop em { display: none; color: rgba(255,255,255,.52); font-size: 11px; font-style: normal; }
.next-stop-complete strong { color: var(--accent); }
.explore-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
.primary-action, .text-action { min-height: 48px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border-radius: 999px; text-decoration: none; font-weight: 800; }
.primary-action { padding: 0 19px; background: var(--accent); color: var(--ink); }.text-action { padding: 0 8px; color: #fff; }
.progress-skeleton { margin-top: 78px; display: grid; gap: 14px; }.progress-skeleton span { display: block; height: 18px; border-radius: 10px; background: rgba(255,255,255,.12); animation: pulse 1.2s ease-in-out infinite; }.progress-skeleton span:first-child { height: 70px; width: 45%; }.progress-skeleton span:nth-child(2) { width: 75%; }
@keyframes pulse { 50% { opacity: .42; } }

.feature-card { width: 100%; min-height: 250px; display: flex; flex-direction: column; padding: 20px; text-align: left; text-decoration: none; color: var(--text); background: var(--surface); transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease; }
.feature-card::before { content: ""; position: absolute; inset: 0; pointer-events: none; opacity: 0; transform: translateY(10px); background: linear-gradient(135deg, rgba(199,242,74,.16), transparent 42%); transition: opacity .24s ease, transform .24s ease; }
.feature-card:hover, .feature-card:focus-visible { transform: translateY(-3px); box-shadow: 0 18px 48px rgba(10,46,59,.08); border-color: #b8cfca; }
.feature-card:hover::before, .feature-card:focus-visible::before { opacity: 1; transform: none; }.feature-card:active { transform: scale(.99); }
.feature-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.feature-copy { display: grid; margin-top: 24px; position: relative; z-index: 2; }
.feature-copy small { color: var(--primary-dark); font-size: 9px; font-weight: 800; }
.feature-copy strong { margin-top: 8px; color: var(--ink); font-size: 21px; line-height: 1.25; letter-spacing: 0; }
.feature-copy > span { margin-top: 9px; color: var(--muted); font-size: 14px; line-height: 1.55; }
.coming-label { min-height: 30px; display: inline-flex; align-items: center; padding: 0 10px; border: 1px solid var(--border); border-radius: 999px; color: var(--primary-dark); background: #f5faf8; font-size: 11px; font-weight: 800; }
.coming-label-dark { border-color: rgba(255,255,255,.23); color: var(--accent); background: rgba(255,255,255,.07); }
.future-card { background: #e8f4ef; }.future-year { position: absolute; right: -7px; bottom: -25px; font-family: "DIN Alternate", sans-serif; font-size: 76px; font-weight: 900; color: rgba(10,46,59,.06); letter-spacing: 0; transition: transform .24s ease, opacity .24s ease; }.future-card:hover .future-year { transform: translateY(-4px); opacity: .86; }
.award-card { background: linear-gradient(135deg, #f4f0fa, #eef4ff); }.award-chips { display: flex; gap: 8px; margin-top: auto; padding-top: 18px; }.award-chips span { padding: 7px 14px; border-radius: 999px; background: #fff; border: 1px solid #e2d7f5; color: #6d28d9; font-size: 13px; font-weight: 700; }
.test-card { color: #fff; background: var(--primary); border-color: var(--primary); }.test-card .feature-copy small { color: rgba(255,255,255,.66); }.test-card .feature-copy strong { color: #fff; }.test-card .feature-copy > span { color: rgba(255,255,255,.75); }.scan-line { position: absolute; left: 20px; right: 20px; bottom: 18px; height: 1px; background: repeating-linear-gradient(90deg,var(--accent) 0 18px,transparent 18px 26px); opacity: .75; }
.test-card:hover .scan-line { animation: scan-sweep 1.1s ease-in-out infinite; }
.site-footer { min-height: 90px; display: flex; flex-direction: column; justify-content: center; gap: 5px; border-top: 1px solid var(--border); color: var(--muted); font-size: 12px; }.footer-code { font-family: "SFMono-Regular", Menlo, monospace; color: var(--primary-dark); letter-spacing: 0; }

@media (min-width: 700px) {
  .site-header { padding-inline: 20px; gap: 16px; }
  .brand-logo { width: 300px; height: 48px; }
  .home-main { width: min(100% - 48px,1240px); }.intro-row { grid-template-columns: 1.35fr .65fr; align-items: end; padding: 64px 0 38px; }.dashboard-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }.explore-card { grid-column: span 2; }.feature-card { min-height: 270px; }.next-stop { grid-template-columns: 24px minmax(0,1fr) auto; }.next-stop em { display: block; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.site-footer { flex-direction: row; align-items: center; justify-content: space-between; }
}

@media (min-width: 1024px) {
  .home-shell { padding-bottom: 0; }.site-header { min-height: 78px; padding: 12px 18px; }.brand-logo { width: 320px; height: 50px; }.desktop-nav { margin-left: auto; display: flex; align-items: center; gap: 4px; }.desktop-nav a,.desktop-nav button { min-height: 44px; display: inline-flex; align-items: center; padding: 0 14px; border-radius: 999px; color: var(--muted); text-decoration: none; font-size: 14px; font-weight: 700; }.desktop-nav a:hover,.desktop-nav button:hover,.desktop-nav a[aria-current="page"] { color: var(--ink); background: #e6efeb; }
  .dashboard-grid { grid-template-columns: repeat(12,minmax(0,1fr)); grid-auto-rows: minmax(132px,auto); gap: 16px; }.explore-card { grid-column: span 7; grid-row: span 4; min-height: 596px; padding: 30px; }.future-card,.award-card { grid-column: span 5; grid-row: span 2; min-height: 290px; }.test-card { grid-column: span 12; grid-row: span 2; min-height: 290px; }.test-card .feature-copy { max-width: 620px; }.progress-content { margin-top: 82px; }.feature-card { padding: 24px; }.feature-copy { margin-top: 26px; }
}

@media (max-width: 480px) {
  .site-header { padding: 9px 12px; }.brand-logo { width: min(220px, 68vw); height: 40px; }.home-main { width: min(100% - 24px, 1240px); }.intro-row { padding: 30px 0 22px; }.intro-row h1 { font-size: clamp(30px, 10vw, 44px); }.intro-copy { font-size: 14px; }
  .explore-card { min-height: 0; padding: 20px; }
  .progress-content { margin-top: 30px; }
  .progress-number span { font-size: clamp(56px, 17vw, 72px); }
  .progress-content > p { margin: 12px 0 10px; }
  .route-progress-option { min-height: 46px; gap: 6px; padding: 8px 10px; }
  .next-stop { min-height: 52px; margin-top: 16px; padding-top: 12px; }
  .explore-actions { margin-top: 18px; }
  .feature-card { padding: 16px; }
  .future-card,
  .test-card { min-height: 205px; }
  .award-card { min-height: 220px; }
  .feature-copy { margin-top: 16px; }.feature-copy strong { font-size: 18px; }.feature-copy > span { font-size: 13px; }.icon-tile { width: 38px; height: 38px; flex-basis: 38px; }.award-chips { padding-top: 14px; }.award-chips span { font-size: 11px; padding: 6px 11px; }.scan-line { bottom: 14px; }
  .site-footer { padding: 0 4px; }
}

@media (hover:hover) {
  .primary-action:hover { background: #d4ff55; }.text-action:hover { color: var(--accent); }
}

@media (prefers-reduced-motion: reduce) {
  .eyebrow,.intro-copy,.grid-item,.intro-row h1 span,.progress-skeleton span { opacity: 1; transform: none; animation: none; }.map-grid,.eyebrow span,.route-progress-track i,.scan-line { animation: none; }.route-progress-track i,.route-progress-option,.feature-card,.feature-card::before,.future-year { transition: none; }
}
</style>
