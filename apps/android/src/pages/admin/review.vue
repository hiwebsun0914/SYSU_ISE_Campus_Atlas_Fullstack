<!-- src/pages/admin/review.vue -->
<template>
  <div class="page">
    <!-- 顶部标签 -->
    <div class="tabs">
      <button
        class="tab"
        :class="{ active: currentTab === 'checkins' }"
        @click="switchTab('checkins')"
      >打卡审核</button>

      <button
        class="tab"
        :class="{ active: currentTab === 'bottles' }"
        @click="switchTab('bottles')"
      >漂流瓶</button>

      <button
        class="tab"
        :class="{ active: currentTab === 'users' }"
        @click="switchTab('users')"
      >用户</button>
    </div>

    <!-- ========== 打卡审核 ========== -->
    <div v-if="currentTab === 'checkins'">
      <div class="filter">
        <label>
          状态：
          <select v-model.number="checkinStatusIndex" @change="fetchCheckins">
            <option v-for="(opt, i) in checkinStatusOptions" :key="opt.value" :value="i">
              {{ opt.label }}
            </option>
          </select>
        </label>

        <div v-if="checkinStat" class="stat">
          待审核 {{ checkinStat.pending }} · 已通过 {{ checkinStat.approved }}
        </div>
      </div>

      <div v-for="item in checkins" :key="item.id" class="card">
        <img class="thumb" :src="item.photo" alt="照片" @click="previewImage(item.photo)" />
        <div class="info">
          <div class="title">{{ item.username }}</div>
          <div class="meta">地点：{{ item._locName }}（#{{ item.locationId }}）</div>
          <div class="meta">提交：{{ item._uploadTime }}</div>
          <div class="tags">
            <span class="tag" :class="item.status">
              {{ item.status === 'pending' ? '待审核' : '已通过' }}
            </span>
          </div>
        </div>

        <div class="ops" v-if="item.status === 'pending'">
          <button
            class="btn btn-primary"
            :disabled="!!moderating[item.id] || loading"
            @click="approveCheckin(item.id)"
          >
            {{ moderating[item.id] ? '处理中…' : '通过' }}
          </button>
          <button
            class="btn btn-warn"
            :disabled="!!moderating[item.id] || loading"
            @click="rejectCheckin(item.id)"
          >
            {{ moderating[item.id] ? '处理中…' : '驳回' }}
          </button>
        </div>
      </div>

      <div class="empty" v-if="!loading && (!checkins || !checkins.length)">暂无数据</div>
    </div>

    <!-- ========== 漂流瓶 ========== -->
    <div v-if="currentTab === 'bottles'">
      <div class="filter">
        <label>
          状态：
          <select v-model.number="bottleStatusIndex" @change="fetchBottles">
            <option v-for="(opt, i) in bottleStatusOptions" :key="opt.value" :value="i">
              {{ opt.label }}
            </option>
          </select>
        </label>

        <div v-if="bottleStat" class="stat">
          全部 {{ bottleStat.all }} · 未被捡 {{ bottleStat.unpicked }} · 已被捡 {{ bottleStat.picked }}
        </div>
      </div>

      <div v-for="item in bottles" :key="item.id" class="card">
        <img class="thumb" :src="item.photo" alt="漂流瓶图片" @click="previewImage(item.photo)" />
        <div class="info">
          <div class="title">{{ item.text || '（无文字内容）' }}</div>
          <div class="meta">发送人：{{ item.ownerName }}</div>
          <div class="meta">发送时间：{{ item._uploadTime }}</div>

          <div class="meta" v-if="item._picks && item._picks.length">
            拾取人：
            <template v-for="(p, idx) in item._picks" :key="p.userId + '-' + idx">
              <span>{{ p.name || ('#' + p.userId) }}</span>
              <span>（{{ p._pickTime }}）</span>
              <span v-if="idx < item._picks.length - 1">、</span>
            </template>
          </div>
          <div class="meta" v-else>拾取人：—</div>
        </div>

        <div class="ops">
          <button
            class="btn btn-warn"
            :disabled="!!deleting[item.id] || loading"
            @click="deleteBottle(item)"
          >
            {{ deleting[item.id] ? '删除中…' : '删除' }}
          </button>
        </div>
      </div>

      <div class="empty" v-if="!loading && (!bottles || !bottles.length)">暂无漂流瓶</div>
    </div>

    <!-- ========== 用户（可折叠详情） ========== -->
    <div v-if="currentTab === 'users'">
      <div v-for="item in users" :key="item.id">
        <!-- 用户行 -->
        <div class="row row-click" @click="toggleUser(item)">
          <img class="avatar" :src="item.avatar" alt="头像" />
          <div class="cell">
            <div class="name">
              {{ item.username }}（{{ item.role }}）
              <span class="chev">{{ expanded[item.id] ? '▾' : '▸' }}</span>
            </div>
            <div class="desc">
              已解锁：{{ item.unlocked }}　审核中：{{ item.locking }}　扔瓶：{{ item.threw }}
            </div>
          </div>
        </div>

        <!-- 详情：紧跟在该用户行后面 -->
        <div v-show="expanded[item.id]" class="detail">
          <div class="detail-row">
            <div class="detail-title">注册时间</div>
            <div class="detail-body">
              {{ details[item.id]?.regTimeText || '—' }}
            </div>
          </div>

          <div class="detail-row">
            <div class="detail-title">各地点打卡时间</div>
            <div class="detail-body">
              <template v-if="details[item.id]?.checkins && Object.keys(details[item.id].checkins).length">
                <div
                  v-for="(times, locId) in details[item.id].checkins"
                  :key="item.id + '-' + locId"
                  class="chips-line"
                >
                  <div class="chip chip-title">{{ LOC_NAME[locId] || ('#' + locId) }}</div>
                  <div class="chips">
                    <span v-for="(t, i) in times" :key="item.id + '-' + locId + '-' + i" class="chip">{{ t }}</span>
                  </div>
                </div>
              </template>
              <span v-else>—</span>
            </div>
          </div>

          <div class="detail-row">
            <div class="detail-title">扔瓶时间</div>
            <div class="detail-body">
              <template v-if="details[item.id]?.throws?.length">
                <div class="chips">
                  <span v-for="(t, i) in details[item.id].throws" :key="'throw-' + item.id + '-' + i" class="chip">{{ t }}</span>
                </div>
              </template>
              <span v-else>—</span>
            </div>
          </div>
        </div>
      </div>

      <div class="empty" v-if="!loading && (!users || !users.length)">暂无用户</div>
    </div>

    <div v-if="loading" class="loading">加载中…</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { request } from '@/utils/request'

/* 地点名映射 */
const LOC_NAME = {
  1:'何尔达屋',2:'高利士屋',3:'宾省校屋',4:'端木正教授像',5:'韦耶孝实屋',6:'伦敦会屋',7:'美臣屋一号',8:'白德理屋',9:'屈林宾屋',10:'惠师礼屋',
  11:'马岗堂',12:'图书馆',13:'黄焕秋校长像',14:'格兰堂',15:'廖承志像',16:'马丁堂',17:'附属小学建筑群',18:'南草坪餐厅',19:'第一教学楼',20:'附属小学方亭',
  21:'荣光堂',22:'中山大学南门',23:'生命科学楼',24:'蚕丝学院制种室',25:'生物楼',26:'达尔文雕塑',27:'曾宪梓堂',28:'蒲蛰龙雕塑',29:'马文辉堂',30:'贺丹青堂',
  31:'测试大楼',32:'竹林',33:'中山楼',34:'梁銶琚堂',35:'研究生院',36:'张弼士堂',37:'逸夫楼',38:'西大操场',39:'洗为坚堂',40:'紫荆园餐厅',
  41:'协和神学院建筑群',42:'芙兰堂',43:'锡昌堂',44:'四墩楼',45:'8号住宅',46:'孖屋二',47:'谭礼庭屋',48:'马应彪夫人护养院',49:'麻金墨屋二号',50:'怀士堂',
  51:'鲁迅先生像',52:'校训雕像',53:'希伦高屋',54:'黑石屋',55:'麻金墨屋一号',56:'美臣屋二号',57:'神甫屋',58:'积臣屋',59:'英东体育馆',60:'新女学',
  61:'“摇篮”铜像',62:'冼星海半身铜像',63:'翘燊堂、文虎堂',64:'松涛园',65:'新体育馆',66:'松园湖',67:'第二教学楼',68:'卡彭特楼',69:'林护堂、黄铭衍堂与黄传经堂',70:'叶葆定堂',
  71:'中山大学北门牌坊',72:'伍沾德堂',73:'丰盛堂',74:'中山大学西北门',75:'伍舜德图书馆',76:'岭南堂',77:'马应彪招待室',78:'哲生堂',79:'陆佑堂',80:'爪哇堂',
  81:'博物馆',82:'八角亭',83:'乙丑进士牌坊',84:'惺亭',85:'孙中山先生铜像',86:'史达理堂',87:'激光光学大楼',88:'十友堂',89:'模范村',90:'法学院',
  91:'永芳堂',92:'人口研究所',93:'学人书境',94:'中山大学人文高等研究院',95:'康乐园餐厅',96:'园西湖',97:'蒲园食堂',98:'中山大学西门',99:'中山大学小西门',100:'震寰堂',101:'你的见闻'
}

const loading = ref(false)
const currentTab = ref('checkins') // 'checkins' | 'bottles' | 'users'

/* 打卡审核 */
const checkinStatusOptions = ref([
  { value: 'pending',  label: '待审核' },
  { value: 'approved', label: '已通过' },
])
const checkinStatusIndex = ref(0)
const checkins = ref([])
const checkinStat = ref(null)
/* 审核进行中标记：避免重复点击 */
const moderating = ref({}) // { [checkinId]: true }

/* 漂流瓶 */
const bottleStatusOptions = ref([
  { value: 'all',      label: '全部'   },
  { value: 'unpicked', label: '未被捡' },
  { value: 'picked',   label: '已被捡' },
])
const bottleStatusIndex = ref(0)
const bottles = ref([])
const bottleStat = ref(null)
const deleting = ref({})

/* 用户与详情（折叠） */
const users = ref([])
const expanded = ref({})       // { [userId]: true }
const details  = ref({})       // { [userId]: { regTimeText, checkins:{locId:[timeText]}, throws:[timeText] } }
const bottlesCache   = ref([]) // 所有瓶子（缓存一次）
const checkinsCache  = ref([]) // 全部已通过打卡（缓存一次）

onMounted(() => {
  document.title = '审核管理'
  refreshCurrentTab()
})

function switchTab(tab) {
  if (tab === currentTab.value) return
  currentTab.value = tab
  refreshCurrentTab()
}

function refreshCurrentTab() {
  if (currentTab.value === 'checkins') return fetchCheckins()
  if (currentTab.value === 'bottles')  return fetchBottles()
  if (currentTab.value === 'users')    return fetchUsers()
}

/* 时间：统一按北京时间显示 */
function fmtCN(ts) {
  if (!ts) return ''
  let v = ts
  if (typeof v === 'string' && /^\d+$/.test(v)) v = Number(v)
  try {
    return new Date(v).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
  } catch {
    return String(ts)
  }
}
function fmt(ts) { return fmtCN(ts) }

function toOk(resp) {
  const okStatus = (resp?.status === 200) || (resp?.statusCode === 200)
  return okStatus && resp?.data?.code === 0
}
function isOpOk(resp) {
  const s = resp?.status ?? resp?.statusCode
  return s === 204 || (s === 200 && resp?.data?.code === 0)
}

function previewImage(url) {
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}

/* ===== 打卡审核 ===== */
async function fetchCheckins() {
  loading.value = true
  try {
    const status = checkinStatusOptions.value[checkinStatusIndex.value].value
    const [resList, resPend, resAppr] = await Promise.all([
      request(`/admin/checkins?status=${encodeURIComponent(status)}`, 'GET'),
      request('/admin/checkins?status=pending', 'GET'),
      request('/admin/checkins?status=approved', 'GET'),
    ])

    const toList = r => (toOk(r) ? (r.data.list || []) : [])

    const list = toList(resList).map(it => ({
      ...it,
      status: it.status || status,
      _uploadTime: fmt(it.uploadTime || it.createdAt),
      _locName: LOC_NAME[it.locationId] || `#${it.locationId}`,
    }))

    const stat = {
      pending : toList(resPend).length,
      approved: toList(resAppr).length,
    }

    checkins.value = list
    checkinStat.value = stat
  } catch (e) {
    console.warn('[admin] fetchCheckins error', e)
    checkins.value = []
    checkinStat.value = null
  } finally {
    loading.value = false
  }
}

/* 审核类操作：先乐观更新，失败回滚 */
function applyLocalModeration(id, action /* 'approve'|'reject' */) {
  const idx = checkins.value.findIndex(x => x.id === id)
  if (idx === -1) return
  // 在“待审核”列表里，直接把条目移除；统计同步
  const snapshotItem = checkins.value[idx]
  checkins.value.splice(idx, 1)

  if (checkinStat.value) {
    if (action === 'approve') {
      checkinStat.value.pending  = Math.max(0, (checkinStat.value.pending  || 0) - 1)
      checkinStat.value.approved = (checkinStat.value.approved || 0) + 1
    } else {
      checkinStat.value.pending  = Math.max(0, (checkinStat.value.pending  || 0) - 1)
    }
  }
  return snapshotItem
}

async function approveCheckin(id) {
  if (!id || moderating.value[id]) return
  // 快照
  const snapshotList = checkins.value.slice()
  const snapshotStat = checkinStat.value ? { ...checkinStat.value } : null

  applyLocalModeration(id, 'approve')
  moderating.value = { ...moderating.value, [id]: true }

  try {
    let resp = await request(`/admin/checkins/${encodeURIComponent(id)}/approve`, 'POST', {})
    if (!isOpOk(resp)) throw new Error('approve failed')
    // 成功后再拉一次，确保数据准确
    fetchCheckins()
  } catch (e) {
    // 回滚
    checkins.value = snapshotList
    if (snapshotStat) checkinStat.value = snapshotStat
    alert('审核失败，请重试')
  } finally {
    const m = { ...moderating.value }; delete m[id]; moderating.value = m
  }
}

async function rejectCheckin(id) {
  if (!id || moderating.value[id]) return
  const ok = window.confirm('确认驳回该打卡吗？')
  if (!ok) return

  const snapshotList = checkins.value.slice()
  const snapshotStat = checkinStat.value ? { ...checkinStat.value } : null

  applyLocalModeration(id, 'reject')
  moderating.value = { ...moderating.value, [id]: true }

  try {
    let resp = await request(`/admin/checkins/${encodeURIComponent(id)}/reject`, 'POST', {})
    if (!isOpOk(resp)) throw new Error('reject failed')
    fetchCheckins()
  } catch (e) {
    checkins.value = snapshotList
    if (snapshotStat) checkinStat.value = snapshotStat
    alert('驳回失败，请重试')
  } finally {
    const m = { ...moderating.value }; delete m[id]; moderating.value = m
  }
}

/* ===== 漂流瓶 ===== */
async function fetchBottles() {
  loading.value = true
  try {
    const status = bottleStatusOptions.value[bottleStatusIndex.value].value
    const resp = await request(`/admin/bottles?status=${encodeURIComponent(status)}`, 'GET')

    const usersMap = {}
    if (toOk(resp)) {
      const inlineUsers = resp.data.users || []
      inlineUsers.forEach(u => { usersMap[String(u.id)] = u.username || '' })
      if (!Object.keys(usersMap).length) {
        try {
          const ures = await request('/admin/users', 'GET')
          const ulist = toOk(ures) ? (ures.data.users || ures.data.list || []) : []
          ulist.forEach(u => { usersMap[String(u.id)] = u.username || '' })
        } catch {}
      }
    }

    const rawList = toOk(resp) ? (resp.data.list || resp.data.bottles || []) : []

    const toPicks = (b) => {
      if (Array.isArray(b.picks)) return b.picks
      const arr = []
      if (b.pickedBy) arr.push({ userId: b.pickedBy, pickTime: b.pickTime || 0 })
      return arr
    }

    const list = rawList.map(b => {
      const picks = toPicks(b).map(p => ({
        ...p,
        name: usersMap[String(p.userId)] || '',
        _pickTime: fmt(p.pickTime),
      }))
      return {
        ...b,
        _uploadTime : fmt(b.uploadTime),
        _pickerNames: picks.map(p => p.name).filter(Boolean).join('、'),
        _picks      : picks,
      }
    })

    let stat = resp?.data?.stat || null
    if (!stat) {
      const all = list.length
      const picked = list.filter(b => Array.isArray(b._picks) && b._picks.length > 0).length
      stat = { all, picked, unpicked: all - picked }
    }

    bottles.value = list
    bottleStat.value = stat
  } catch (e) {
    console.warn('[admin] fetchBottles error', e)
    bottles.value = []
    bottleStat.value = null
  } finally {
    loading.value = false
  }
}

/* 删除漂流瓶：乐观更新 + 回滚 */
function isDeleteOk(resp) {
  const s = resp?.status ?? resp?.statusCode
  return s === 204 || (s === 200 && resp?.data?.code === 0)
}
async function deleteBottle(itemOrId) {
  const id = typeof itemOrId === 'object' ? itemOrId.id : itemOrId
  if (!id) return
  const t = bottles.value.find(b => b.id === id)
  const sure = window.confirm(`确认删除该漂流瓶${t?.text ? '“' + String(t.text).slice(0,20) + (String(t.text).length>20?'…':'') + '”' : ''}吗？`)
  if (!sure) return
  deleting.value = { ...deleting.value, [id]: true }
  const snapshot = bottles.value.slice()
  const idx = bottles.value.findIndex(b => b.id === id)
  if (idx >= 0) bottles.value.splice(idx, 1)

  let ok = false
  try {
    let resp = await request(`/admin/bottles/${encodeURIComponent(id)}`, 'DELETE', {})
    if (!isDeleteOk(resp)) {
      resp = await request(`/admin/bottles/${encodeURIComponent(id)}/delete`, 'POST', {})
    }
    ok = isDeleteOk(resp)
  } catch {}
  if (!ok) {
    bottles.value = snapshot
    alert('删除失败')
  }
  const map = { ...deleting.value }; delete map[id]; deleting.value = map
}

/* ===== 用户列表 + 折叠详情 ===== */
async function fetchUsers() {
  loading.value = true
  try {
    const [uRes, bRes] = await Promise.all([
      request('/admin/users', 'GET'),
      request('/admin/bottles?status=all', 'GET'),
    ])

    let listUsers = toOk(uRes) ? (uRes.data.users || uRes.data.list || []) : []
    const allBottles = toOk(bRes) ? (bRes.data.list || bRes.data.bottles || []) : []
    bottlesCache.value = allBottles // 缓存供详情用

    // ownerId -> 扔瓶数量
    const threwByOwner = allBottles.reduce((acc, b) => {
      const uid = Number(b.ownerId)
      if (!uid) return acc
      acc[uid] = (acc[uid] || 0) + 1
      return acc
    }, {})

    listUsers = listUsers.map(u => {
      const fromSelf = Array.isArray(u.bottlesThrow) ? u.bottlesThrow.length : null
      const fromAgg  = threwByOwner[Number(u.id)] || 0
      const threw    = (fromSelf !== null ? fromSelf : fromAgg)
      return { ...u, threw }
    })

    users.value = listUsers
  } catch (e) {
    console.warn('[admin] fetchUsers error', e)
    users.value = []
  } finally {
    loading.value = false
  }
}

async function ensureCheckinsCache() {
  if (checkinsCache.value.length) return
  try {
    const resp = await request('/admin/checkins?status=approved', 'GET')
    checkinsCache.value = toOk(resp) ? (resp.data.list || []) : []
  } catch { checkinsCache.value = [] }
}

async function toggleUser(u) {
  const uid = u.id
  expanded.value = { ...expanded.value, [uid]: !expanded.value[uid] }
  if (!expanded.value[uid]) return

  // 首次展开时构建详情
  if (!details.value[uid]) {
    await ensureCheckinsCache()

    const regTs = u.registerTime || u.createdAt || u.created_at || u.signupTime || 0
    const regTimeText = regTs ? fmtCN(regTs) : '—'

    // 扔瓶时间（按时间倒序）
    const throws = (bottlesCache.value || [])
      .filter(b => Number(b.ownerId) === Number(uid))
      .map(b => b.uploadTime)
      .sort((a,b) => (b||0)-(a||0))
      .map(fmtCN)

    // 打卡：按地点分组
    const myCheckinsRaw = (checkinsCache.value || []).filter(it => {
      if (Number(it.userId)) return Number(it.userId) === Number(uid)
      if (it.username && u.username) return String(it.username) === String(u.username)
      return false
    })

    const checkinsGrouped = myCheckinsRaw.reduce((acc, it) => {
      const lid = it.locationId || it.locId || it.location || 0
      if (!lid) return acc
      ;(acc[lid] = acc[lid] || []).push(it.uploadTime || it.createdAt || it.time || 0)
      return acc
    }, {})

    Object.keys(checkinsGrouped).forEach(lid => {
      checkinsGrouped[lid] = checkinsGrouped[lid]
        .sort((a,b) => (b||0)-(a||0))
        .map(fmtCN)
    })

    details.value = {
      ...details.value,
      [uid]: { regTimeText, checkins: checkinsGrouped, throws }
    }
  }
}
</script>

<style scoped>
.page { padding: 8px; }

.tabs { display: flex; gap: 8px; margin-bottom: 8px; }
.tab {
  padding: 6px 10px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #334155;
  border: none;
  cursor: pointer;
}
.tab.active { background: #0ea5e9; color: #fff; }

.filter { margin-bottom: 6px; color: #334155; display: flex; gap: 12px; align-items: center; }
.filter select {
  padding: 5px 7px;
  background: #f8fafc;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.card {
  display: flex; gap: 6px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 7px;
  padding: 6px;
  margin-bottom: 6px;
  align-items: stretch;
}
.thumb {
  width: 100px; height: 100px;
  border-radius: 6px; background: #eef2f7;
  object-fit: cover; cursor: zoom-in;
}
.info { flex: 1; min-width: 0; }
.title { font-size: 14px; font-weight: 600; color: #111827; }
.meta { color: #6b7280; font-size: 12px; margin-top: 3px; }
.tags { margin-top: 3px; }
.tag {
  font-size: 11px; padding: 2px 6px; border-radius: 999px;
  background: #e5e7eb; color: #334155; text-transform: capitalize;
}
.tag.pending  { background: #fff7ed; color: #b45309; }
.tag.approved { background: #ecfdf5; color: #065f46; }
.tag.rejected { background: #fef2f2; color: #991b1b; }

.ops { display: flex; flex-direction: column; gap: 4px; }
.btn { padding: 4px 8px; border-radius: 6px; border: none; cursor: pointer; font-size: 12px; }
.btn-primary { background: #0ea5e9; color: #fff; }
.btn-warn    { background: #ef4444; color: #fff; }

.row {
  display: flex; gap: 6px; align-items: center;
  background: #fff; border: 1px solid #e5e7eb;
  border-radius: 7px; padding: 6px; margin-bottom: 6px;
}
.row-click { cursor: pointer; }
.avatar { width: 44px; height: 44px; border-radius: 50%; background: #f1f5f9; object-fit: cover; }
.cell { flex: 1; min-width: 0; }
.name { font-size: 14px; font-weight: 600; color: #111827; display:flex; align-items:center; gap:6px; }
.chev { font-weight: 400; color:#64748b; }
.desc { font-size: 12px; color: #64748b; margin-top: 2px; }

.detail {
  background: #f8fafc;
  border: 1px dashed #e2e8f0;
  border-radius: 8px;
  padding: 10px;
  margin: -4px 0 8px 50px;
}
.detail-row { display: grid; grid-template-columns: 110px 1fr; gap: 8px; margin: 6px 0; }
.detail-title { color:#334155; font-size: 13px; font-weight: 600; }
.detail-body { color:#111827; font-size: 13px; }

.chips-line { display:flex; gap:8px; align-items:flex-start; margin:4px 0; }
.chips { display:flex; flex-wrap: wrap; gap:6px; }
.chip {
  display:inline-block; padding:2px 8px;
  background:#fff; border:1px solid #e5e7eb; border-radius:999px;
  font-size:12px; color:#374151;
}
.chip-title { background:#eef2ff; border-color:#c7d2fe; color:#3730a3; }

.empty { text-align: center; color: #94a3b8; padding: 20px 0; }
.loading {
  position: fixed; right: 12px; bottom: 12px;
  background: rgba(17,24,39,.9); color: #fff;
  padding: 8px 10px; border-radius: 8px; font-size: 12px;
}
</style>
