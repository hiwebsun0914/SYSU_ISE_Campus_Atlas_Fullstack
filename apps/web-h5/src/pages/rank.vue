<!-- src/pages/rank.vue -->
<template>
  <div class="page">
    <!-- 全屏背景 -->
    <img class="bg" src="https://sysuzngcxy-1322240898.cos.ap-guangzhou.myqcloud.com/bg.jpg" alt="bg" />
    <div class="bg-mask"></div>

    <!-- 顶部 Logo（按角色切换） -->
    <div class="logo-container">
      <img
        class="logo-img"
        src="https://sysuzngcxy-1322240898.cos.ap-guangzhou.myqcloud.com/logo1.png"
        alt="logo"
      />
    </div>

    <!-- 内容 -->
    <div class="content">
      <p v-if="resultEmbargoed" class="empty" role="status">打卡排名暂不展示，结果将于北京时间 9 月 19 日 18:00 公布。</p>
      <template v-else>
      <!-- 我的排名卡片（如果存在） -->
      <div v-if="myItem" class="my-card">
        <img class="avatar lg" :src="myItem.avatar" alt="avatar" />
        <div class="info">
          <div class="name">
            {{ myItem.username }}
            <span class="me-tag"></span>
          </div>
          <div class="sub">
            已解锁 <span class="num">{{ myItem.unlocked }}</span>
            · 审核中 <span class="num">{{ myItem.locking }}</span>
            · 总计 <span class="num">{{ myItem.count }}</span>
          </div>
        </div>
        <div class="chip" :class="myItem.rankClass">{{ myItem.rank }}</div>
      </div>

      <div class="section-title">全部排名</div>

      <!-- 完整列表（包含“我”） -->
      <div
        v-for="item in list"
        :key="item.userId ?? item.id ?? item.username"
        class="row"
        :class="[item.rankClass, item.me ? 'me' : '']"
      >
        <div class="rank" :class="item.rankClass">
          {{ rankDisplay(item.rank) }}
        </div>

        <img class="avatar" :src="item.avatar" alt="avatar" />

        <div class="cell">
          <div class="title">
            {{ item.username }}
            <span v-if="item.me" class="me-tag">（我）</span>
          </div>
          <div class="desc">
            已解锁 {{ item.unlocked }} · 审核中 {{ item.locking }} · 总计 {{ item.count }} ·
          </div>
        </div>
      </div>

      <div class="empty" v-if="!loading && list.length === 0">暂无数据</div>
      </template>
    </div>

    <button v-if="!resultEmbargoed" class="refresh" :disabled="loading" @click="fetchRank">
      {{ loading ? '加载中…' : '刷新' }}
    </button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { request } from '@/utils/request'
import { resultEmbargoed, refreshResultRole } from '@/stores/resultReveal'

const DEFAULT_AVATAR = 'https://img.yzcdn.cn/vant/user-active.png'

// —— 小工具：安全数值化
function n(v, d = 0) {
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string' && /^\d+$/.test(v)) return Number(v)
  return d
}
function toOk(resp) {
  const ok = (resp?.status === 200) || (resp?.statusCode === 200)
  return ok && resp?.data?.code === 0
}
function tsNum(v, fallback = Number.MAX_SAFE_INTEGER) {
  if (typeof v === 'number') return v
  if (typeof v === 'string' && /^\d+$/.test(v)) return Number(v)
  // 若是可解析的日期字符串，也尝试解析
  const t = Date.parse(v)
  return Number.isNaN(t) ? fallback : t
}

const loading = ref(true)
const list = ref([]) // [{userId, username, avatar, unlocked, locking, count, createdAt, updatedAt, rank, rankClass, me}]
const userRole = ref('visitor')

// 取“我”的用户 ID：优先本地缓存，再尝试 /auth/me
let myId = null

onMounted(async () => {
  document.title = '打卡排名'
  try {
    const localUser = JSON.parse(localStorage.getItem('userInfo') || '{}')
    myId = localUser?.id ?? null
  } catch {}
  await fetchMeRole()
  await refreshResultRole()
  await fetchRank()
})
watch(resultEmbargoed, value => {
  if (value) list.value = []
  else fetchRank()
})

async function fetchMeRole() {
  try {
    const me = await request('/auth/me', 'GET')
    if (toOk(me)) {
      userRole.value = me.data?.userInfo?.role || 'visitor'
      if (!myId) myId = me.data?.userInfo?.id ?? null
      // 顺便把最新 userInfo 缓存一下
      const localUser = JSON.parse(localStorage.getItem('userInfo') || '{}')
      localStorage.setItem('userInfo', JSON.stringify({ ...localUser, ...me.data.userInfo }))
    }
  } catch { /* 静默 */ }
}

async function fetchRank() {
  loading.value = true
  try {
    const resp = await request('/rank/list', 'GET')
    let arr = (toOk(resp) && Array.isArray(resp.data?.list)) ? resp.data.list : []

    // 统一字段、计算 count、补齐头像
    arr = arr.map(it => {
      const unlocked = n(it.unlocked, 0)
      const locking  = n(it.locking, 0)
      const count    = ('count' in it) ? n(it.count, unlocked + locking) : (unlocked + locking)
      return {
        ...it,
        userId   : it.userId ?? it.id, // 兜底
        avatar   : it.avatar || DEFAULT_AVATAR,
        unlocked,
        locking,
        count,
        createdAt: tsNum(it.createdAt, Number.MAX_SAFE_INTEGER),
        updatedAt: tsNum(it.updatedAt, Number.MAX_SAFE_INTEGER),
      }
    })

    // 排序：count desc → updatedAt asc → createdAt asc → username（zh）
    arr.sort((a, b) =>
      (b.count - a.count) ||
      (a.updatedAt - b.updatedAt) ||
      (a.createdAt - b.createdAt) ||
      String(a.username || '').localeCompare(String(b.username || ''), 'zh')
    )

    // 标注 rank、Top3 class、是否“我”
    arr = arr.map((it, idx) => ({
      ...it,
      rank: idx + 1,
      rankClass: idx === 0 ? 'first' : idx === 1 ? 'second' : idx === 2 ? 'third' : '',
      me: !!(myId && it.userId === myId)
    }))

    if (!resultEmbargoed.value) list.value = arr
  } catch (e) {
    console.error('[rank] fetch error', e)
    alert('加载失败')
  } finally {
    loading.value = false
  }
}

const myItem = computed(() => list.value.find(x => x.me))

function rankDisplay(r) {
  if (r === 1) return '🥇'
  if (r === 2) return '🥈'
  if (r === 3) return '🥉'
  return String(r)
}
</script>

<style scoped>
.page{ min-height:100vh; position:relative; }

/* 背景 */
.bg{
  position:fixed; left:0; top:0; width:100vw; height:100vh;
  z-index:-2; object-fit:cover;
}
.bg-mask{
  position:fixed; inset:0;
  background: rgba(255,255,255,.06);
  z-index:-1;
}

/* 顶部 Logo */
.logo-container{
  display:flex; justify-content:center;
  margin-top:25px; padding:25px 0;
}
.logo-img{ width:200px; }

/* 内容容器 */
.content{ padding:12px; }

/* 我的排名卡片 */
.my-card{
  display:flex; align-items:center;
  background:rgba(255,255,255,.88);
  border:1px solid rgba(255,255,255,.6);
  border-radius:11px; padding:12px;
  box-shadow:0 5px 14px rgba(0,0,0,.12);
}
.avatar{ width:42px; height:42px; border-radius:50%; background:#eee; object-fit:cover; }
.avatar.lg{ width:48px; height:48px; }
.my-card .avatar{ margin-right:11px; }

.info{ flex:1; min-width:0; }
.name{
  font-size:15px; font-weight:700; color:#111;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.sub{ font-size:12px; color:#9fb0b6; margin-top:3px; }
.num{ color:#175c28; font-weight:800; }

/* 名次圆徽 */
.chip{
  width:44px; height:44px; border-radius:50%;
  display:flex; align-items:center; justify-content:center;
  color:#fff; font-size:15px; font-weight:800;
  background:linear-gradient(135deg,#175c28,#1c6a31);
}
.chip.first{  background:linear-gradient(135deg,#ffcc4d,#f3a000); color:#3b2a00; }
.chip.second{ background:linear-gradient(135deg,#cfd8ff,#6ea0ff); color:#0f2c5a; }
.chip.third{  background:linear-gradient(135deg,#ffd9b3,#ffb266); color:#6b3c00; }

.section-title{ color:#000; font-size:12px; margin:11px 4px 7px; }

/* 列表行 */
.row{
  display:flex; align-items:center;
  background:rgba(255,255,255,.86);
  border:1px solid rgba(255,255,255,.55);
  border-radius:9px; padding:10px;
  margin-bottom:8px;
  box-shadow:0 3px 9px rgba(0,0,0,.10);
}
.row .rank{ margin-right:9px; }
.row .avatar{ margin-right:9px; }

.rank{
  min-width:32px; height:32px; border-radius:50%;
  display:flex; align-items:center; justify-content:center;
  font-weight:800; color:#fff; background:#9fb3c2;
}
.rank.first{  background:#ffcc4d; color:#3b2a00; }
.rank.second{ background:#9fc2ff; color:#10305e; }
.rank.third{  background:#ffc28a; color:#6b3c00; }

.cell{ flex:1; min-width:0; }
.title{
  font-size:14px; font-weight:600; color:#1e2930;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.desc{ font-size:12px; color:#6f8189; margin-top:2px; }

.empty{ color:#e6edf0; text-align:center; padding:40px 0; }
.row.me { border-color:#175c28; box-shadow:0 3px 11px rgba(23,92,40,.18); }
.me-tag { color:#175c28; font-size:11px; margin-left:6px; }

/* 右下角刷新按钮 */
.refresh{
  position: fixed; right: 12px; bottom: 12px;
  background: rgba(17,24,39,.9); color: #fff;
  padding: 8px 10px; border-radius: 8px; font-size: 12px;
  border: none; cursor: pointer;
}
.refresh:disabled{ opacity:.6; cursor:not-allowed; }
</style>
