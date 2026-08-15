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

      <section class="deck-section grid-item" aria-label="迎新活动与校园探索">
        <div
          class="deck"
          tabindex="0"
          role="group"
          aria-label="功能入口卡牌堆，向左滑动或按左方向键切换下一张"
          @keydown.left.prevent="cycleDeck"
        >
          <div class="deck-sizer" aria-hidden="true"></div>

          <article
            v-for="card in deckCards"
            :key="card.key"
            :class="['deck-card', `deck-card-${card.key}`, {
              'is-front': isFront(card),
              'is-dragging': dragging && isFront(card),
              'is-exiting': exitingKey === card.key,
            }]"
            :style="cardStyle(card)"
            :aria-hidden="isFront(card) ? undefined : 'true'"
            @pointerdown="onDeckPointerDown($event, card)"
            @pointermove="onDeckPointerMove($event, card)"
            @pointerup="onDeckPointerUp($event, card)"
            @pointercancel="onDeckPointerCancel"
            @click="onDeckCardClick(card)"
          >
            <!-- 校园图鉴 -->
            <template v-if="card.key === 'atlas'">
              <div class="map-grid" aria-hidden="true"></div>
              <svg class="atlas-route-deco" viewBox="0 0 200 120" aria-hidden="true">
                <path d="M8 104 C 56 96, 74 42, 126 52 S 172 22, 194 12" fill="none" stroke="rgba(13,148,136,.4)" stroke-width="2" stroke-dasharray="5 7" stroke-linecap="round" />
                <circle cx="8" cy="104" r="4.5" fill="#c7f24a" stroke="#0a2e3b" stroke-width="1.5" />
                <circle cx="126" cy="52" r="4" fill="#fff" stroke="#0d9488" stroke-width="1.5" />
                <circle cx="194" cy="12" r="4.5" fill="#c7f24a" stroke="#0a2e3b" stroke-width="1.5" />
              </svg>
              <div class="deck-card-inner">
                <div class="deck-card-top">
                  <p class="card-kicker">MAP ROUTES · 校园图鉴</p>
                  <span class="coming-label">立即进入</span>
                </div>
                <h2 class="deck-title">校园图鉴</h2>
                <p class="deck-desc">沿新生路线打卡，集齐你的校园坐标</p>

                <div v-if="loading" class="atlas-skeleton" aria-label="正在加载路线进度">
                  <span></span><span></span>
                </div>
                <div v-else class="atlas-progress">
                  <div class="atlas-progress-number">
                    <span>{{ overallCompleted }}</span><small>/ {{ overallTotal }} 站</small>
                  </div>
                  <span
                    class="atlas-track"
                    role="progressbar"
                    aria-label="三条路线打卡总进度"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    :aria-valuenow="overallPercent"
                  >
                    <i :style="{ '--progress-scale': overallPercent / 100 }"></i>
                  </span>
                  <p class="atlas-progress-meta">三条路线总进度 {{ overallPercent }}%</p>
                </div>

                <div v-if="nextLocation" class="deck-next-stop">
                  <Navigation :size="15" aria-hidden="true" />
                  <span><small>下一站 · {{ selectedRoute.name }}</small><strong>{{ nextLocation.name }}</strong></span>
                </div>
                <div v-else class="deck-next-stop deck-next-complete">
                  <MapPinned :size="15" aria-hidden="true" />
                  <span><small>路线状态</small><strong>全部路线已打卡完成</strong></span>
                </div>
              </div>
            </template>

            <!-- ISETI 校园人格 -->
            <template v-else-if="card.key === 'iseti'">
              <div class="deck-card-inner">
                <div class="deck-card-top">
                  <p class="card-kicker">PLACE / 校园人格</p>
                  <span class="coming-label">立即进入</span>
                </div>
                <h2 class="deck-title">ISETI</h2>
                <p class="deck-desc">从 28 个选择里找到你的校园人格与探索偏好</p>
                <span class="iseti-types" aria-hidden="true">
                  <span
                    v-for="(sprite, i) in isetiSprites"
                    :key="sprite.code"
                    :class="{ on: i === spriteIndex }"
                    :style="{ '--chip': sprite.color }"
                  ></span>
                </span>
              </div>
              <span class="iseti-stage" aria-hidden="true">
                <span class="iseti-frame"><i></i><i></i><i></i><i></i></span>
                <Transition name="sprite-fade">
                  <img :key="spriteIndex" class="iseti-sprite" :src="isetiSprites[spriteIndex].src" alt="" />
                </Transition>
                <Transition name="name-fade">
                  <em :key="spriteIndex" class="iseti-sprite-name">{{ isetiSprites[spriteIndex].name }}</em>
                </Transition>
              </span>
              <span class="scan-line" aria-hidden="true"></span>
            </template>

            <!-- 未来寄语 -->
            <template v-else-if="card.key === 'future'">
              <div class="deck-card-inner">
                <div class="deck-card-top">
                  <p class="card-kicker">TO FUTURE ME / 四年后见</p>
                  <span class="coming-label">立即进入</span>
                </div>
                <h2 class="deck-title">未来寄语</h2>
                <p class="deck-desc">写下此刻的期盼，在毕业时重新打开</p>
              </div>
              <svg class="future-flight" viewBox="0 0 220 92" aria-hidden="true">
                <path d="M8 82 C 66 76, 118 46, 166 32" fill="none" stroke="rgba(160,121,44,.55)" stroke-width="1.6" stroke-dasharray="4 6" stroke-linecap="round" />
                <path d="M188 12 L212 22 L196 28 L193 38 Z" fill="#b0413e" />
              </svg>
              <span class="future-envelope" aria-hidden="true"></span>
              <span class="future-postmark" aria-hidden="true"><i>POSTED 2026</i><b>SYSU</b></span>
              <span class="future-stamp" aria-hidden="true"><em>SYSU · ISE</em><strong>2030</strong></span>
            </template>

            <!-- 作品投稿 -->
            <template v-else>
              <span class="award-spotlight" aria-hidden="true"></span>
              <span class="award-frames" aria-hidden="true">
                <i class="frame-a"><b><img :src="framePortrait" alt="" /></b></i>
                <i class="frame-b"><b><img :src="frameSquare" alt="" /></b></i>
                <i class="frame-c"><b><img :src="frameLandscape" alt="" /></b></i>
              </span>
              <div class="deck-card-inner">
                <div class="deck-card-top">
                  <p class="card-kicker">CHECK-IN GALLERY / 打卡作品投稿</p>
                  <span class="coming-label">立即投稿</span>
                </div>
                <h2 class="deck-title">作品投稿</h2>
                <p class="deck-desc">上传你的创意与摄影作品，赢取属于你的校园高光时刻</p>
                <span class="award-badge" aria-hidden="true">
                  <span class="award-badge-icon"><Trophy :size="19" aria-hidden="true" /></span>
                  <span class="award-badge-copy"><i>BEST IDEA</i><i>BEST SHOT</i></span>
                </span>
              </div>
            </template>
          </article>
        </div>

        <div class="deck-dots" role="tablist" aria-label="切换功能入口">
          <button
            v-for="card in allCards"
            :key="card.key"
            type="button"
            role="tab"
            :class="{ active: frontKey === card.key }"
            :aria-selected="frontKey === card.key"
            :aria-label="`切换到${card.title}`"
            @click="jumpToCard(card.key)"
          ><span></span></button>
        </div>
      </section>

      <footer class="site-footer">
        <span>中山大学智能工程学院 · 2026 级迎新</span>
        <span class="footer-code">SYSU / ISE / 2026</span>
      </footer>
    </main>

  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { MapPinned, Navigation, Trophy } from '@lucide/vue'
import { getPlaceById } from '@/data/campusPlaces'
import routes from '@/data/routes'
import { checkedSet, fetchUserProgress, getRouteCheckedCount } from '@/stores/userProgress'
import spriteBase from '@/assets/home/sprite-base.webp'
import spriteLens from '@/assets/home/sprite-lens.webp'
import spriteMaps from '@/assets/home/sprite-maps.webp'
import spriteRun from '@/assets/home/sprite-run.webp'
import spriteTree from '@/assets/home/sprite-tree.webp'
import spriteWiki from '@/assets/home/sprite-wiki.webp'
import framePortrait from '@/assets/gallery/frame-portrait.webp'
import frameLandscape from '@/assets/gallery/frame-landscape.webp'
import frameSquare from '@/assets/gallery/frame-square.webp'

const router = useRouter()
const loading = ref(false)

/* ---------- 路线进度数据 ---------- */

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
const overallCompleted = computed(() => routeSummaries.value.reduce((sum, item) => sum + item.completed, 0))
const overallTotal = computed(() => routeSummaries.value.reduce((sum, item) => sum + item.total, 0))
const overallPercent = computed(() => (
  overallTotal.value ? Math.min(100, Math.round((overallCompleted.value / overallTotal.value) * 100)) : 0
))
const recommendedRouteSummary = computed(() => {
  const incomplete = routeSummaries.value.filter(item => item.completed < item.total)
  if (!incomplete.length) return routeSummaries.value.at(-1)
  return [...incomplete].sort((a, b) => b.percent - a.percent || a.index - b.index)[0]
})
const selectedRoute = computed(() => recommendedRouteSummary.value?.route || routes[0])
const nextLocation = computed(() => {
  if (allRoutesComplete.value) return null
  for (const placeId of selectedRoute.value?.points || []) {
    const place = getPlaceById(placeId)
    if (place && place.isHidden !== 1 && !checkedSet.value.has(place.id) && !checkedSet.value.has(place.backendId)) return place
  }
  return null
})
const primaryMapTarget = computed(() => {
  if (allRoutesComplete.value || !nextLocation.value) return '/map'
  return {
    path: '/map',
    query: { route: selectedRoute.value.id, place: nextLocation.value.id },
  }
})

/* ---------- 卡牌堆 ---------- */

const allCards = [
  { key: 'atlas', title: '校园图鉴' },
  { key: 'iseti', title: 'ISETI' },
  { key: 'future', title: '未来寄语' },
  { key: 'award', title: '作品投稿' },
]
const DECK_FRONT_STORAGE_KEY = 'home-deck-front'
const SLOT_OFFSET_X = 14
const SLOT_OFFSET_Y = 7
const SLOT_ROTATE = 2.2
const SLOT_SCALE = 0.035
const EXIT_ANIMATION_MS = 300

const deckOrder = ref([...allCards])
const deckCards = computed(() => deckOrder.value)
const frontKey = computed(() => deckOrder.value[0].key)
const dragging = ref(false)
const dragX = ref(0)
const exitingKey = ref(null)
// 飞出动画起始时的拖拽偏移：牌序在飞出瞬间就轮换，dragX 必须立即归零，
// 所以飞出牌的位置用这份快照维持
const exitDragX = ref(0)
const reducedMotion = typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* ---------- ISETI 人格小人轮播 ---------- */

const isetiSprites = [
  { code: 'BASE', name: '熟悉地点型', src: spriteBase, color: '#3e7a68' },
  { code: 'LENS', name: '视觉观察型', src: spriteLens, color: '#8a5a8e' },
  { code: 'MAPS', name: '地标收集型', src: spriteMaps, color: '#3d5a7e' },
  { code: 'RUN', name: '路线探索型', src: spriteRun, color: '#d5772a' },
  { code: 'STAY', name: '慢节奏停留型', src: spriteTree, color: '#718050' },
  { code: 'WIKI', name: '维基百科型', src: spriteWiki, color: '#9c4a5e' },
]
const SPRITE_DWELL_MS = 2600
const spriteIndex = ref(0)
let spriteTimer = null

function startSpriteLoop() {
  if (reducedMotion || spriteTimer) return
  spriteTimer = window.setInterval(() => {
    spriteIndex.value = (spriteIndex.value + 1) % isetiSprites.length
  }, SPRITE_DWELL_MS)
}

function stopSpriteLoop() {
  if (spriteTimer) {
    window.clearInterval(spriteTimer)
    spriteTimer = null
  }
}

// 轮播只在 ISETI 是顶牌且不在拖拽时运行，避免与卡牌切换动画撞车
const isetiActive = computed(() => frontKey.value === 'iseti' && !dragging.value)
watch(isetiActive, (active) => {
  if (active) startSpriteLoop()
  else stopSpriteLoop()
}, { immediate: true })

let dragStartX = 0
let dragMoved = false

function slotOf(card) {
  return deckOrder.value.findIndex(item => item.key === card.key)
}

function isFront(card) {
  return frontKey.value === card.key
}

function cardStyle(card) {
  if (exitingKey.value === card.key) {
    return {
      transform: `translate(${exitDragX.value - 360}px, ${Math.abs(exitDragX.value) * 0.05 - 40}px) rotate(-16deg) scale(.96)`,
      opacity: 0,
      zIndex: 60,
    }
  }
  const slot = slotOf(card)
  let transform = `translate(${slot * SLOT_OFFSET_X}px, ${slot * SLOT_OFFSET_Y}px) rotate(${slot * SLOT_ROTATE}deg) scale(${1 - slot * SLOT_SCALE})`
  if (slot === 0 && dragX.value) {
    transform = `translate(${dragX.value}px, ${Math.abs(dragX.value) * 0.05}px) rotate(${dragX.value * 0.045}deg)`
  }
  return {
    transform,
    opacity: 1 - slot * 0.07,
    zIndex: 50 - slot,
  }
}

function persistFront() {
  try {
    localStorage.setItem(DECK_FRONT_STORAGE_KEY, frontKey.value)
  } catch { /* 忽略存储异常 */ }
}

function rotateDeck() {
  deckOrder.value = [...deckOrder.value.slice(1), deckOrder.value[0]]
  persistFront()
}

function sendToBack(card) {
  if (exitingKey.value || !isFront(card)) return
  if (reducedMotion) {
    dragX.value = 0
    rotateDeck()
    return
  }
  // 重叠动画：点击瞬间立即轮换牌序，下一张牌在旧顶牌飞出的同时提升到顶位，
  // 不再等飞出动画播完，消除连续切换时“顿一下”的空档
  exitingKey.value = card.key
  exitDragX.value = dragX.value
  dragX.value = 0
  rotateDeck()
  window.setTimeout(() => {
    exitingKey.value = null
    exitDragX.value = 0
  }, EXIT_ANIMATION_MS)
}

function cycleDeck() {
  if (exitingKey.value) return
  sendToBack(deckOrder.value[0])
}

function jumpToCard(key) {
  if (exitingKey.value) return
  const index = deckOrder.value.findIndex(item => item.key === key)
  if (index <= 0) return
  deckOrder.value = [...deckOrder.value.slice(index), ...deckOrder.value.slice(0, index)]
  persistFront()
}

function onDeckPointerDown(event, card) {
  if (!isFront(card) || exitingKey.value) return
  dragStartX = event.clientX
  dragMoved = false
  dragging.value = true
  event.currentTarget.setPointerCapture?.(event.pointerId)
}

function onDeckPointerMove(event, card) {
  if (!dragging.value || !isFront(card)) return
  const dx = event.clientX - dragStartX
  if (Math.abs(dx) > 8) dragMoved = true
  dragX.value = Math.max(-180, Math.min(24, dx))
}

function onDeckPointerUp(event, card) {
  if (!dragging.value || !isFront(card)) {
    dragging.value = false
    return
  }
  dragging.value = false
  const width = event.currentTarget.offsetWidth || 300
  if (dragX.value < -width * 0.35) {
    sendToBack(card)
  } else {
    dragX.value = 0
  }
}

function onDeckPointerCancel() {
  dragging.value = false
  dragX.value = 0
}

function activateCard(card) {
  if (card.key === 'atlas') router.push(primaryMapTarget.value)
  else if (card.key === 'iseti') router.push('/place')
  else if (card.key === 'future') goProtected('/future-card')
  else if (card.key === 'award') goProtected('/award')
}

function onDeckCardClick(card) {
  if (dragMoved) {
    dragMoved = false
    return
  }
  if (exitingKey.value) return
  if (isFront(card)) activateCard(card)
  else cycleDeck()
}

/* ---------- 数据加载与登录守卫 ---------- */

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
  try {
    const saved = localStorage.getItem(DECK_FRONT_STORAGE_KEY)
    if (saved && allCards.some(card => card.key === saved)) jumpToCard(saved)
  } catch { /* 忽略存储异常 */ }
  loadDashboard()
})

onBeforeUnmount(() => {
  stopSpriteLoop()
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
.eyebrow, .card-kicker { margin: 0; font-family: "SFMono-Regular", Menlo, monospace; letter-spacing: 0; text-transform: uppercase; }
.eyebrow { display: flex; align-items: center; gap: 9px; font-size: 11px; color: var(--primary-dark); font-weight: 700; opacity: 0; animation: fade-lift .34s cubic-bezier(.2,.75,.25,1) .04s forwards; }
.eyebrow span { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 3px var(--ink); animation: node-breathe 2.8s ease-in-out .7s infinite; }
.intro-row h1 { margin: 12px 0 0; color: var(--ink); font-family: "DIN Alternate", "Avenir Next", "Noto Sans SC", sans-serif; font-size: clamp(35px, 8vw, 72px); line-height: .98; letter-spacing: 0; overflow: hidden; }
.intro-row h1 span { display: block; opacity: 0; transform: translateY(110%) skewY(2deg); animation: title-line-in .62s cubic-bezier(.16,1,.3,1) forwards; will-change: transform, opacity; }
.intro-row h1 span:nth-child(2) { animation-delay: .12s; }
.intro-copy { max-width: 430px; margin: 0; color: var(--muted); font-size: 16px; line-height: 1.7; opacity: 0; transform: translateY(14px); animation: fade-lift .48s cubic-bezier(.2,.75,.25,1) .28s forwards; }

.grid-item { opacity: 0; animation: card-arrive .38s cubic-bezier(.2,.75,.25,1) .18s forwards; }
@keyframes card-arrive { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes fade-lift { to { opacity: 1; transform: none; } }
@keyframes title-line-in { to { opacity: 1; transform: translateY(0) skewY(0); } }
@keyframes node-breathe { 50% { transform: scale(1.28); opacity: .72; } }
@keyframes map-drift { 50% { transform: translate3d(-10px, 6px, 0); } }
@keyframes route-fill { from { transform: scaleX(0); } to { transform: scaleX(var(--progress-scale, 0)); } }
@keyframes scan-sweep { 50% { opacity: .35; transform: translateY(-5px); } }
@keyframes pulse { 50% { opacity: .42; } }

/* ---------- 卡牌堆 ---------- */

.deck-section { padding: 4px 0 8px; }
.deck { --card-w: min(100% - 52px, 320px); --stack-spread: 42px; position: relative; outline: none; border-radius: 24px; }
.deck:focus-visible { outline: 3px solid rgba(199,242,74,.55); outline-offset: 4px; }
.deck-sizer, .deck-card { width: var(--card-w); aspect-ratio: 63 / 88; }
.deck-sizer { visibility: hidden; margin: 0 auto; }

.deck-card {
  position: absolute;
  top: 0;
  left: calc(50% - (var(--card-w) + var(--stack-spread)) / 2);
  border: 1px solid var(--border);
  border-radius: 22px;
  background: var(--surface);
  overflow: hidden;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  touch-action: pan-y;
  box-shadow: 0 10px 28px rgba(10,46,59,.08);
  transition: transform .38s cubic-bezier(.2,.75,.25,1), opacity .3s ease, box-shadow .3s ease;
  will-change: transform;
}
.deck-card.is-front { box-shadow: 0 22px 54px rgba(10,46,59,.14); }
.deck-card.is-dragging { transition: none; cursor: grabbing; }
.deck-card.is-exiting { pointer-events: none; }
.deck-card:not(.is-front) { cursor: pointer; }

.deck-card-inner { position: relative; z-index: 2; height: 100%; display: flex; flex-direction: column; padding: 20px; text-align: left; }
.deck-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.card-kicker { font-size: 10px; color: var(--primary-dark); font-weight: 700; }
.coming-label { min-height: 30px; display: inline-flex; align-items: center; flex: 0 0 auto; padding: 0 10px; border: 1px solid var(--border); border-radius: 999px; color: var(--primary-dark); background: #f5faf8; font-size: 11px; font-weight: 800; }
.deck-title { margin: 22px 0 0; color: var(--ink); font-size: clamp(26px, 7vw, 32px); line-height: 1.12; letter-spacing: 0; }
.deck-desc { margin: 10px 0 0; color: var(--muted); font-size: 14px; line-height: 1.55; }

/* 校园图鉴：白纸地图 */
.map-grid { position: absolute; inset: -16px; opacity: .5; background-image: linear-gradient(rgba(13,148,136,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(13,148,136,.07) 1px,transparent 1px); background-size: 44px 44px; mask-image: linear-gradient(to bottom, #000, transparent 78%); }
.deck-card-atlas.is-front .map-grid { animation: map-drift 8s ease-in-out infinite; }
.atlas-route-deco { position: absolute; right: -14px; bottom: 64px; width: 68%; opacity: .8; pointer-events: none; }
.atlas-progress { margin-top: 26px; }
.atlas-progress-number { display: flex; align-items: baseline; gap: 7px; }
.atlas-progress-number span { color: var(--ink); font-family: "DIN Alternate", "Avenir Next", sans-serif; font-size: clamp(48px, 13vw, 62px); font-weight: 800; line-height: .85; letter-spacing: 0; }
.atlas-progress-number small { font-family: "SFMono-Regular", Menlo, monospace; font-size: 11px; color: var(--muted); }
.atlas-track { display: block; height: 5px; margin-top: 14px; position: relative; overflow: hidden; background: rgba(10,46,59,.1); border-radius: 999px; }
.atlas-track i { position: absolute; inset: 0; transform: scaleX(var(--progress-scale,0)); transform-origin: left; background: var(--accent); border-radius: inherit; transition: transform .42s cubic-bezier(.2,.75,.25,1); animation: route-fill .7s cubic-bezier(.2,.75,.25,1) .16s both; }
.atlas-progress-meta { margin: 8px 0 0; color: var(--muted); font-size: 12px; }
.atlas-skeleton { margin-top: 30px; display: grid; gap: 12px; }
.atlas-skeleton span { display: block; height: 16px; border-radius: 10px; background: rgba(10,46,59,.08); animation: pulse 1.2s ease-in-out infinite; }
.atlas-skeleton span:first-child { height: 56px; width: 45%; }
.deck-next-stop { margin-top: auto; padding-top: 14px; border-top: 1px solid var(--border); display: grid; grid-template-columns: 20px minmax(0,1fr); align-items: center; gap: 9px; color: var(--primary-dark); }
.deck-next-stop span { display: grid; min-width: 0; }
.deck-next-stop small { color: var(--muted); font-size: 11px; }
.deck-next-stop strong { margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; color: var(--ink); }
.deck-next-complete strong { color: var(--primary-dark); }

/* ISETI：折纸标本卡（暖奶油纸底 + 砖红点缀） */
.deck-card-iseti { background: linear-gradient(165deg, #faf4e6 0%, #f2e8d2 100%); border-color: #e3d3b0; }
.deck-card-iseti .card-kicker { color: #b0413e; }
.deck-card-iseti .deck-title { color: #4b382a; font-family: "DIN Alternate", "Avenir Next", sans-serif; letter-spacing: .04em; }
.deck-card-iseti .deck-desc { color: #8a765c; }
.deck-card-iseti .coming-label { background: #fdf9ee; border-color: #e0c9a8; color: #b0413e; }
.iseti-types { display: flex; gap: 8px; margin-top: auto; padding-top: 18px; }
.iseti-types span { width: 18px; height: 18px; border-radius: 6px 2px 6px 2px; background: var(--chip); opacity: .3; transform: scale(.86); transition: opacity .3s ease, transform .3s cubic-bezier(.2,.75,.25,1); box-shadow: inset 0 0 0 1px rgba(75,56,42,.18); }
.iseti-types span.on { opacity: 1; transform: scale(1); box-shadow: inset 0 0 0 1px rgba(75,56,42,.28), 0 3px 8px rgba(75,56,42,.22); }
.iseti-stage { position: absolute; left: 50%; top: 52%; width: 150px; height: 150px; transform: translate(-50%, -50%); pointer-events: none; }
.iseti-stage::before { content: ""; position: absolute; inset: -18px; border-radius: 50%; background: radial-gradient(circle, rgba(255,252,244,.95) 0%, rgba(255,252,244,0) 68%); }
.iseti-frame { position: absolute; inset: 0; opacity: .7; }
.iseti-frame i { position: absolute; width: 24px; height: 24px; border: 2px solid rgba(176,65,62,.7); }
.iseti-frame i:nth-child(1) { top: 0; left: 0; border-right: none; border-bottom: none; border-radius: 8px 0 0 0; }
.iseti-frame i:nth-child(2) { top: 0; right: 0; border-left: none; border-bottom: none; border-radius: 0 8px 0 0; }
.iseti-frame i:nth-child(3) { bottom: 0; left: 0; border-right: none; border-top: none; border-radius: 0 0 0 8px; }
.iseti-frame i:nth-child(4) { bottom: 0; right: 0; border-left: none; border-top: none; border-radius: 0 0 8px 0; }
.iseti-sprite { position: absolute; left: 50%; top: 50%; width: 128px; height: 128px; object-fit: contain; transform: translate(-50%, -50%); filter: drop-shadow(0 8px 14px rgba(75,56,42,.28)); }
.sprite-fade-enter-active, .sprite-fade-leave-active { transition: opacity .45s ease, transform .45s cubic-bezier(.2,.75,.25,1); }
.sprite-fade-enter-from { opacity: 0; transform: translate(-50%, -46%) scale(.9); }
.sprite-fade-leave-to { opacity: 0; transform: translate(-50%, -54%) scale(.94); }
.iseti-sprite-name { position: absolute; left: 50%; bottom: -30px; transform: translateX(-50%); white-space: nowrap; font-family: "SFMono-Regular", Menlo, monospace; font-style: normal; font-size: 10px; letter-spacing: .08em; color: #b0413e; }
.name-fade-enter-active, .name-fade-leave-active { transition: opacity .45s ease, transform .45s cubic-bezier(.2,.75,.25,1); }
.name-fade-enter-from { opacity: 0; transform: translateX(-50%) translateY(5px); }
.name-fade-leave-to { opacity: 0; transform: translateX(-50%) translateY(-5px); }
.scan-line { position: absolute; left: 20px; right: 20px; bottom: 18px; height: 1px; background: repeating-linear-gradient(90deg,rgba(176,65,62,.45) 0 18px,transparent 18px 26px); opacity: .6; }
.deck-card-iseti.is-front:hover .scan-line { animation: scan-sweep 1.1s ease-in-out infinite; }

/* 未来寄语：寄往 2030 的信封 */
.deck-card-future { background: linear-gradient(165deg, #fdf8ec 0%, #f5e9cd 100%); border-color: #e6d7b4; }
.deck-card-future .card-kicker { color: #a0792c; }
.deck-card-future .deck-desc { color: #8a7a58; }
.deck-card-future .coming-label { background: #fdf9ee; border-color: #e3d3ac; color: #8a6d1f; }
.future-flight { position: absolute; left: 6%; bottom: 118px; width: 88%; pointer-events: none; }
.future-envelope { position: absolute; left: 0; right: 0; bottom: 0; height: 98px; background: linear-gradient(#f2e4c2, #ecd9b0); clip-path: polygon(0 100%, 0 44%, 50% 0, 100% 44%, 100% 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,.65); }
.future-envelope::after { content: ""; position: absolute; inset: 0; background: linear-gradient(rgba(160,121,44,0), rgba(160,121,44,.1)); }
.future-postmark { position: absolute; left: 20px; bottom: 20px; width: 62px; height: 62px; display: grid; place-content: center; gap: 2px; justify-items: center; border: 2px solid rgba(140,90,50,.45); border-radius: 50%; box-shadow: inset 0 0 0 3px rgba(253,248,236,.75), inset 0 0 0 5px rgba(140,90,50,.3); transform: rotate(-10deg); color: rgba(140,90,50,.78); }
.future-postmark i { font-family: "SFMono-Regular", Menlo, monospace; font-style: normal; font-size: 6.5px; letter-spacing: .1em; }
.future-postmark b { font-family: "DIN Alternate", sans-serif; font-size: 15px; font-weight: 900; line-height: 1; }
.future-stamp { position: absolute; right: 16px; bottom: 34px; display: grid; gap: 3px; justify-items: center; padding: 12px 14px; border: 1.5px dashed rgba(160,121,44,.65); border-radius: 10px; transform: rotate(7deg); background: rgba(253,249,238,.85); transition: transform .24s ease; }
.future-stamp em { font-family: "SFMono-Regular", Menlo, monospace; font-style: normal; font-size: 8px; letter-spacing: .08em; color: #a0792c; }
.future-stamp strong { font-family: "DIN Alternate", sans-serif; font-size: 26px; font-weight: 900; color: var(--ink); line-height: 1; }
.deck-card-future.is-front:hover .future-stamp { transform: rotate(4deg) translateY(-3px); }

/* 作品投稿：水彩画展墙 */
.deck-card-award { background: linear-gradient(160deg, #e9f4f8 0%, #f3f8ef 58%, #edf6e7 100%); border-color: #d4e4dc; }
.deck-card-award .card-kicker { color: #4a86a8; }
.deck-card-award .deck-title { color: #2c4a52; }
.deck-card-award .deck-desc { color: #5f7472; }
.deck-card-award .coming-label { background: rgba(255,255,255,.72); border-color: #cfdfe0; color: #3a6a78; }
.award-spotlight { position: absolute; right: -50px; bottom: 20px; width: 280px; height: 280px; border-radius: 50%; background: radial-gradient(circle, rgba(255,255,255,.85) 0%, rgba(255,255,255,0) 62%); pointer-events: none; }
.award-frames { position: absolute; right: 14px; bottom: 72px; width: 152px; height: 132px; pointer-events: none; }
.award-frames i { position: absolute; padding: 5px; border-radius: 6px; background: #fdfcf7; box-shadow: 0 6px 14px rgba(74,98,110,.28); }
.award-frames b { display: block; width: 100%; height: 100%; border-radius: 3px; overflow: hidden; background: #e9e2d0; }
.award-frames img { display: block; width: 100%; height: 100%; object-fit: cover; }
.award-frames .frame-a { left: 0; top: 26px; width: 66px; height: 86px; transform: rotate(-4deg); }
.award-frames .frame-b { right: 6px; top: 0; width: 56px; height: 56px; transform: rotate(3deg); }
.award-frames .frame-c { right: 0; bottom: 0; width: 54px; height: 42px; transform: rotate(-2deg); }
.award-frames .frame-a::after, .award-frames .frame-b::after { content: ""; position: absolute; top: -7px; left: 50%; width: 30px; height: 11px; transform: translateX(-50%) rotate(-3deg); background: rgba(250,232,140,.78); box-shadow: 0 1px 2px rgba(74,98,110,.18); }
.award-frames .frame-b::after { width: 24px; transform: translateX(-50%) rotate(4deg); }
.award-badge { display: flex; align-items: center; gap: 11px; margin-top: auto; padding-top: 18px; }
.award-badge-icon { width: 40px; height: 40px; flex: 0 0 40px; display: grid; place-items: center; border-radius: 50%; background: rgba(255,255,255,.8); border: 1px solid #e3ddba; color: #d9a832; box-shadow: 0 4px 10px rgba(74,98,110,.18), inset 0 1px 0 rgba(255,255,255,.9); }
.award-badge-copy i { display: block; font-family: "SFMono-Regular", Menlo, monospace; font-style: normal; font-size: 9px; letter-spacing: .12em; line-height: 1.7; color: #4a6a72; }

/* 圆点指示器 */
.deck-dots { display: flex; justify-content: center; gap: 4px; margin-top: 18px; }
.deck-dots button { width: 28px; height: 28px; display: grid; place-items: center; padding: 0; border: none; background: none; cursor: pointer; }
.deck-dots button:focus-visible { outline: 3px solid rgba(199,242,74,.55); outline-offset: 1px; border-radius: 999px; }
.deck-dots button span { display: block; width: 6px; height: 6px; border-radius: 999px; background: rgba(10,46,59,.2); transition: width .25s ease, background .25s ease; }
.deck-dots button.active span { width: 20px; background: var(--ink); }

.site-footer { min-height: 90px; display: flex; flex-direction: column; justify-content: center; gap: 5px; border-top: 1px solid var(--border); color: var(--muted); font-size: 12px; }
.footer-code { font-family: "SFMono-Regular", Menlo, monospace; color: var(--primary-dark); letter-spacing: 0; }

@media (min-width: 700px) {
  .site-header { padding-inline: 20px; gap: 16px; }
  .brand-logo { width: 300px; height: 48px; }
  .home-main { width: min(100% - 48px,1240px); }
  .intro-row { grid-template-columns: 1.35fr .65fr; align-items: end; padding: 64px 0 38px; }
  .site-footer { flex-direction: row; align-items: center; justify-content: space-between; }
}

@media (min-width: 1024px) {
  .home-shell { padding-bottom: 0; }
  .site-header { min-height: 78px; padding: 12px 18px; }
  .brand-logo { width: 320px; height: 50px; }
  .desktop-nav { margin-left: auto; display: flex; align-items: center; gap: 4px; }
  .desktop-nav a,.desktop-nav button { min-height: 44px; display: inline-flex; align-items: center; padding: 0 14px; border-radius: 999px; color: var(--muted); text-decoration: none; font-size: 14px; font-weight: 700; }
  .desktop-nav a:hover,.desktop-nav button:hover,.desktop-nav a[aria-current="page"] { color: var(--ink); background: #e6efeb; }
}

@media (max-width: 480px) {
  .site-header { padding: 9px 12px; }
  .brand-logo { width: min(220px, 68vw); height: 40px; }
  .home-main { width: min(100% - 24px, 1240px); }
  .intro-row { padding: 30px 0 22px; }
  .intro-row h1 { font-size: clamp(30px, 10vw, 44px); }
  .intro-copy { font-size: 14px; }
  .deck-card-inner { padding: 16px; }
  .deck-title { margin-top: 16px; }
  .atlas-progress { margin-top: 18px; }
  .scan-line { bottom: 14px; }
  .site-footer { padding: 0 4px; }
}

@media (hover:hover) {
  .deck-card.is-front:hover { box-shadow: 0 26px 60px rgba(10,46,59,.17); }
}

@media (prefers-reduced-motion: reduce) {
  .eyebrow,.intro-copy,.grid-item,.intro-row h1 span,.atlas-skeleton span { opacity: 1; transform: none; animation: none; }
  .map-grid,.eyebrow span,.atlas-track i,.scan-line { animation: none; }
  .deck-card,.atlas-track i,.future-stamp { transition: none; }
}
</style>
