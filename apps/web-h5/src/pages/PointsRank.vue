<!-- src/pages/PointsRank.vue · 积分排名：按当前积分由高到低（同分先到者靠前），仅展示昵称、头像与积分 -->
<template>
  <div class="rank-page">
    <main class="rank-shell" aria-busy="loading">
      <header class="rank-header">
        <p class="rank-eyebrow"><span class="rank-node" aria-hidden="true"></span>POINTS LEADERBOARD</p>
        <div class="rank-title-row">
          <h1>积分排名</h1>
          <RouterLink class="rank-back" to="/myCheckins">
            <ArrowLeft :size="15" aria-hidden="true" />
            返回个人主页
          </RouterLink>
        </div>
        <p class="rank-desc">前 20 名上榜，同分时先达到该分数的用户排名靠前。去打卡、走路线，点亮下一个坐标。</p>
      </header>

      <!-- 加载中：保留版面高度的骨架 -->
      <section v-if="loading" class="rank-list" aria-label="正在加载积分排名">
        <div v-for="i in 6" :key="i" class="rank-row rank-skeleton" aria-hidden="true">
          <span class="sk sk-no"></span>
          <span class="sk sk-avatar"></span>
          <span class="sk sk-name"></span>
          <span class="sk sk-points"></span>
        </div>
      </section>

      <!-- 错误：给出原因与重试 -->
      <section v-else-if="loadError" class="rank-error" role="alert">
        <AlertCircle :size="26" aria-hidden="true" />
        <h2>排名暂时没有加载完成</h2>
        <p>{{ loadError }}</p>
        <button class="rank-retry" type="button" @click="fetchRank">
          <RotateCcw :size="16" aria-hidden="true" />
          重新加载
        </button>
      </section>

      <template v-else>
        <!-- 我的排名 -->
        <section v-if="myItem" class="rank-mine" aria-label="我的积分排名">
          <span class="rank-mine-no">NO.{{ myItem.rank }}</span>
          <img class="rank-avatar" :src="myItem.avatar" :alt="myItem.username + '的头像'" decoding="async" />
          <div class="rank-mine-info">
            <span class="rank-name">{{ myItem.username }}<em>（我）</em></span>
            <small>我的当前排名</small>
          </div>
          <span class="rank-points"><strong>{{ myItem.points }}</strong> 积分</span>
        </section>

        <!-- 完整榜单（仅展示前 20 名） -->
        <ol v-if="topList.length" class="rank-list" aria-label="积分排名列表">
          <li
            v-for="item in topList"
            :key="item.userId"
            class="rank-row"
            :class="{ 'is-top': item.rank <= 3, 'is-me': item.me }"
          >
            <span class="rank-no" :aria-label="`第 ${item.rank} 名`">{{ padRank(item.rank) }}</span>
            <img class="rank-avatar" :src="item.avatar" :alt="item.username + '的头像'" decoding="async" loading="lazy" />
            <span class="rank-name">{{ item.username }}<em v-if="item.me">（我）</em></span>
            <span class="rank-points"><strong>{{ item.points }}</strong> 积分</span>
          </li>
        </ol>

        <p v-else class="rank-empty">暂时还没有积分记录。去完成一次打卡，点亮第一个坐标吧。</p>
      </template>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { AlertCircle, ArrowLeft, RotateCcw } from '@lucide/vue'
import { request } from '@/utils/request'

const DEFAULT_AVATAR = 'https://img.yzcdn.cn/vant/user-active.png'

const loading = ref(true)
const loadError = ref('')
const list = ref([])

let myId = null
try {
  myId = JSON.parse(localStorage.getItem('userInfo') || '{}')?.id ?? null
} catch { /* 忽略本地缓存解析失败 */ }

const myItem = computed(() => list.value.find(item => item.me) || null)
// 榜单只展示前 20 名（后端同样只返回前 20）；跌出前 20 时“我的排名”卡片不再展示
const topList = computed(() => list.value.slice(0, 20))

function padRank(rank) {
  return String(rank).padStart(2, '0')
}

async function fetchRank() {
  loading.value = true
  loadError.value = ''
  try {
    const resp = await request('/rank/points', 'GET', null, { cacheBust: true })
    if (!resp?.ok || resp?.data?.code !== 0 || !Array.isArray(resp?.data?.list)) {
      throw new Error(resp?.data?.message || '服务暂时不可用，请稍后重试。')
    }
    list.value = resp.data.list.map(item => ({
      userId: item.userId,
      username: item.username || '匿名用户',
      avatar: item.avatar || DEFAULT_AVATAR,
      points: Number.isFinite(Number(item.points)) ? Number(item.points) : 0,
      rank: Number(item.rank) || 0,
      me: Boolean(myId && item.userId === myId)
    }))
  } catch (error) {
    loadError.value = error?.message || '网络连接异常，请稍后重试。'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  document.title = '积分排名｜笃行校园探索'
  fetchRank()
})
</script>

<style scoped>
.rank-page {
  /* 设计令牌自包含：scoped 样式里的 @import 会被加上作用域属性而失效，不能直接引入 tokens.css */
  --font-display: "Space Grotesk", "Noto Sans SC", sans-serif;
  --font-body: "Noto Sans SC", sans-serif;
  --font-mono: "JetBrains Mono", "Noto Sans SC", monospace;
  --space-3xs: 0.25rem;
  --space-2xs: 0.5rem;
  --space-sm: 0.75rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-2xl: 3rem;
  --space-3xl: 4.5rem;
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --radius-sm: 0.375rem;
  --radius-pill: 999px;
  --duration-fast: 120ms;
  --duration-base: 180ms;
  --ease-standard: cubic-bezier(0.2, 0.8, 0.2, 1);

  --ise-ink: #0a2e3b;
  --ise-primary: #0d9488;
  --ise-primary-dark: #08766d;
  --ise-accent: #c7f24a;
  --ise-canvas: #f3f7f5;
  --ise-surface: #ffffff;
  --ise-text: #102a2e;
  --ise-muted: #5e7271;
  --ise-border: #d6e4df;
  --ise-soft: #edf5f2;

  min-height: 100vh;
  color: var(--ise-text);
  background-color: var(--ise-canvas);
  background-image:
    linear-gradient(rgb(10 46 59 / 0.032) 1px, transparent 1px),
    linear-gradient(90deg, rgb(10 46 59 / 0.032) 1px, transparent 1px);
  background-size: 32px 32px;
  font-family: var(--font-body);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  padding-bottom: calc(86px + env(safe-area-inset-bottom, 0px));
}

.rank-shell {
  width: min(100% - 2 * var(--space-md), 44rem);
  margin-inline: auto;
  padding-top: var(--space-2xl);
}

/* 头部 */
.rank-eyebrow {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0;
  color: var(--ise-primary-dark);
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.rank-node {
  width: 7px;
  height: 7px;
  background: var(--ise-accent);
  border: 1px solid var(--ise-ink);
  border-radius: 50%;
}

.rank-title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
}

.rank-title-row h1 {
  margin: 0;
  color: var(--ise-ink);
  font-family: var(--font-display);
  font-size: clamp(1.9rem, 6vw, 2.6rem);
  font-weight: 700;
  line-height: 1.05;
}

.rank-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  color: var(--ise-primary-dark);
  font-size: var(--text-sm);
  font-weight: 600;
  text-decoration: none;
}

.rank-back:hover {
  text-decoration: underline;
  text-underline-offset: 4px;
}

.rank-desc {
  max-width: 34rem;
  margin: var(--space-2xs) 0 0;
  color: var(--ise-muted);
  font-size: var(--text-sm);
}

/* 榜单 */
.rank-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: var(--space-lg) 0 0;
  padding: 0;
  list-style: none;
}

.rank-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  min-height: 4.25rem;
  padding: var(--space-sm) var(--space-md);
  background: var(--ise-surface);
  border: 1px solid var(--ise-border);
  border-radius: 16px;
}

.rank-row.is-me {
  border-color: var(--ise-ink);
  box-shadow: inset 0 0 0 1px var(--ise-ink);
}

.rank-no {
  min-width: 2.25rem;
  color: var(--ise-muted);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  font-weight: 700;
  text-align: center;
}

.rank-row.is-top .rank-no {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.25rem;
  height: 2.25rem;
  color: var(--ise-ink);
  background: var(--ise-accent);
  border: 1px solid var(--ise-ink);
  border-radius: 50%;
}

.rank-avatar {
  width: 42px;
  height: 42px;
  flex: none;
  background: var(--ise-soft);
  border: 1px solid var(--ise-border);
  border-radius: 50%;
  object-fit: cover;
}

.rank-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--ise-ink);
  font-size: var(--text-base);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-name em {
  color: var(--ise-primary-dark);
  font-size: var(--text-xs);
  font-style: normal;
}

.rank-points {
  flex: none;
  color: var(--ise-muted);
  font-size: var(--text-xs);
  white-space: nowrap;
}

.rank-points strong {
  color: var(--ise-ink);
  font-family: var(--font-display);
  font-size: 1.35rem;
  font-weight: 700;
}

/* 我的排名卡 */
.rank-mine {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-top: var(--space-lg);
  padding: var(--space-md);
  background: var(--ise-surface);
  border: 1px solid var(--ise-ink);
  border-radius: 20px;
}

.rank-mine-no {
  flex: none;
  padding: 4px 10px;
  color: var(--ise-ink);
  background: var(--ise-accent);
  border: 1px solid var(--ise-ink);
  border-radius: var(--radius-pill);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 700;
}

.rank-mine-info {
  flex: 1;
  min-width: 0;
}

.rank-mine-info small {
  display: block;
  color: var(--ise-muted);
  font-size: var(--text-xs);
}

/* 骨架 */
.rank-skeleton {
  pointer-events: none;
}

.sk {
  display: block;
  background: var(--ise-soft);
  border-radius: var(--radius-sm);
}

.sk-no { width: 2.25rem; height: 1rem; }
.sk-avatar { width: 42px; height: 42px; border-radius: 50%; }
.sk-name { flex: 1; height: 1rem; }
.sk-points { width: 3.5rem; height: 1.25rem; }

/* 错误与空态 */
.rank-error {
  margin-top: var(--space-lg);
  padding: var(--space-2xl) var(--space-lg);
  color: var(--ise-ink);
  background: var(--ise-surface);
  border: 1px solid var(--ise-border);
  border-radius: 20px;
  text-align: center;
}

.rank-error h2 {
  margin: var(--space-sm) 0 var(--space-3xs);
  font-size: var(--text-lg);
}

.rank-error p {
  margin: 0 0 var(--space-lg);
  color: var(--ise-muted);
  font-size: var(--text-sm);
}

.rank-retry {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 var(--space-lg);
  color: var(--ise-ink);
  background: var(--ise-accent);
  border: 1px solid var(--ise-ink);
  border-radius: var(--radius-pill);
  font-weight: 700;
  cursor: pointer;
}

.rank-empty {
  margin-top: var(--space-lg);
  padding: var(--space-2xl) var(--space-lg);
  color: var(--ise-muted);
  background: var(--ise-surface);
  border: 1px dashed var(--ise-border);
  border-radius: 20px;
  font-size: var(--text-sm);
  text-align: center;
}

/* 焦点 */
.rank-page :where(a, button):focus-visible {
  outline: 3px solid var(--ise-accent);
  outline-offset: 2px;
  box-shadow: 0 0 0 1px var(--ise-ink);
}

@media (min-width: 1024px) {
  .rank-page { padding-bottom: var(--space-3xl); }
}

@media (prefers-reduced-motion: reduce) {
  .rank-page *,
  .rank-page *::before,
  .rank-page *::after {
    scroll-behavior: auto !important;
    animation-duration: 1ms !important;
    transition-duration: 1ms !important;
  }
}
</style>
