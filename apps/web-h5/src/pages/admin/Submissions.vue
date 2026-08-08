<!-- src/pages/admin/Submissions.vue -->
<template>
  <div class="page">
    <div class="topbar">
      <button class="back-btn" type="button" @click="router.push('/admin/review')">‹ 返回审核台</button>
      <h1>奖项投稿审核</h1>
      <button class="export-btn" type="button" :disabled="exporting" @click="exportCsv">
        {{ exporting ? '导出中…' : '导出投稿名单' }}
      </button>
    </div>

    <!-- 统计 -->
    <div v-if="stat" class="stats">
      <div class="stat-item"><b>{{ stat.all }}</b><span>全部投稿</span></div>
      <div class="stat-item pending"><b>{{ stat.pending }}</b><span>待审核</span></div>
      <div class="stat-item approved"><b>{{ stat.approved }}</b><span>已通过</span></div>
      <div class="stat-item rejected"><b>{{ stat.rejected }}</b><span>已驳回</span></div>
      <div class="stat-item featured"><b>{{ stat.featured }}</b><span>优秀作品</span></div>
    </div>

    <div v-if="stat" class="category-stats">
      <div v-for="(v, catId) in stat.byCategory" :key="catId" class="cat-stat">
        <b>{{ catName(catId) }}</b>
        <span>共 {{ v.all }} 份 · 待审 {{ v.pending }} · 通过 {{ v.approved }} · 优秀 {{ v.featured }}</span>
      </div>
    </div>

    <!-- 筛选 -->
    <div class="filters">
      <div class="tabs">
        <button
          v-for="t in statusTabs"
          :key="t.value"
          type="button"
          :class="{ active: status === t.value }"
          @click="setStatus(t.value)"
        >{{ t.label }}</button>
      </div>
      <select v-model="category" @change="fetchList">
        <option value="all">全部奖项</option>
        <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
    </div>

    <!-- 列表 -->
    <div v-if="loading" class="empty">加载中…</div>
    <div v-else-if="!list.length" class="empty">暂无数据</div>

    <div v-else class="card-list">
      <article v-for="item in list" :key="item.id" class="card">
        <div class="imgs">
          <img
            v-for="(img, i) in item.images.slice(0, 3)"
            :key="i"
            :src="img.url"
            :alt="`${item.title} 图${i + 1}`"
            @click="preview(img.url)"
          />
        </div>
        <div class="info">
          <div class="title-row">
            <b>{{ item.title }}</b>
            <span class="tag cat">{{ item.categoryName }}</span>
            <span class="tag" :class="item.status">{{ statusText(item.status) }}</span>
            <span v-if="item.featured" class="tag featured">优秀</span>
            <span v-if="item.winnerRank" class="tag winner">{{ item.winnerLabel }}</span>
            <span v-if="item.appealStatus === 'pending'" class="tag appeal">申诉中</span>
          </div>
          <p class="desc">{{ item.description }}</p>
          <p v-if="item.appealStatus === 'pending'" class="appeal-reason">
            申诉理由：{{ item.appealReason }}
          </p>
          <div class="meta">
            <span>投稿人：{{ item.username }}</span>
            <span>打卡点：{{ item.locationName }}</span>
            <span>时间：{{ fmtTime(item.createdAt) }}</span>
          </div>
          <p v-if="item.reviewNote" class="note">审核意见：{{ item.reviewNote }}</p>
        </div>
        <div class="ops">
          <button
            v-if="item.status === 'pending' || (item.status === 'rejected' && item.appealStatus === 'pending')"
            class="btn approve"
            type="button"
            :disabled="busy[item.id]"
            @click="approve(item)"
          >{{ item.appealStatus === 'pending' ? '通过申诉' : '通过' }}</button>
          <button
            v-if="item.status === 'pending' || (item.status === 'rejected' && item.appealStatus === 'pending')"
            class="btn reject"
            type="button"
            :disabled="busy[item.id]"
            @click="reject(item)"
          >{{ item.appealStatus === 'pending' ? '维持驳回' : '驳回' }}</button>
          <button
            v-if="item.status === 'approved'"
            class="btn feature"
            type="button"
            :disabled="busy[item.id]"
            @click="toggleFeature(item)"
          >{{ item.featured ? '取消优秀' : '标记优秀' }}</button>
          <div v-if="item.status === 'approved'" class="winner-row">
            <select v-model="winnerDrafts[item.id]" :disabled="busy[item.id]">
              <option value="">未获奖</option>
              <option v-for="r in winnerRanks" :key="r.id" :value="r.id">{{ r.label }}</option>
            </select>
            <button class="btn feature" type="button" :disabled="busy[item.id]" @click="saveWinner(item)">
              保存获奖
            </button>
          </div>
        </div>
      </article>
    </div>

    <!-- 大图预览 -->
    <div v-if="previewUrl" class="preview-mask" @click.self="previewUrl = ''">
      <img :src="previewUrl" alt="作品大图" />
      <button type="button" @click="previewUrl = ''">关闭</button>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { request } from '@/utils/request'
import { AWARD_CONFIG } from '@/data/awards'

const router = useRouter()
const loading = ref(false)
const exporting = ref(false)
const list = ref([])
const stat = ref(null)
const status = ref('all')
const category = ref('all')
const busy = ref({})
const previewUrl = ref('')
const winnerDrafts = ref({})
const winnerRanks = AWARD_CONFIG.winnerRanks || []

const statusTabs = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待审核' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已驳回' },
  { value: 'featured', label: '优秀' }
]
const categories = ref([
  { id: 'creative', name: '最佳创意奖' },
  { id: 'photography', name: '最佳摄影奖' }
])

function catName(id) {
  return categories.value.find(c => c.id === id)?.name || id
}

function statusText(s) {
  return { pending: '待审核', approved: '已通过', rejected: '已驳回' }[s] || s
}

function fmtTime(ts) {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
  } catch {
    return String(ts)
  }
}

function isOk(res) {
  return res?.data?.code === 0
}

async function fetchList() {
  loading.value = true
  try {
    const res = await request('/admin/submissions', 'GET', {
      status: status.value,
      category: category.value
    })
    if (isOk(res)) {
      list.value = res.data.list || []
      stat.value = res.data.stat || null
      const drafts = {}
      list.value.forEach(item => { drafts[item.id] = item.winnerRank || '' })
      winnerDrafts.value = drafts
    }
  } catch {
    list.value = []
  } finally {
    loading.value = false
  }
}

function setStatus(value) {
  status.value = value
  fetchList()
}

function markBusy(id, on) {
  const next = { ...busy.value }
  if (on) next[id] = true
  else delete next[id]
  busy.value = next
}

async function approve(item) {
  if (busy.value[item.id]) return
  markBusy(item.id, true)
  try {
    const res = await request(`/admin/submissions/${encodeURIComponent(item.id)}/approve`, 'POST', {})
    if (isOk(res)) fetchList()
    else alert(res?.data?.message || '操作失败')
  } catch {
    alert('操作失败，请重试')
  } finally {
    markBusy(item.id, false)
  }
}

async function reject(item) {
  if (busy.value[item.id]) return
  let note = window.prompt(`驳回《${item.title}》，请填写驳回理由：`, '')
  if (note === null) return
  while (!String(note).trim()) {
    alert('请填写驳回理由，用户需要看到原因')
    note = window.prompt(`驳回《${item.title}》，请填写驳回理由：`, '')
    if (note === null) return
  }
  markBusy(item.id, true)
  try {
    const res = await request(`/admin/submissions/${encodeURIComponent(item.id)}/reject`, 'POST', { note })
    if (isOk(res)) fetchList()
    else alert(res?.data?.message || '操作失败')
  } catch {
    alert('操作失败，请重试')
  } finally {
    markBusy(item.id, false)
  }
}

async function toggleFeature(item) {
  if (busy.value[item.id]) return
  markBusy(item.id, true)
  try {
    const res = await request(`/admin/submissions/${encodeURIComponent(item.id)}/feature`, 'POST', {
      featured: !item.featured
    })
    if (isOk(res)) fetchList()
    else alert(res?.data?.message || '操作失败')
  } catch {
    alert('操作失败，请重试')
  } finally {
    markBusy(item.id, false)
  }
}

async function saveWinner(item) {
  if (busy.value[item.id]) return
  markBusy(item.id, true)
  try {
    const res = await request(`/admin/submissions/${encodeURIComponent(item.id)}/winner`, 'POST', {
      rank: winnerDrafts.value[item.id] || ''
    })
    if (isOk(res)) fetchList()
    else alert(res?.data?.message || '操作失败')
  } catch {
    alert('操作失败，请重试')
  } finally {
    markBusy(item.id, false)
  }
}

async function exportCsv() {
  exporting.value = true
  try {
    const res = await request('/admin/submissions/export', 'GET', { category: category.value }, {
      responseType: 'blob'
    })
    if (!res || !res.data) throw new Error('导出失败')
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `奖项投稿名单_${Date.now()}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch (e) {
    alert(e?.message || '导出失败，请重试')
  } finally {
    exporting.value = false
  }
}

function preview(url) {
  if (url) previewUrl.value = url
}

onMounted(() => {
  document.title = '奖项投稿审核'
  fetchList()
})
</script>

<style scoped>
.page { padding: 12px; color: #17231e; font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif; }
.topbar { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.back-btn { border: 1px solid #d8d4c9; background: #fff; color: #49584f; padding: 7px 14px; border-radius: 999px; font-size: 12px; cursor: pointer; }
.topbar h1 { margin: 0; font-size: 19px; flex: 1; }
.export-btn { border: 0; background: #0d9488; color: #fff; padding: 9px 16px; border-radius: 999px; font-size: 13px; cursor: pointer; }
.export-btn:disabled { opacity: .6; cursor: wait; }

.stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 8px; }
.stat-item { display: grid; gap: 2px; padding: 12px 10px; border-radius: 12px; background: #fff; border: 1px solid #e8e4da; text-align: center; }
.stat-item b { font-size: 22px; color: #17231e; }
.stat-item span { font-size: 11px; color: #8a958f; }
.stat-item.pending b { color: #b45309; }
.stat-item.approved b { color: #0a7a54; }
.stat-item.rejected b { color: #b42318; }
.stat-item.featured b { color: #a16207; }

.category-stats { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.cat-stat { display: flex; flex-direction: column; gap: 3px; padding: 9px 14px; border-radius: 10px; background: #fff; border: 1px dashed #d8d4c9; }
.cat-stat b { font-size: 13px; color: #0d9488; }
.cat-stat span { font-size: 11px; color: #7b857f; }

.filters { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.tabs { display: flex; gap: 6px; flex-wrap: wrap; }
.tabs button { border: 1px solid #e2e0d8; background: #fff; color: #49584f; padding: 7px 13px; border-radius: 999px; font-size: 12px; cursor: pointer; }
.tabs button.active { background: #102a2e; border-color: #102a2e; color: #fff; }
.filters select { padding: 8px 10px; border: 1px solid #d8d4c9; border-radius: 10px; background: #fff; font-size: 12px; color: #17231e; }

.card-list { display: grid; gap: 10px; }
.card { display: grid; grid-template-columns: 1fr; gap: 10px; padding: 12px; border-radius: 14px; background: #fff; border: 1px solid #e8e4da; }
.imgs { display: flex; gap: 6px; }
.imgs img { width: 86px; height: 86px; border-radius: 8px; object-fit: cover; cursor: zoom-in; background: #f1efe8; }
.info { min-width: 0; }
.title-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.title-row b { font-size: 15px; }
.tag { padding: 2px 8px; border-radius: 999px; font-size: 11px; }
.tag.cat { background: #eef2ff; color: #3730a3; }
.tag.pending { background: #fff7e6; color: #b45309; }
.tag.approved { background: #e6f7ef; color: #0a7a54; }
.tag.rejected { background: #fdeeee; color: #b42318; }
.tag.featured { background: #fff1d6; color: #a16207; }
.tag.winner { background: #fdece8; color: #c2410c; }
.tag.appeal { background: #eef2ff; color: #3730a3; }
.appeal-reason { margin: 8px 0 0; color: #3730a3; font-size: 12px; background: #eef2ff; padding: 8px 10px; border-radius: 8px; }
.desc { margin: 8px 0; color: #5f6d66; font-size: 13px; line-height: 1.65; }
.meta { display: flex; flex-wrap: wrap; gap: 10px; color: #8a958f; font-size: 11px; }
.note { margin: 8px 0 0; color: #b42318; font-size: 12px; }
.ops { display: flex; gap: 8px; flex-wrap: wrap; }
.btn { border: 0; padding: 8px 16px; border-radius: 999px; font-size: 12px; cursor: pointer; }
.btn:disabled { opacity: .55; cursor: wait; }
.btn.approve { background: #0d9488; color: #fff; }
.btn.reject { background: #b42318; color: #fff; }
.btn.feature { background: #f2c14e; color: #5c3a00; }
.winner-row { display: flex; align-items: center; gap: 8px; }
.winner-row select { padding: 7px 9px; border: 1px solid #d8d4c9; border-radius: 10px; background: #fff; font-size: 12px; color: #17231e; }

.empty { padding: 40px 0; text-align: center; color: #8a958f; font-size: 14px; }
.preview-mask { position: fixed; inset: 0; z-index: 90; display: grid; place-items: center; padding: 20px; background: rgba(8,18,15,.82); }
.preview-mask img { max-width: 92vw; max-height: 84vh; border-radius: 12px; }
.preview-mask button { position: fixed; top: 20px; right: 20px; border: 0; border-radius: 999px; background: rgba(255,255,255,.15); color: #fff; padding: 9px 16px; cursor: pointer; }

@media (min-width: 720px) {
  .card { grid-template-columns: auto 1fr; }
  .ops { flex-direction: column; align-items: flex-end; }
}
</style>
