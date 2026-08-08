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
        <RouterLink to="/atlas">校园图鉴</RouterLink>
        <button type="button" @click="goProtected('/message')">留言互动</button>
        <button type="button" @click="goProtected('/myCheckins')">我的主页</button>
      </nav>
    </header>

    <main id="main-content" ref="mainContent" class="home-main" tabindex="-1">
      <section class="intro-row" aria-labelledby="page-title">
        <div>
          <p class="eyebrow"><span></span> SYSU · ISE / 2026</p>
          <h1 id="page-title">
            <span>你好，新同学。</span>
            <span>从认识校园开始。</span>
          </h1>
        </div>
        <p class="intro-copy">这里不是说明书，而是你的迎新行动地图。先找到第一站，再慢慢留下属于自己的大学坐标。</p>
      </section>

      <section class="dashboard-grid" aria-label="迎新活动与校园探索">
        <article class="explore-card grid-item">
          <div class="map-grid" aria-hidden="true"></div>
          <div class="coordinate coordinate-top">23.0961° N</div>
          <div class="coordinate coordinate-side">113.2970° E</div>

          <div class="explore-head">
            <span class="icon-tile icon-tile-accent"><MapPinned :size="24" aria-hidden="true" /></span>
            <div>
              <p class="card-kicker">CAMPUS ATLAS · 校园图鉴</p>
              <h2>{{ userInfo ? '继续你的校园探索' : '从第一处校园坐标出发' }}</h2>
            </div>
          </div>

          <div v-if="loading" class="progress-skeleton" aria-label="正在加载校园进度">
            <span></span><span></span><span></span>
          </div>

          <div v-else-if="loadError" class="load-error" role="alert">
            <WifiOff :size="22" aria-hidden="true" />
            <div><strong>校园数据暂时没有抵达</strong><span>{{ loadError }}</span></div>
            <button type="button" @click="loadDashboard">重试</button>
          </div>

          <div v-else class="progress-content">
            <div class="progress-number">
              <span>{{ completedCount }}</span><small>/ {{ totalCount || '—' }} 站</small>
            </div>
            <p>{{ totalCount ? `已完成 ${progressPercent}%` : '打卡点正在整理中' }}</p>
            <div class="route-progress" role="progressbar" aria-label="校园打卡完成进度" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="progressPercent">
              <span :style="{ '--progress-scale': progressPercent / 100 }"></span>
              <i class="route-start"></i><i class="route-end"></i>
            </div>
            <div v-if="nextLocation" class="next-stop">
              <Navigation :size="18" aria-hidden="true" />
              <span><small>建议下一站</small><strong>{{ nextLocation.name }}</strong></span>
              <em>{{ nextLocation.position || `地点 ${nextLocation.id}` }}</em>
            </div>
          </div>

          <div class="explore-actions explore-meta">
            <span class="primary-action">
              {{ completedCount ? '下一站已定位' : '第一站已定位' }}
              <MapPinned :size="19" aria-hidden="true" />
            </span>
            <RouterLink class="text-action" to="/rank">
              <Trophy :size="18" aria-hidden="true" />查看排行榜
            </RouterLink>
          </div>
        </article>

        <button class="feature-card profile-card grid-item" type="button" @click="goProtected('/myCheckins')" aria-label="进入个人主页，查看迎新档案">
          <span class="feature-top">
            <span class="icon-tile"><CircleUserRound :size="23" aria-hidden="true" /></span>
            <span class="status-chip">档案同步 <ArrowUpRight :size="15" aria-hidden="true" /></span>
          </span>
          <span class="feature-copy">
            <small>PROFILE SNAPSHOT / 迎新档案</small>
            <strong>{{ userInfo ? `${userInfo.username} 的迎新档案` : '迎新档案等待登录' }}</strong>
            <span>个人信息、徽章与全部打卡记录</span>
          </span>
          <span class="profile-stats">
            <span><b>{{ completedCount }}</b> 已解锁</span>
            <span><b>{{ pendingCount }}</b> 审核中</span>
          </span>
        </button>

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
          <span class="award-spark" aria-hidden="true">✦</span>
        </button>

        <button class="feature-card test-card grid-item" type="button" aria-label="进入 PLACE 校园人格测试" @click="router.push('/place')">
          <span class="feature-top">
            <span class="icon-tile icon-tile-dark"><ScanFace :size="23" aria-hidden="true" /></span>
            <span class="coming-label coming-label-dark">立即进入</span>
          </span>
          <span class="feature-copy">
            <small>PLACE @ SYSU / 校园人格</small>
            <strong>测测你的校园类型</strong>
            <span>从 28 个选择里找到你的校园人格与今日去处</span>
          </span>
          <span class="scan-line" aria-hidden="true"></span>
        </button>

        <button class="feature-card message-card grid-item" type="button" @click="goProtected('/message')" aria-label="进入留言互动页面">
          <span class="feature-top">
            <span class="icon-tile"><MessageCircleMore :size="23" aria-hidden="true" /></span>
            <span class="status-chip">互动开放 <ArrowUpRight :size="15" aria-hidden="true" /></span>
          </span>
          <span class="feature-copy">
            <small>MESSAGE BOARD / 漂流瓶状态</small>
            <strong>今天也有人在校园里留言</strong>
            <span>分享照片与一句话，也许会被新朋友捞到</span>
          </span>
          <span class="message-route" aria-hidden="true"><i></i><i></i><i></i></span>
        </button>
      </section>

      <section class="utility-row" aria-labelledby="utility-title">
        <div>
          <p class="section-index">SUPPORT / 反馈入口</p>
          <h2 id="utility-title">需要帮助时</h2>
          <p class="support-copy">账号、打卡或页面内容异常，可以直接把问题交给维护同学处理。</p>
        </div>
        <div class="utility-links">
          <RouterLink to="/connect"><LifeBuoy :size="20" aria-hidden="true" /><span><strong>问题反馈</strong><small>遇到问题，告诉维护同学</small></span><ChevronRight :size="19" aria-hidden="true" /></RouterLink>
        </div>
      </section>

      <footer class="site-footer">
        <span>中山大学智能工程学院 · 2026 级迎新</span>
        <span class="footer-code">SYSU / ISE / GZ</span>
      </footer>
    </main>

    <nav class="mobile-nav" aria-label="移动端主要导航">
      <RouterLink to="/" aria-current="page"><House :size="21" aria-hidden="true" /><span>首页</span></RouterLink>
      <RouterLink to="/atlas"><Map :size="21" aria-hidden="true" /><span>图鉴</span></RouterLink>
      <button type="button" @click="goProtected('/message')"><MessageCircleMore :size="21" aria-hidden="true" /><span>互动</span></button>
      <button type="button" @click="goProtected('/myCheckins')"><CircleUserRound :size="21" aria-hidden="true" /><span>我的</span></button>
    </nav>

    <Transition name="toast">
      <div v-if="toastMessage" class="coming-toast" role="status" aria-live="polite">
        <Clock3 :size="20" aria-hidden="true" />
        <span><strong>{{ toastMessage }}</strong>正在认真筹备中，开放后会在这里通知你。</span>
        <button type="button" aria-label="关闭提示" @click="toastMessage = ''"><X :size="18" aria-hidden="true" /></button>
      </div>
    </Transition>

    <Transition name="welcome">
      <div v-if="welcomeVisible" class="welcome-layer" role="presentation" @mousedown.self="dismissWelcome">
        <section ref="welcomeDialog" class="welcome-dialog" role="dialog" aria-modal="true" aria-labelledby="welcome-title" aria-describedby="welcome-desc" @keydown="handleDialogKeydown">
          <button class="dialog-close" type="button" aria-label="关闭欢迎窗口" @click="dismissWelcome"><X :size="20" aria-hidden="true" /></button>
          <div class="welcome-logo-wrap">
            <img src="https://sysuzngcxy-1322240898.cos.ap-guangzhou.myqcloud.com/logo1.png" alt="校园图鉴活动标志" />
          </div>
          <p class="welcome-code">WELCOME · CLASS OF 2026</p>
          <h2 id="welcome-title">欢迎来到<br />智能工程学院</h2>
          <p id="welcome-desc">新的坐标已经点亮。愿你从校园的第一站出发，找到自己的方向、伙伴与四年答案。</p>
          <button ref="welcomeEnter" class="welcome-enter" type="button" @click="dismissWelcome">
            进入迎新站 <ArrowRight :size="19" aria-hidden="true" />
          </button>
          <div class="welcome-coordinate" aria-hidden="true">23°05′46″N<br />113°17′49″E</div>
        </section>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowRight, ArrowUpRight, ChevronRight, CircleUserRound, Clock3, House,
  LifeBuoy, Map, MapPinned, MessageCircleMore, Navigation, ScanFace,
  Send, Sparkles, Trophy, WifiOff, X,
} from '@lucide/vue'
import { request } from '@/utils/request'

const WELCOME_KEY = 'ise-welcome-2026-v1'
const router = useRouter()
const mainContent = ref(null)
const welcomeDialog = ref(null)
const welcomeEnter = ref(null)
const welcomeVisible = ref(false)
const toastMessage = ref('')
const loading = ref(true)
const loadError = ref('')
const userInfo = ref(null)
const locations = ref([])
const unlockedLocations = ref([])
const lockingLocations = ref([])
let toastTimer = 0

const totalCount = computed(() => locations.value.length)
const completedCount = computed(() => unlockedLocations.value.length)
const pendingCount = computed(() => lockingLocations.value.length)
const progressPercent = computed(() => totalCount.value ? Math.min(100, Math.round((completedCount.value / totalCount.value) * 100)) : 0)
const nextLocation = computed(() => {
  const unlocked = new Set(unlockedLocations.value.map(Number))
  const locking = new Set(lockingLocations.value.map(Number))
  return locations.value.find(item => !unlocked.has(Number(item.id)) && !locking.has(Number(item.id))) || null
})

function isAuthed() {
  return Boolean(localStorage.getItem('token'))
}

async function loadDashboard() {
  loading.value = true
  loadError.value = ''
  try {
    const locationsRequest = request('/locations', 'GET', null, { credentials: 'include' })
    const authRequests = isAuthed()
      ? Promise.all([
          request('/auth/me', 'GET', null, { credentials: 'include' }),
          request('/checkin/status', 'GET', null, { credentials: 'include' }),
        ])
      : Promise.resolve([null, null])

    const [locationsResponse, [meResponse, statusResponse]] = await Promise.all([locationsRequest, authRequests])
    const locationList = locationsResponse?.data?.data?.locations || locationsResponse?.data?.locations
    if (!locationsResponse?.ok || !Array.isArray(locationList)) throw new Error('请检查网络后再试一次')
    locations.value = locationList

    if (meResponse?.data?.code === 0) userInfo.value = meResponse.data.userInfo || null
    if (statusResponse?.data?.code === 0) {
      unlockedLocations.value = statusResponse.data.unlockedLocations || []
      lockingLocations.value = statusResponse.data.lockingLocations || []
    }
  } catch (error) {
    loadError.value = error?.message || '请稍后重新加载'
  } finally {
    loading.value = false
  }
}

function goProtected(path) {
  if (isAuthed()) router.push(path)
  else router.push({ path: '/signin', query: { redirect: path } })
}

function showComingSoon(name) {
  window.clearTimeout(toastTimer)
  toastMessage.value = name
  toastTimer = window.setTimeout(() => { toastMessage.value = '' }, 5000)
}

function dismissWelcome() {
  try { localStorage.setItem(WELCOME_KEY, 'seen') } catch {}
  welcomeVisible.value = false
  nextTick(() => mainContent.value?.focus())
}

function handleDialogKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault()
    dismissWelcome()
    return
  }
  if (event.key !== 'Tab') return
  const focusable = welcomeDialog.value?.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])') || []
  if (!focusable.length) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(welcomeVisible, visible => {
  document.body.classList.toggle('dialog-open', visible)
})

onMounted(() => {
  document.title = '2026 新生迎新｜中山大学智能工程学院'
  loadDashboard()
  try { welcomeVisible.value = localStorage.getItem(WELCOME_KEY) !== 'seen' } catch { welcomeVisible.value = true }
  if (welcomeVisible.value) nextTick(() => welcomeEnter.value?.focus())
})

onBeforeUnmount(() => {
  window.clearTimeout(toastTimer)
  document.body.classList.remove('dialog-open')
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

.site-header { width: min(calc(100% - 24px), 1240px); min-height: 72px; display: flex; align-items: center; gap: 10px; margin: 12px auto 0; padding: 11px 14px; border: 1px solid rgba(214,228,223,.68); border-radius: 14px; background: rgba(243,247,245,.56); box-shadow: 0 16px 42px rgba(10,46,59,.06), inset 0 1px 0 rgba(255,255,255,.62); backdrop-filter: blur(20px) saturate(1.22); position: relative; z-index: 30; }
.brand { display: inline-flex; align-items: center; min-width: 0; text-decoration: none; color: var(--ink); }
.brand-logo { width: min(260px, 72vw); height: 44px; display: flex; align-items: center; }
.brand-logo img { display: block; width: 100%; max-height: 100%; object-fit: contain; object-position: left center; filter: brightness(0) saturate(100%) invert(15%) sepia(28%) saturate(1349%) hue-rotate(146deg) brightness(90%) contrast(96%); }
.desktop-nav { display: none; }

.home-main { width: min(100% - 32px, 1240px); margin: 0 auto; outline: none; }
.intro-row { padding: 46px 0 30px; display: grid; gap: 20px; }
.eyebrow, .card-kicker, .section-index, .feature-copy small { margin: 0; font-family: "SFMono-Regular", Menlo, monospace; letter-spacing: 0; text-transform: uppercase; }
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
@keyframes route-node { 50% { transform: scale(1.2); opacity: .74; } }
@keyframes scan-sweep { 50% { opacity: .35; transform: translateY(-5px); } }
@keyframes message-pulse { 50% { opacity: .45; transform: scaleX(.78); } }

.explore-card, .feature-card { border: 1px solid var(--border); border-radius: 24px; position: relative; overflow: hidden; }
.explore-card { min-height: 510px; padding: 24px; background: var(--ink); color: #fff; box-shadow: 0 22px 50px rgba(10,46,59,.16); }
.map-grid { position: absolute; inset: -16px; opacity: .2; background-image: linear-gradient(rgba(255,255,255,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.16) 1px,transparent 1px); background-size: 44px 44px; mask-image: linear-gradient(to bottom, #000, transparent 86%); animation: map-drift 8s ease-in-out infinite; }
.map-grid::after { content: ""; position: absolute; width: 310px; height: 210px; right: -80px; top: 80px; border: 1px solid rgba(199,242,74,.65); border-radius: 48% 52% 61% 39%; transform: rotate(-18deg); box-shadow: 0 0 0 28px rgba(199,242,74,.04),0 0 0 56px rgba(199,242,74,.025); }
.coordinate { position: absolute; z-index: 1; font-family: "SFMono-Regular", Menlo, monospace; font-size: 9px; color: rgba(255,255,255,.45); letter-spacing: 0; }
.coordinate-top { right: 22px; top: 19px; }.coordinate-side { right: -25px; bottom: 100px; transform: rotate(90deg); }
.explore-head, .explore-actions, .progress-content, .progress-skeleton, .load-error { position: relative; z-index: 2; }
.explore-head { display: flex; align-items: flex-start; gap: 13px; padding-right: 35px; }
.icon-tile { width: 46px; height: 46px; flex: 0 0 46px; display: grid; place-items: center; border: 1px solid var(--border); border-radius: 14px 5px 14px 5px; background: #eef5f2; color: var(--ink); }
.icon-tile-accent { background: var(--accent); border-color: var(--accent); }.icon-tile-dark { background: var(--ink); color: var(--accent); border-color: var(--ink); }
.card-kicker { font-size: 10px; color: rgba(255,255,255,.58); }
.explore-head h2 { max-width: 460px; margin: 6px 0 0; font-size: clamp(24px, 6vw, 39px); line-height: 1.1; letter-spacing: 0; }
.progress-content { margin-top: 64px; }
.progress-number { display: flex; align-items: baseline; gap: 8px; }
.progress-number span { color: var(--accent); font-family: "DIN Alternate", "Avenir Next", sans-serif; font-size: clamp(64px, 19vw, 104px); font-weight: 800; line-height: .8; letter-spacing: 0; }
.progress-number small { font-family: "SFMono-Regular", Menlo, monospace; font-size: 12px; color: rgba(255,255,255,.6); }
.progress-content > p { margin: 15px 0 12px; color: rgba(255,255,255,.74); font-size: 14px; }
.route-progress { height: 5px; position: relative; background: rgba(255,255,255,.17); border-radius: 10px; }
.route-progress span { position: absolute; inset: 0; transform: scaleX(var(--progress-scale, 0)); transform-origin: left; background: var(--accent); border-radius: inherit; transition: transform .42s cubic-bezier(.2,.75,.25,1); animation: route-fill .7s cubic-bezier(.2,.75,.25,1) .22s both; }
.route-progress i { width: 13px; height: 13px; position: absolute; top: -4px; border: 3px solid var(--ink); border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.route-start { left: 0; animation: route-node 2.6s ease-in-out .9s infinite; }.route-end { right: 0; animation: route-node 2.6s ease-in-out 1.2s infinite; }
.next-stop { min-height: 60px; display: grid; grid-template-columns: 24px minmax(0,1fr); align-items: center; gap: 10px; margin-top: 22px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,.12); }
.next-stop span { display: grid; min-width: 0; }.next-stop small { color: rgba(255,255,255,.52); font-size: 11px; }.next-stop strong { margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.next-stop em { display: none; color: rgba(255,255,255,.52); font-size: 11px; font-style: normal; }
.explore-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
.primary-action, .text-action { min-height: 48px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border-radius: 999px; text-decoration: none; font-weight: 800; }
.primary-action { padding: 0 19px; background: var(--accent); color: var(--ink); }.text-action { padding: 0 8px; color: #fff; }
.explore-meta .primary-action { cursor: default; pointer-events: none; }
.progress-skeleton { margin-top: 78px; display: grid; gap: 14px; }.progress-skeleton span { display: block; height: 18px; border-radius: 10px; background: rgba(255,255,255,.12); animation: pulse 1.2s ease-in-out infinite; }.progress-skeleton span:first-child { height: 70px; width: 45%; }.progress-skeleton span:nth-child(2) { width: 75%; }
@keyframes pulse { 50% { opacity: .42; } }
.load-error { margin-top: 72px; padding: 18px; display: grid; grid-template-columns: 30px 1fr; gap: 10px; border: 1px solid rgba(255,255,255,.18); border-radius: 16px; background: rgba(255,255,255,.07); }.load-error div { display: grid; gap: 4px; }.load-error span { color: rgba(255,255,255,.64); font-size: 13px; }.load-error button { grid-column: 2; width: max-content; min-height: 44px; padding: 0 16px; border-radius: 999px; background: var(--accent); color: var(--ink); font-weight: 800; }

.feature-card { width: 100%; min-height: 250px; display: flex; flex-direction: column; padding: 20px; text-align: left; color: var(--text); background: var(--surface); transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease; }
.feature-card::before { content: ""; position: absolute; inset: 0; pointer-events: none; opacity: 0; transform: translateY(10px); background: linear-gradient(135deg, rgba(199,242,74,.16), transparent 42%); transition: opacity .24s ease, transform .24s ease; }
.feature-card:hover, .feature-card:focus-visible { transform: translateY(-3px); box-shadow: 0 18px 48px rgba(10,46,59,.08); border-color: #b8cfca; }
.feature-card:hover::before, .feature-card:focus-visible::before { opacity: 1; transform: none; }.feature-card:active { transform: scale(.99); }
.feature-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.feature-copy { display: grid; margin-top: 24px; position: relative; z-index: 2; }
.feature-copy small { color: var(--primary-dark); font-size: 9px; font-weight: 800; }
.feature-copy strong { margin-top: 8px; color: var(--ink); font-size: 21px; line-height: 1.25; letter-spacing: 0; }
.feature-copy > span { margin-top: 9px; color: var(--muted); font-size: 14px; line-height: 1.55; }
.status-chip { min-height: 30px; display: inline-flex; align-items: center; padding: 0 10px; border: 1px solid var(--border); border-radius: 999px; color: var(--primary-dark); background: #f5faf8; font-size: 11px; font-weight: 800; }
.coming-label { min-height: 30px; display: inline-flex; align-items: center; padding: 0 10px; border: 1px solid var(--border); border-radius: 999px; color: var(--primary-dark); background: #f5faf8; font-size: 11px; font-weight: 800; }
.coming-label-dark { border-color: rgba(255,255,255,.23); color: var(--accent); background: rgba(255,255,255,.07); }
.profile-stats { display: flex; gap: 22px; margin-top: auto; padding-top: 18px; border-top: 1px solid var(--border); color: var(--muted); font-size: 12px; }.profile-stats span { display: grid; }.profile-stats b { color: var(--ink); font-family: "DIN Alternate", sans-serif; font-size: 26px; }
.future-card { background: #e8f4ef; }.future-year { position: absolute; right: -7px; bottom: -25px; font-family: "DIN Alternate", sans-serif; font-size: 76px; font-weight: 900; color: rgba(10,46,59,.06); letter-spacing: 0; transition: transform .24s ease, opacity .24s ease; }.future-card:hover .future-year { transform: translateY(-4px); opacity: .86; }
.award-card { background: #f4f0fa; }.award-spark { position: absolute; right: 14px; top: 12px; color: rgba(109,40,217,.28); font-size: 34px; transition: transform .24s ease, opacity .24s ease; }.award-card:hover .award-spark { transform: rotate(18deg) scale(1.12); opacity: .9; }
.test-card { color: #fff; background: var(--primary); border-color: var(--primary); }.test-card .feature-copy small { color: rgba(255,255,255,.66); }.test-card .feature-copy strong { color: #fff; }.test-card .feature-copy > span { color: rgba(255,255,255,.75); }.scan-line { position: absolute; left: 20px; right: 20px; bottom: 18px; height: 1px; background: repeating-linear-gradient(90deg,var(--accent) 0 18px,transparent 18px 26px); opacity: .75; }
.test-card:hover .scan-line { animation: scan-sweep 1.1s ease-in-out infinite; }
.message-card { background: #f7f8dd; }.message-route { display: flex; gap: 6px; margin-top: auto; padding-top: 18px; }.message-route i { width: 8px; height: 8px; border: 2px solid var(--ink); border-radius: 50%; }.message-route i:nth-child(2) { width: 54px; border-radius: 999px; background: var(--accent); transform-origin: left; }.message-card:hover .message-route i:nth-child(2) { animation: message-pulse 1.2s ease-in-out infinite; }

.utility-row { width: min(100%, 860px); margin: 56px auto 26px; padding: 0; display: grid; gap: 18px; }.section-index { color: var(--primary-dark); font-size: 10px; font-weight: 800; }.utility-row h2 { margin: 7px 0 0; color: var(--ink); font-size: 27px; letter-spacing: 0; }.support-copy { max-width: 360px; margin: 10px 0 0; color: var(--muted); font-size: 13px; line-height: 1.65; }.utility-links { display: grid; gap: 10px; }.utility-links a { min-height: 76px; display: grid; grid-template-columns: 24px 1fr 20px; align-items: center; gap: 12px; padding: 14px 16px; border: 1px solid var(--border); border-radius: 16px; color: var(--ink); background: rgba(255,255,255,.76); text-decoration: none; transition: background .2s ease,border-color .2s ease,transform .2s ease; }.utility-links a:hover { transform: translateY(-2px); background: #fff; border-color: #afc9c2; }.utility-links span { display: grid; }.utility-links small { margin-top: 2px; color: var(--muted); font-size: 12px; }
.site-footer { min-height: 90px; display: flex; flex-direction: column; justify-content: center; gap: 5px; border-top: 1px solid var(--border); color: var(--muted); font-size: 12px; }.footer-code { font-family: "SFMono-Regular", Menlo, monospace; color: var(--primary-dark); letter-spacing: 0; }

.mobile-nav { position: fixed; z-index: 50; left: 12px; right: 12px; bottom: max(10px, env(safe-area-inset-bottom, 0px)); height: 66px; display: grid; grid-template-columns: repeat(4,1fr); padding: 6px; border: 1px solid rgba(255,255,255,.65); border-radius: 20px; background: rgba(10,46,59,.94); box-shadow: 0 14px 40px rgba(10,46,59,.28); backdrop-filter: blur(14px); }
.mobile-nav a, .mobile-nav button { min-width: 0; min-height: 52px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; border-radius: 14px; color: rgba(255,255,255,.65); text-decoration: none; font-size: 10px; }.mobile-nav a[aria-current="page"] { color: var(--accent); background: rgba(255,255,255,.08); }

.coming-toast { position: fixed; z-index: 120; left: 16px; right: 16px; bottom: calc(90px + env(safe-area-inset-bottom,0px)); min-height: 62px; display: grid; grid-template-columns: 24px 1fr 44px; align-items: center; gap: 10px; padding: 10px 8px 10px 16px; border: 1px solid rgba(255,255,255,.18); border-radius: 18px; color: #fff; background: var(--ink); box-shadow: 0 18px 50px rgba(10,46,59,.28); }.coming-toast span { font-size: 13px; line-height: 1.45; }.coming-toast button { width: 44px; height: 44px; display: grid; place-items: center; color: #fff; border-radius: 50%; }.toast-enter-active,.toast-leave-active { transition: opacity .2s ease,transform .2s ease; }.toast-enter-from,.toast-leave-to { opacity: 0; transform: translateY(10px); }

.welcome-layer { position: fixed; z-index: 1000; inset: 0; display: grid; place-items: center; padding: 16px; background: rgba(3,20,26,.68); backdrop-filter: blur(8px); }
.welcome-dialog { width: min(100%, 540px); min-height: 580px; position: relative; overflow: hidden; padding: 34px 28px 30px; border-radius: 28px 8px 28px 8px; color: #fff; background: var(--ink); box-shadow: 0 32px 80px rgba(0,0,0,.35); }
.welcome-dialog::before { content: ""; width: 370px; height: 370px; position: absolute; right: -180px; bottom: -120px; border: 1px solid rgba(199,242,74,.4); border-radius: 50%; box-shadow: 0 0 0 42px rgba(199,242,74,.035),0 0 0 84px rgba(199,242,74,.02); }
.dialog-close { width: 44px; height: 44px; position: absolute; z-index: 2; right: 17px; top: 17px; display: grid; place-items: center; border-radius: 50%; color: #fff; background: rgba(255,255,255,.08); }
.welcome-logo-wrap { width: 96px; min-height: 74px; display: grid; place-items: center; padding: 10px; border-radius: 18px 5px 18px 5px; background: #fff; }.welcome-logo-wrap img { display: block; width: 100%; max-height: 54px; object-fit: contain; }
.welcome-code { margin: 44px 0 0; color: var(--accent); font-family: "SFMono-Regular", Menlo, monospace; font-size: 10px; letter-spacing: 0; }
.welcome-dialog h2 { margin: 12px 0 0; font-size: clamp(40px,10vw,60px); line-height: 1.02; letter-spacing: 0; }.welcome-dialog > p:not(.welcome-code) { max-width: 390px; margin: 22px 0 0; color: rgba(255,255,255,.7); font-size: 15px; line-height: 1.75; }
.welcome-enter { min-height: 52px; position: relative; z-index: 2; display: inline-flex; align-items: center; gap: 12px; margin-top: 28px; padding: 0 21px; border-radius: 999px; color: var(--ink); background: var(--accent); font-weight: 900; }
.welcome-coordinate { position: absolute; right: 27px; bottom: 27px; color: rgba(255,255,255,.37); font-family: "SFMono-Regular",Menlo,monospace; font-size: 9px; line-height: 1.6; letter-spacing: 0; text-align: right; }
.welcome-enter-active,.welcome-leave-active { transition: opacity .22s ease; }.welcome-enter-active .welcome-dialog,.welcome-leave-active .welcome-dialog { transition: transform .26s cubic-bezier(.2,.75,.25,1),opacity .22s ease; }.welcome-enter-from,.welcome-leave-to { opacity: 0; }.welcome-enter-from .welcome-dialog,.welcome-leave-to .welcome-dialog { opacity: 0; transform: translateY(14px) scale(.98); }

@media (min-width: 700px) {
  .site-header { padding-inline: 20px; gap: 16px; }
  .brand-logo { width: 300px; height: 48px; }
  .home-main { width: min(100% - 48px,1240px); }.intro-row { grid-template-columns: 1.35fr .65fr; align-items: end; padding: 64px 0 38px; }.dashboard-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }.explore-card { grid-column: span 2; }.feature-card { min-height: 270px; }.next-stop { grid-template-columns: 24px minmax(0,1fr) auto; }.next-stop em { display: block; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.utility-row { grid-template-columns: .95fr 1.05fr; align-items: center; }.site-footer { flex-direction: row; align-items: center; justify-content: space-between; }
  .coming-toast { width: min(520px,calc(100% - 32px)); left: 50%; right: auto; transform: translateX(-50%); }.toast-enter-from,.toast-leave-to { transform: translate(-50%,10px); }
}

@media (min-width: 1024px) {
  .home-shell { padding-bottom: 0; }.site-header { min-height: 78px; padding: 12px 18px; }.brand-logo { width: 320px; height: 50px; }.desktop-nav { margin-left: auto; display: flex; align-items: center; gap: 4px; }.desktop-nav a,.desktop-nav button { min-height: 44px; display: inline-flex; align-items: center; padding: 0 14px; border-radius: 999px; color: var(--muted); text-decoration: none; font-size: 14px; font-weight: 700; }.desktop-nav a:hover,.desktop-nav button:hover,.desktop-nav a[aria-current="page"] { color: var(--ink); background: #e6efeb; }.mobile-nav { display: none; }
.dashboard-grid { grid-template-columns: repeat(12,minmax(0,1fr)); grid-auto-rows: minmax(132px,auto); gap: 16px; }.explore-card { grid-column: span 7; grid-row: span 4; min-height: 596px; padding: 30px; }.profile-card { grid-column: span 5; grid-row: span 2; min-height: 290px; }.future-card { grid-column: span 5; grid-row: span 2; min-height: 290px; }.award-card { grid-column: span 5; grid-row: span 2; min-height: 290px; }.test-card { grid-column: span 5; grid-row: span 2; min-height: 290px; }.message-card { grid-column: span 7; grid-row: span 2; min-height: 290px; }.progress-content { margin-top: 82px; }.feature-card { padding: 24px; }.feature-copy { margin-top: 26px; }.message-card .feature-copy { max-width: 480px; }.coming-toast { bottom: 28px; }
}

@media (hover:hover) {
  .primary-action:hover { background: #d4ff55; }.text-action:hover { color: var(--accent); }
}

@media (prefers-reduced-motion: reduce) {
  .eyebrow,.intro-copy,.grid-item,.intro-row h1 span,.progress-skeleton span { opacity: 1; transform: none; animation: none; }.map-grid,.eyebrow span,.route-start,.route-end,.route-progress span,.scan-line,.message-route i:nth-child(2) { animation: none; }.route-progress span,.feature-card,.feature-card::before,.future-year,.utility-links a,.toast-enter-active,.toast-leave-active,.welcome-enter-active,.welcome-leave-active,.welcome-enter-active .welcome-dialog,.welcome-leave-active .welcome-dialog { transition: none; }
}
</style>
