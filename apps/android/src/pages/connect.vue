<!-- src/pages/connect.vue -->
<template>
  <div class="connect-page">
    <!-- 背景图 -->
    <img class="bg-img" src="https://sysuzngcxy-1322240898.cos.ap-guangzhou.myqcloud.com/bg.jpg" alt="bg" />

    <!-- Logo -->
    <div class="logo-container">
      <img
        v-if="userRole === 'participant' || userRole === 'admin'"
        class="logo-img"
        src="https://sysuzngcxy-1322240898.cos.ap-guangzhou.myqcloud.com/logo1.png"
        alt="logo"
      />
      <img
        v-else
        class="logo-img"
        src="https://sysuzngcxy-1322240898.cos.ap-guangzhou.myqcloud.com/logo.png"
        alt="logo"
      />
    </div>

    <!-- 系统信息 -->
    <section class="section">
      <div class="title">📱 系统信息</div>
      <div>品牌：{{ systemInfo.brand || '—' }}</div>
      <div>机型：{{ systemInfo.model || '—' }}</div>
      <div>系统版本：{{ systemInfo.system || '—' }}</div>
      <div>平台：{{ systemInfo.platform }}</div>
      <div>语言：{{ systemInfo.language }}</div>
      <div>窗口宽高：{{ systemInfo.windowWidth }} × {{ systemInfo.windowHeight }}</div>
    </section>

    <!-- 联系方式 -->
    <section class="section">
      <div class="title">📮 联系我们</div>
      <div>邮箱：sysuzgxytj@hiwebsun.top</div>
      <div>电话：18561827151</div>
      <div>企业微信：许桂冰、张日轩</div>
      <div class="spacer" aria-hidden="true"></div>
      <div>您的任何问题都可以与我们联系</div>
      <div>我们24小时解决您的任何问题</div>
      <div>欢迎对项目感兴趣的同学与我们联系</div>
      <div>项目将于每日凌晨2:00-3:00定时维护</div>
      <div class="spacer" aria-hidden="true"></div>
      <div>愿每一次点击都是发现，每一步前行都有惊喜</div>
      <div>智工迎新活动组校园图鉴开发团队</div>
      <div>2025.08.25</div>
    </section>

    <!-- 备案 -->
    <section class="section">
      <div class="title">📕 备案</div>
      <div>鲁ICP备2025179873号</div>
    </section>

    <button class="home-btn" @click="goHome">🏠 返回首页</button>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { request } from '@/utils/request' // 如无鉴权需求，可删除本行与 fetchMe()

const router = useRouter()

const userRole = ref('visitor')
const systemInfo = ref({
  brand: '',
  model: '',
  system: '',
  platform: navigator.platform || 'web',
  language: navigator.language || 'zh-CN',
  windowWidth: window.innerWidth,
  windowHeight: window.innerHeight
})

function parseUA() {
  const ua = navigator.userAgent || ''
  // 极简 UA 解析，够用即可
  if (/iPhone|iPad|iPod/.test(ua)) {
    systemInfo.value.brand = 'Apple'
    systemInfo.value.model = /iPad/.test(ua) ? 'iPad' : /iPhone/.test(ua) ? 'iPhone' : 'iOS Device'
    const m = ua.match(/OS (\d+[_\.\d]*)/)
    systemInfo.value.system = 'iOS ' + (m ? m[1].replaceAll('_', '.') : '')
  } else if (/Android/.test(ua)) {
    systemInfo.value.brand = 'Android'
    const m = ua.match(/Android\s([\d\.]+)/)
    systemInfo.value.system = 'Android ' + (m ? m[1] : '')
    systemInfo.value.model = /; ([^;]*?) Build/.test(ua) ? RegExp.$1.trim() : 'Android Device'
  } else {
    systemInfo.value.brand = 'Web'
    systemInfo.value.model = 'Desktop/Other'
    systemInfo.value.system = ua.slice(0, 80)
  }
}

function handleResize() {
  systemInfo.value.windowWidth = window.innerWidth
  systemInfo.value.windowHeight = window.innerHeight
}

async function fetchMe() {
  try {
    const me = await request('/auth/me', 'GET')
    if ((me?.status === 200 || me?.statusCode === 200) && me?.data?.code === 0) {
      userRole.value = me.data.userInfo?.role || 'visitor'
    }
  } catch { /* 忽略网络错误 */ }
}

function goHome() {
  // 你的首页路由，按实际改：'/' 或 '/index'
  router.replace({ path: '/' })
}

onMounted(() => {
  document.title = '发现 Bug请联系～'
  parseUA()
  window.addEventListener('resize', handleResize)
  fetchMe() // 如无角色区分 Logo 的需求，可注释
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.connect-page {
  position: relative;
  min-height: 100vh;
  padding-bottom: 40px;
}

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

/* Logo */
.logo-container {
  display: flex;
  justify-content: center;
  margin-top: 25px;   /* 50rpx */
  padding: 35px;      /* 70rpx */
}
.logo-img { width: 200px; /* 400rpx */ }

/* 卡片段落 */
.section {
  padding: 15px;      /* 30rpx */
  background-color: rgba(255, 255, 255, 0.85);
  margin: 10px;       /* 20rpx */
  border-radius: 10px;/* 20rpx */
  box-shadow: 0 2px 10px rgba(0,0,0,0.1); /* 0 4rpx 20rpx */
}
.title {
  font-size: 18px;    /* 36rpx */
  font-weight: bold;
  color: #007d65;
  margin-bottom: 10px;/* 20rpx */
  display: block;
}

/* 返回首页按钮 */
.home-btn {
  display: block;
  margin: 15px auto 0;    /* 30rpx */
  background-color: rgba(0, 51, 20, 0.95);
  color: #fff;
  border: none;
  font-weight: bold;
  font-size: 15px;        /* 30rpx */
  border-radius: 8px;     /* 16rpx */
  padding: 10px 18px;
  cursor: pointer;
}
  /* 固定高度空行 */
.spacer{
  height:12px;      /* 按需改成 8/12/24 等 */
  width:100%;
}

</style>
