<!-- src/pages/myCheckins.vue -->
<template>
  <div class="bg-wrapper" @contextmenu.prevent>
    <!-- 背景图 -->
    <img
      class="bg-img"
      src="https://sysuzngcxy-1322240898.cos.ap-guangzhou.myqcloud.com/bg.jpg"
      alt="bg"
      draggable="false"
    />

    <!-- 内容 -->
    <div class="content">
      <!-- LOGO -->
      <div class="logo-container">
        <img
          class="logo-img"
          src="https://sysuzngcxy-1322240898.cos.ap-guangzhou.myqcloud.com/logo1.png"
          alt="logo"
          draggable="false"
        />
      </div>

      <!-- 个人信息卡片 -->
      <div class="user-card">
        <img
          class="avatar"
          :src="userInfo.avatar || 'https://img.yzcdn.cn/vant/user-active.png'"
          alt="avatar"
          draggable="false"
        />
        <div class="user-meta">
          <div class="user-name">{{ userInfo.username || '未登录用户' }}</div>
          <div class="user-id">ID：{{ userInfo.id || '-' }}</div>
        </div>

        <div class="progress">
          <div class="progress-label">徽章进度：{{ unlockedCount }} / {{ badges.length }}</div>
          <div class="progress-bar">
            <div class="progress-inner" :style="{ width: progressWidth }"></div>
          </div>
        </div>
      </div>

      <!-- 标题 -->
      <div class="section-head">
        <span class="section-emoji">🏅</span>
        <span class="section-title">徽章墙</span>
      </div>

      <!-- 三列网格徽章（懒加载缩略图 + 预取下一屏） -->
      <div class="badge-grid">
        <div
          v-for="item in badges"
          :key="item.id"
          class="badge-card"
          :class="item.unlocked ? 'is-unlocked' : 'is-locked'"
          @click="onTapBadge(item.id)"
        >
          <div class="badge-thumb" :title="item.name">
            <!-- 进入视口才真正设置 src -->
            <img
              class="badge-img"
              v-lazy-img="item.thumb"
              :alt="item.name"
              loading="lazy"
              decoding="async"
              fetchpriority="low"
              draggable="false"
            />
            <div v-if="!item.unlocked" class="badge-mask">
              <span class="lock">🔒</span>
            </div>
          </div>
          <span class="badge-name">{{ item.name }}</span>
        </div>

        <!-- 预取下一屏的哨兵元素 -->
        <div ref="sentinel" style="height:1px;"></div>
      </div>

      <div v-if="loading" class="loading">加载中…</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { request } from '@/utils/request'

/* =========================
   轻量懒加载指令（本地注册）
   ========================= */
const vLazyImg = {
  mounted(el, binding) {
    const url = binding.value
    if (!url) return
    // 不要立刻设 src，先挂到 data-src，等进入视口再赋值
    el.setAttribute('data-src', url)
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(([e]) => {
        if (e.isIntersecting) {
          el.src = url
          io.unobserve(el)
        }
      }, { rootMargin: '300px' })
      io.observe(el)
      el.__lazyIo__ = io
    } else {
      el.src = url
    }
  },
  unmounted(el) {
    el.__lazyIo__?.disconnect?.()
    delete el.__lazyIo__
  }
}
// 在 <script setup> 中，变量名以 vXxx 暴露即可在模板中用 v-xxx
// (已命名为 vLazyImg，模板里用 v-lazy-img)

/* =========================
   会话缓存 key
   ========================= */
const SS_USER   = 'MYCHECKINS_USER_V1'
const SS_UNLOCK = 'MYCHECKINS_UNLOCK_SET_V1'

/* =========================
   COS CI 缩略图直链
   ========================= */
function thumb(url, size = 256, q = 75) {
  if (!url) return ''
  const ci = `imageMogr2/thumbnail/${size}x/format/webp/quality/${q}`
  return url.includes('?') ? `${url}&${ci}` : `${url}?${ci}`
}

/* =========================
   静态徽章列表（1-101）
   ========================= */
const base = 'https://sysuzngcxy-1322240898.cos.ap-guangzhou.myqcloud.com/Badge'
const ALL = [
  { id: 1, name: '何尔达屋', icon: `${base}/sysu_001_he_er_da_house.png` },
  { id: 2, name: '高利士屋', icon: `${base}/sysu_002_gao_lishi_house.png` },
  { id: 3, name: '宾省校屋', icon: `${base}/sysu_003_pennsylvania_school_house.png` },
  { id: 4, name: '端木正教授像', icon: `${base}/sysu_004_prof_duanmu_zheng_statue.png` },
  { id: 5, name: '韦耶孝实屋', icon: `${base}/sysu_005_wei_yexiaoshi_house.png` },
  { id: 6, name: '伦敦会屋', icon: `${base}/sysu_006_london_missionary_society_house.png` },
  { id: 7, name: '美臣屋一号', icon: `${base}/sysu_007_meichen_house_no1.png` },
  { id: 8, name: '白德理屋', icon: `${base}/sysu_008_bai_deli_house.png` },
  { id: 9, name: '屈林宾屋', icon: `${base}/sysu_009_qu_linbin_house.png` },
  { id: 10, name: '惠师礼屋', icon: `${base}/sysu_010_hui_shili_house.png` },
  { id: 11, name: '马岗堂', icon: `${base}/sysu_011_magang_hall.png` },
  { id: 12, name: '图书馆', icon: `${base}/sysu_012_library.png` },
  { id: 13, name: '黄焕秋校长像', icon: `${base}/sysu_013_zou_lu_president_statue.png` },
  { id: 14, name: '格兰堂', icon: `${base}/sysu_014_gelan_hall.png` },
  { id: 15, name: '廖承志像', icon: `${base}/sysu_015_liao_chengzhi_statue.png` },
  { id: 16, name: '马丁堂', icon: `${base}/sysu_016_martin_hall.png` },
  { id: 17, name: '附属小学建筑群', icon: `${base}/sysu_017_affiliated_primary_school_complex.png` },
  { id: 18, name: '南草坪餐厅', icon: `${base}/sysu_018_south_lawn_dining_hall.png` },
  { id: 19, name: '第一教学楼', icon: `${base}/sysu_019_teaching_building_1.png` },
  { id: 20, name: '附属小学方亭', icon: `${base}/sysu_020_affiliated_primary_school_pavilion.png` },
  { id: 21, name: '荣光堂', icon: `${base}/sysu_021_rongguang_hall.png` },
  { id: 22, name: '中山大学南门', icon: `${base}/sysu_022_sysu_south_gate.png` },
  { id: 23, name: '生命科学楼', icon: `${base}/sysu_023_life_sciences_building.png` },
  { id: 24, name: '蚕丝学院制种室', icon: `${base}/sysu_024_sericulture_institute_breeding_room.png` },
  { id: 25, name: '生物楼', icon: `${base}/sysu_025_biology_building.png` },
  { id: 26, name: '达尔文雕塑', icon: `${base}/sysu_026_charles_darwin_sculpture.png` },
  { id: 27, name: '曾宪梓堂', icon: `${base}/sysu_027_zeng_xianzhi_hall.png` },
  { id: 28, name: '蒲蛰龙雕塑', icon: `${base}/sysu_028_pu_zhelong_sculpture.png` },
  { id: 29, name: '马文辉堂', icon: `${base}/sysu_029_ma_wenhui_hall.png` },
  { id: 30, name: '贺丹青堂', icon: `${base}/sysu_030_he_danqing_hall.png` },
  { id: 31, name: '测试大楼', icon: `${base}/sysu_031_test_building.png` },
  { id: 32, name: '竹林', icon: `${base}/sysu_032_bamboo_grove.png` },
  { id: 33, name: '中山楼', icon: `${base}/sysu_033_zhongshan_building.png` },
  { id: 34, name: '梁銶琚堂', icon: `${base}/sysu_034_liang_xiju_hall.png` },
  { id: 35, name: '研究生院', icon: `${base}/sysu_035_yanjiushengyuan.png` },
  { id: 36, name: '张弼士堂', icon: `${base}/sysu_036_zhang_bishi_hall.png` },
  { id: 37, name: '逸夫楼', icon: `${base}/sysu_037_yifu_building.png` },
  { id: 38, name: '西大操场', icon: `${base}/sysu_038_west_field.png` },
  { id: 39, name: '洗为坚堂', icon: `${base}/sysu_039_xi_weijian_hall.png` },
  { id: 40, name: '紫荆园餐厅', icon: `${base}/sysu_040_bauhinia_garden_dining_hall.png` },
  { id: 41, name: '协和神学院建筑群', icon: `${base}/sysu_041_union_theological_seminary_complex.png` },
  { id: 42, name: '芙兰堂', icon: `${base}/sysu_042_teaching_building_3.png` },
  { id: 43, name: '锡昌堂', icon: `${base}/sysu_043_xichang_hall.png` },
  { id: 44, name: '四墩楼', icon: `${base}/sysu_044_sidun_building.png` },
  { id: 45, name: '8号住宅', icon: `${base}/sysu_045_residence_no8.png` },
  { id: 46, name: '孖屋二', icon: `${base}/sysu_046_twin_house_no2.png` },
  { id: 47, name: '谭礼庭屋', icon: `${base}/sysu_047_tan_liting_house.png` },
  { id: 48, name: '马应彪夫人护养院', icon: `${base}/sysu_048_madam_ma_yingbiao_convalescent_home.png` },
  { id: 49, name: '麻金墨屋二号', icon: `${base}/sysu_049_ma_jinmo_house_no2.png` },
  { id: 50, name: '怀士堂', icon: `${base}/sysu_050_huaishi_hall.png` },
  { id: 51, name: '鲁迅先生像', icon: `${base}/sysu_051_lu_xun_statue.png` },
  { id: 52, name: '校训雕像', icon: `${base}/sysu_052_school_motto_stone_carving.png` },
  { id: 53, name: '希伦高屋', icon: `${base}/sysu_053_xi_lungao_house.png` },
  { id: 54, name: '黑石屋', icon: `${base}/sysu_054_blackstone_house.png` },
  { id: 55, name: '麻金墨屋一号', icon: `${base}/sysu_055_ma_jinmo_house_no1.png` },
  { id: 56, name: '美臣屋二号', icon: `${base}/sysu_056_meichen_house_no2.png` },
  { id: 57, name: '神甫屋', icon: `${base}/sysu_057_priest_house.png` },
  { id: 58, name: '积臣屋', icon: `${base}/sysu_058_jichen_house.png` },
  { id: 59, name: '英东体育馆', icon: `${base}/sysu_059_yingdong_stadium.png` },
  { id: 60, name: '新女学', icon: `${base}/sysu_060_new_womens_school.png` },
  { id: 61, name: '“摇篮”铜像', icon: `${base}/sysu_061_cradle_bronze_statue.png` },
  { id: 62, name: '冼星海半身铜像', icon: `${base}/sysu_062_xian_xinghai_bust.png` },
  { id: 63, name: '翘燊堂、文虎堂', icon: `${base}/sysu_063_qiaoshen_hall_and_wenhu_hall.png` },
  { id: 64, name: '松涛园', icon: `${base}/sysu_064_songtao_garden.png` },
  { id: 65, name: '新体育馆', icon: `${base}/sysu_065_new_gymnasium.png` },
  { id: 66, name: '松园湖', icon: `${base}/sysu_066_songyuan_lake.png` },
  { id: 67, name: '第二教学楼', icon: `${base}/sysu_067_teaching_building_2.png` },
  { id: 68, name: '卡彭特楼', icon: `${base}/sysu_068_carpenter_building.png` },
  { id: 69, name: '林护堂、黄铭衍堂、黄传经堂', icon: `${base}/sysu_069_linhu_hall_huang_mingyan_hall_huang_chuanjing_hall.png` },
  { id: 70, name: '叶葆定堂', icon: `${base}/sysu_070_ye_baoding_hall.png` },
  { id: 71, name: '中山大学北门牌坊', icon: `${base}/sysu_071_north_gate_archway.png` },
  { id: 72, name: '伍沾德堂', icon: `${base}/sysu_072_wu_zhande_hall.png` },
  { id: 73, name: '丰盛堂', icon: `${base}/sysu_073_fengsheng_hall.png` },
  { id: 74, name: '中山大学西北门', icon: `${base}/sysu_074_northwest_gate.png` },
  { id: 75, name: '伍舜德图书馆', icon: `${base}/sysu_075_wu_shunde_library.png` },
  { id: 76, name: '岭南堂', icon: `${base}/sysu_076_lingnan_hall.png` },
  { id: 77, name: '马应彪招待室', icon: `${base}/sysu_077_ma_yingbiao_reception_room.png` },
  { id: 78, name: '哲生堂', icon: `${base}/sysu_078_zhesheng_hall.png` },
  { id: 79, name: '陆佑堂', icon: `${base}/sysu_079_lu_you_hall.png` },
  { id: 80, name: '爪哇堂', icon: `${base}/sysu_080_java_hall.png` },
  { id: 81, name: '博物馆', icon: `${base}/sysu_081_museum.png` },
  { id: 82, name: '八角亭', icon: `${base}/sysu_082_octagonal_pavilion.png` },
  { id: 83, name: '乙丑进士牌坊', icon: `${base}/sysu_083_yichou_jinshi_archway.png` },
  { id: 84, name: '惺亭', icon: `${base}/sysu_084_xing_pavilion.png` },
  { id: 85, name: '孙中山先生铜像', icon: `${base}/sysu_085_sun_yat_sen_bronze_statue.png` },
  { id: 86, name: '史达理堂', icon: `${base}/sysu_086_shidali_hall.png` },
  { id: 87, name: '激光光学大楼', icon: `${base}/sysu_087_long_kanghou_sculpture.png` },
  { id: 88, name: '十友堂', icon: `${base}/sysu_088_shiyou_hall.png` },
  { id: 89, name: '模范村', icon: `${base}/sysu_089_model_village.png` },
  { id: 90, name: '法学院', icon: `${base}/sysu_090_law_college.png` },
  { id: 91, name: '永芳堂', icon: `${base}/sysu_091_yongfang_hall.png` },
  { id: 92, name: '人口研究所', icon: `${base}/sysu_092_people_research_academic.png` },
  { id: 93, name: '学人书境', icon: `${base}/sysu_093_SYSU_publishinghouse.png` },
  { id: 94, name: '中山大学人文高等研究院', icon: `${base}/sysu_094_deng_shichang_navy_statue.png` },
  { id: 95, name: '康乐园餐厅', icon: `${base}/sysu_095_kangle_garden_dining_hall.png` },
  { id: 96, name: '园西湖', icon: `${base}/sysu_096_yuanxi_lake.png` },
  { id: 97, name: '蒲园食堂', icon: `${base}/sysu_097_puyuan_canteen.png` },
  { id: 98, name: '中山大学西门', icon: `${base}/sysu_098_west_gate.png` },
  { id: 99, name: '中山大学小西门', icon: `${base}/sysu_099_small_west_gate.png` },
  { id: 100, name: '震寰堂', icon: `${base}/sysu_100_zhenhuan_hall.png` },
  { id: 101, name: '你的见闻', icon: `${base}/sysu_101_your_observations.png` }
]

/* =========================
   组件状态
   ========================= */
const router = useRouter()
const userInfo = ref({})
const userRole = ref('visitor')
const badges   = ref([])          // [{ id, name, icon, thumb, unlocked }]
const unlockedCount = ref(0)
const progressWidth = ref('0%')
const loading  = ref(false)

/* 预取下一屏哨兵 */
const sentinel = ref(null)
let ioNext = null

function setupNextPrefetch() {
  if (!('IntersectionObserver' in window)) return
  ioNext = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return
      // 预取后续 15 张（仍然不触发视口加载，只提示浏览器空闲拉取）
      const imgs = Array.from(document.querySelectorAll('.badge-img'))
      let cnt = 0
      for (const img of imgs) {
        if (cnt >= 15) break
        const ds = img.getAttribute('data-src')
        if (ds && !img.src) {
          const link = document.createElement('link')
          link.rel = 'prefetch'
          link.as = 'image'
          link.href = ds
          document.head.appendChild(link)
          cnt++
        }
      }
    })
  }, { rootMargin: '1000px' })
  sentinel.value && ioNext.observe(sentinel.value)
}
function cleanupNextPrefetch() {
  if (ioNext) { ioNext.disconnect(); ioNext = null }
}

/* =========================
   复水（从 sessionStorage 秒显）
   ========================= */
function hydrate(ssUser, ssUnlockArr) {
  userInfo.value = ssUser || {}
  userRole.value = (ssUser && ssUser.role) || 'visitor'
  const unlockedSet = new Set(ssUnlockArr || [])
  const mapped = ALL.map(b => ({
    ...b,
    thumb: thumb(b.icon, 256, 75),
    unlocked: unlockedSet.has(b.id),
  }))
  badges.value = mapped
  const uCount = mapped.filter(b => b.unlocked).length
  unlockedCount.value = uCount
  progressWidth.value = mapped.length
    ? `${Math.round((uCount / mapped.length) * 100)}%`
    : '0%'
}

/* =========================
   初始化流程（并行请求 + 会话缓存）
   ========================= */
onMounted(async () => {
  document.title = '我的打卡'

  // 1) 鉴权
  const token = localStorage.getItem('token')
  if (!token) {
    router.push({ path: '/signin', query: { redirect: encodeURIComponent('/myCheckins') } })
    return
  }

  loading.value = true

  // 2) 会话缓存先把页面填起来（秒显）
  try {
    const ssUser   = JSON.parse(sessionStorage.getItem(SS_USER)   || 'null')
    const ssUnlock = JSON.parse(sessionStorage.getItem(SS_UNLOCK) || 'null')
    if (ssUser && ssUnlock) hydrate(ssUser, ssUnlock)
  } catch {}

  // 3) 并行拉取最新
  try {
    const [meResp, stResp] = await Promise.allSettled([
      request('/auth/me', 'GET', null, { credentials: 'include' }),
      request('/checkin/status', 'GET', null, { credentials: 'include' }),
    ])

    // 用户信息
    if (meResp.status !== 'fulfilled' || meResp.value?.data?.code !== 0) {
      router.push({ path: '/signin', query: { redirect: encodeURIComponent('/myCheckins') } })
      return
    }
    const serverUser = meResp.value.data.userInfo || {}
    userInfo.value = serverUser
    userRole.value = serverUser.role || 'visitor'
    // 同步到本地
    const localUser = JSON.parse(localStorage.getItem('userInfo') || '{}')
    localStorage.setItem('userInfo', JSON.stringify({ ...localUser, ...serverUser }))
    // 写入会话缓存
    sessionStorage.setItem(SS_USER, JSON.stringify(userInfo.value))

    // 解锁集合：优先使用 /checkin/status，兼容 /auth/me
    let unlockedSet = new Set(serverUser.unlockedLocations || [])
    if (stResp.status === 'fulfilled' && stResp.value?.data?.code === 0) {
      unlockedSet = new Set(stResp.value.data.unlockedLocations || [])
    }
    sessionStorage.setItem(SS_UNLOCK, JSON.stringify(Array.from(unlockedSet)))

    // 构造渲染数据（用缩略图，不要直接用大图）
    const mapped = ALL.map(b => ({
      ...b,
      thumb: thumb(b.icon, 256, 75),
      unlocked: unlockedSet.has(b.id),
    }))
    badges.value = mapped

    // 进度条
    const uCount = mapped.filter(b => b.unlocked).length
    unlockedCount.value = uCount
    requestAnimationFrame(() => {
      progressWidth.value = mapped.length
        ? `${Math.round((uCount / mapped.length) * 100)}%`
        : '0%'
    })
  } catch (e) {
    console.error('[myCheckins:init]', e)
    alert('加载失败，请稍后重试')
  } finally {
    loading.value = false
    setupNextPrefetch()
  }
})

onBeforeUnmount(() => {
  cleanupNextPrefetch()
})

/* =========================
   交互
   ========================= */
function onTapBadge(id) {
  const badge = badges.value.find(b => b.id === id)
  if (!badge) return
  if (badge.unlocked) alert(`已解锁：${badge.name}`)
  else alert(`尚未解锁：${badge.name}`)
}
</script>

<style scoped>
/* 基础防选中/防长按 */
* { -webkit-touch-callout: none; user-select: none; box-sizing: border-box; }

/* ===== 背景与主体 ===== */
.bg-wrapper {
  position: relative;
  width: 100%;
  min-height: 100vh;
  overflow: visible;
}
.bg-img {
  position: fixed;
  left: 0; top: 0;
  width: 100vw;
  height: 100vh;
  z-index: -1;
  object-fit: cover;
}
.content {
  box-sizing: border-box;
  padding: 10px 0 20px;
  min-height: 100vh;
  position: relative;
  z-index: 1;
}

/* ===== LOGO ===== */
.logo-container {
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
}
.logo-img { width: 150px; }

/* ===== 个人信息卡片 ===== */
.user-card {
  display: grid;
  grid-template-columns: 60px 1fr;
  grid-template-rows: auto auto;
  column-gap: 10px;
  align-items: center;

  background: rgba(255,255,255,.88);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  border-radius: 12px;
  margin: 0 12px 11px;
  padding: 10px;
  box-shadow: 0 5px 12px rgba(0,0,0,.08);
}
.avatar {
  grid-row: 1 / span 2;
  width: 60px; height: 60px;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 3px 8px rgba(0,0,0,.08);
}
.user-meta { display: flex; flex-direction: column; }
.user-name { font-size: 17px; font-weight: 700; color: #152; }
.user-id   { font-size: 12px; color: #667; margin-top: 3px; }

/* 进度条 */
.progress { grid-column: 1 / -1; margin-top: 8px; width: 100%; }
.progress-label { font-size: 12px; color: #314; margin-bottom: 5px; }
.progress-bar {
  position: relative;
  width: 100%;
  height: 8px;
  border-radius: 8px;
  background: rgba(23, 92, 40, .18);
  overflow: hidden;
}
.progress-inner {
  width: 0;
  height: 100%;
  background: linear-gradient(90deg, #175c28, #1f8f4a);
  border-radius: 8px;
  transition: width .25s ease;
}

/* ===== 标题 ===== */
.section-head {
  display: flex; align-items: baseline; gap: 5px;
  padding: 0 12px; margin: 6px 0 9px;
}
.section-emoji { font-size: 15px; }
.section-title {
  font-size: 15px; font-weight: 700; color: #1a1a1a;
  text-shadow: 0 1px 2px rgba(0,0,0,.08);
}

/* ===== 三列网格（强制等分） ===== */
.badge-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)); /* 始终三列，等分整行 */
  gap: 12px;
  padding: 0 12px;
  width: 100%;
}

/* 卡片 */
.badge-card {
  background: rgba(255,255,255,.88);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  border-radius: 12px;
  padding: 10px 8px 8px;
  display: flex; flex-direction: column; align-items: center;
  box-shadow: 0 4px 10px rgba(0,0,0,.06);
  transition: transform .12s ease, box-shadow .12s ease;
  cursor: pointer;
}
.badge-card:active { transform: scale(.98); box-shadow: 0 3px 7px rgba(0,0,0,.08); }

/* 1:1 正方形缩略图容器（更稳：aspect-ratio） */
.badge-thumb {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;      /* 统一正方形比例 */
  border-radius: 8px;
  overflow: hidden;
}
.badge-img {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover;         /* 填充且不变形 */
  transition: transform .18s ease;
  pointer-events: none;
}
.badge-card:active .badge-img { transform: scale(1.02); }

/* 名称：单行省略防溢出 */
.badge-name {
  margin-top: 6px; font-size: 13px; color: #213;
  text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 100%;
}

/* 未解锁效果 */
.is-locked .badge-img { filter: grayscale(100%) contrast(.9); opacity: .72; }
.badge-mask {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,.12));
}
.badge-mask .lock {
  font-size: 20px; color: rgba(255,255,255,.95);
  text-shadow: 0 2px 5px rgba(0,0,0,.28);
}

/* 已解锁轻强调 */
.is-unlocked {
  border: 1px solid rgba(23, 92, 40, .18);
  box-shadow: 0 3px 9px rgba(23, 92, 40, .08);
}

/* Loading */
.loading{
  position: fixed; right: 12px; bottom: 12px;
  background: rgba(17,24,39,.9); color: #fff;
  padding: 8px 10px; border-radius: 8px; font-size: 12px;
}
</style>
