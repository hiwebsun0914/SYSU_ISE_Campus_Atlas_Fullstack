<template>
  <div class="connect-page">
    <a class="skip-link" href="#connect-main">跳到主要内容</a>

    <header class="connect-header">
      <button class="back-link" type="button" @click="goHome">
        <ArrowLeft :size="18" aria-hidden="true" />
        返回迎新站
      </button>
      <span class="header-code">SYSU · ISE / SUPPORT</span>
    </header>

    <main id="connect-main" class="connect-main">
      <section class="page-intro" aria-labelledby="page-title">
        <div>
          <p class="eyebrow"><span></span> SUPPORT STATION · 支持站</p>
          <h1 id="page-title">遇到问题，<br />我们一起解决。</h1>
        </div>
        <p class="intro-copy">
          账号、打卡或页面内容异常，都可以在这里找到维护同学。提交问题时附上右侧系统信息，会帮助我们更快定位。
        </p>
      </section>

      <div class="support-grid">
        <section class="contact-card" aria-labelledby="contact-title">
          <div class="map-grid" aria-hidden="true"></div>
          <span class="coordinate coordinate-top">23.0961° N</span>
          <span class="coordinate coordinate-side">113.2970° E</span>

          <div class="card-heading contact-heading">
            <span class="icon-tile icon-tile-accent"><LifeBuoy :size="24" aria-hidden="true" /></span>
            <div>
              <p>CONTACT DESK / 联系我们</p>
              <h2 id="contact-title">把问题交给维护同学</h2>
            </div>
          </div>

          <p class="contact-lead">描述你遇到的情况、发生时间和操作步骤，我们会尽快与你联系。</p>

          <div class="contact-actions">
            <a href="mailto:sysuzgxytj@hiwebsun.top">
              <span><Mail :size="20" aria-hidden="true" /></span>
              <span><small>电子邮箱</small><strong>sysuzgxytj@hiwebsun.top</strong></span>
              <ArrowUpRight :size="18" aria-hidden="true" />
            </a>
            <a href="tel:18561827151">
              <span><Phone :size="20" aria-hidden="true" /></span>
              <span><small>联系电话</small><strong>185 6182 7151</strong></span>
              <ArrowUpRight :size="18" aria-hidden="true" />
            </a>
          </div>

          <div class="team-row">
            <UsersRound :size="19" aria-hidden="true" />
            <span><small>企业微信</small><strong>许桂冰 · 张日轩</strong></span>
          </div>

          <div class="route-signature" aria-hidden="true">
            <i></i><span></span><i></i><span></span><i></i>
          </div>
        </section>

        <section class="system-card" aria-labelledby="system-title">
          <div class="card-heading">
            <span class="icon-tile"><MonitorSmartphone :size="23" aria-hidden="true" /></span>
            <div>
              <p>DEVICE SNAPSHOT / 设备快照</p>
              <h2 id="system-title">系统信息</h2>
            </div>
          </div>

          <p class="system-note">反馈问题时可一并提供以下信息，无需包含账号或密码。</p>
          <dl class="system-list">
            <div><dt>品牌</dt><dd>{{ systemInfo.brand || '—' }}</dd></div>
            <div><dt>机型</dt><dd>{{ systemInfo.model || '—' }}</dd></div>
            <div><dt>系统版本</dt><dd class="ua-value">{{ systemInfo.system || '—' }}</dd></div>
            <div><dt>平台</dt><dd>{{ systemInfo.platform }}</dd></div>
            <div><dt>语言</dt><dd>{{ systemInfo.language }}</dd></div>
            <div><dt>窗口尺寸</dt><dd>{{ systemInfo.windowWidth }} × {{ systemInfo.windowHeight }}</dd></div>
          </dl>
          <span class="device-status"><span></span> 信息已就绪</span>
        </section>

        <section class="maintenance-card" aria-labelledby="maintenance-title">
          <div class="maintenance-icon"><Clock3 :size="23" aria-hidden="true" /></div>
          <div>
            <p>MAINTENANCE WINDOW</p>
            <h2 id="maintenance-title">每日 02:00–03:00 定时维护</h2>
            <span>维护期间部分功能可能短暂不可用，请稍后再试。</span>
          </div>
        </section>

        <section class="note-card" aria-labelledby="note-title">
          <Navigation :size="21" aria-hidden="true" />
          <div>
            <p>FROM THE TEAM / 开发团队</p>
            <h2 id="note-title">愿每一次点击都是发现，<br />每一步前行都有惊喜。</h2>
            <span>智工迎新活动组校园探索开发团队 · 2025.08.25</span>
          </div>
        </section>
      </div>

      <footer class="connect-footer">
        <span>中山大学智能工程学院 · 校园探索支持站</span>
        <span><FileBadge2 :size="16" aria-hidden="true" /> 鲁ICP备2025179873号</span>
      </footer>
    </main>

    <button class="mobile-home" type="button" @click="goHome">
      <ArrowLeft :size="19" aria-hidden="true" />
      返回首页
    </button>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowLeft,
  ArrowUpRight,
  Clock3,
  FileBadge2,
  LifeBuoy,
  Mail,
  MonitorSmartphone,
  Navigation,
  Phone,
  UsersRound,
} from '@lucide/vue'

const router = useRouter()

const systemInfo = ref({
  brand: '',
  model: '',
  system: '',
  platform: navigator.platform || 'web',
  language: navigator.language || 'zh-CN',
  windowWidth: window.innerWidth,
  windowHeight: window.innerHeight,
})

function parseUA() {
  const ua = navigator.userAgent || ''
  if (/iPhone|iPad|iPod/.test(ua)) {
    systemInfo.value.brand = 'Apple'
    systemInfo.value.model = /iPad/.test(ua) ? 'iPad' : /iPhone/.test(ua) ? 'iPhone' : 'iOS Device'
    const match = ua.match(/OS (\d+[_\.\d]*)/)
    systemInfo.value.system = `iOS ${match ? match[1].replaceAll('_', '.') : ''}`
  } else if (/Android/.test(ua)) {
    systemInfo.value.brand = 'Android'
    const match = ua.match(/Android\s([\d.]+)/)
    systemInfo.value.system = `Android ${match ? match[1] : ''}`
    systemInfo.value.model = /; ([^;]*?) Build/.test(ua) ? RegExp.$1.trim() : 'Android Device'
  } else {
    systemInfo.value.brand = 'Web'
    systemInfo.value.model = 'Desktop / Other'
    systemInfo.value.system = ua.slice(0, 80)
  }
}

function handleResize() {
  systemInfo.value.windowWidth = window.innerWidth
  systemInfo.value.windowHeight = window.innerHeight
}

function goHome() {
  router.push({ path: '/' })
}

onMounted(() => {
  document.title = '支持站 · 智工迎新'
  parseUA()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.connect-page {
  --ise-ink: #0a2e3b;
  --ise-primary: #0d9488;
  --ise-primary-dark: #08766d;
  --ise-accent: #c7f24a;
  --ise-canvas: #f3f7f5;
  --ise-surface: #fff;
  --ise-text: #102a2e;
  --ise-muted: #5e7271;
  --ise-border: #d6e4df;
  min-height: 100vh;
  color: var(--ise-text);
  background-color: var(--ise-canvas);
  background-image:
    linear-gradient(rgba(13, 148, 136, 0.055) 1px, transparent 1px),
    linear-gradient(90deg, rgba(13, 148, 136, 0.055) 1px, transparent 1px);
  background-size: 32px 32px;
  font-family: "Noto Sans SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  padding: 18px clamp(16px, 4vw, 40px) 40px;
  box-sizing: border-box;
}

.skip-link {
  position: fixed;
  top: 8px;
  left: 8px;
  z-index: 20;
  padding: 10px 14px;
  color: var(--ise-ink);
  background: var(--ise-accent);
  border-radius: 999px;
  transform: translateY(-150%);
  transition: transform 180ms ease;
}

.skip-link:focus { transform: translateY(0); }

.connect-header,
.connect-main {
  width: min(100%, 1240px);
  margin-inline: auto;
}

.connect-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 58px;
  padding: 0 18px;
  border: 1px solid rgba(214, 228, 223, 0.9);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(14px);
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 8px;
  border: 0;
  color: var(--ise-ink);
  background: transparent;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.header-code,
.eyebrow,
.card-heading p,
.maintenance-card p,
.note-card p,
.connect-footer {
  font-family: "SFMono-Regular", Menlo, Consolas, monospace;
}

.header-code {
  color: var(--ise-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.page-intro {
  display: grid;
  grid-template-columns: 1.35fr 0.65fr;
  align-items: end;
  gap: 48px;
  padding: 64px 4px 40px;
}

.eyebrow {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0 0 14px;
  color: var(--ise-primary-dark);
  font-size: 10px;
  font-weight: 800;
}

.eyebrow span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ise-accent);
  box-shadow: 0 0 0 4px rgba(10, 46, 59, 0.08);
}

h1,
h2,
p { margin-top: 0; }

h1 {
  margin-bottom: 0;
  color: var(--ise-ink);
  font-family: "DIN Alternate", "Avenir Next", "Noto Sans SC", sans-serif;
  font-size: clamp(38px, 6.2vw, 72px);
  font-weight: 800;
  line-height: 0.98;
  letter-spacing: -0.045em;
}

.intro-copy {
  max-width: 420px;
  margin-bottom: 4px;
  color: var(--ise-muted);
  font-size: 15px;
  line-height: 1.75;
}

.support-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 16px;
}

.contact-card,
.system-card,
.maintenance-card,
.note-card {
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
  border: 1px solid var(--ise-border);
  border-radius: 24px;
}

.contact-card {
  grid-column: span 7;
  grid-row: span 2;
  min-height: 550px;
  padding: clamp(24px, 4vw, 44px);
  color: #fff;
  background: var(--ise-ink);
}

.map-grid {
  position: absolute;
  inset: 0;
  opacity: 0.14;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.4) 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: linear-gradient(to bottom right, #000, transparent 78%);
}

.coordinate {
  position: absolute;
  z-index: 1;
  color: rgba(255, 255, 255, 0.42);
  font-family: "SFMono-Regular", Menlo, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.04em;
}

.coordinate-top { top: 22px; right: 24px; }
.coordinate-side { right: 19px; bottom: 96px; writing-mode: vertical-rl; }

.card-heading {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 14px;
}

.card-heading p,
.maintenance-card p,
.note-card p {
  margin-bottom: 5px;
  color: var(--ise-primary-dark);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.card-heading h2,
.maintenance-card h2,
.note-card h2 {
  margin: 0;
  color: var(--ise-ink);
  font-size: clamp(20px, 2.4vw, 28px);
  line-height: 1.18;
}

.contact-heading p { color: var(--ise-accent); }
.contact-heading h2 { color: #fff; }

.icon-tile,
.maintenance-icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  color: var(--ise-ink);
  background: #e7f1ed;
  border-radius: 14px 5px 14px 5px;
}

.icon-tile-accent { background: var(--ise-accent); }

.contact-lead {
  position: relative;
  z-index: 1;
  max-width: 510px;
  margin: 32px 0 24px;
  color: rgba(255, 255, 255, 0.73);
  font-size: 15px;
  line-height: 1.7;
}

.contact-actions {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 10px;
}

.contact-actions a {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  min-height: 66px;
  padding: 8px 15px 8px 10px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 17px;
  color: #fff;
  text-decoration: none;
  background: rgba(255, 255, 255, 0.075);
  transition: transform 220ms cubic-bezier(.16, 1, .3, 1), background 220ms ease;
}

.contact-actions a > span:first-child {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  color: var(--ise-ink);
  background: var(--ise-accent);
  border-radius: 13px 5px 13px 5px;
}

.contact-actions a > span:nth-child(2),
.team-row > span {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.contact-actions small,
.team-row small {
  color: rgba(255, 255, 255, 0.56);
  font-size: 11px;
}

.contact-actions strong {
  overflow: hidden;
  font-size: 14px;
  text-overflow: ellipsis;
}

.contact-actions a:hover { transform: translateY(-2px); background: rgba(255, 255, 255, 0.11); }
.contact-actions a:active { transform: scale(0.99); }

.team-row {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 22px;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.13);
}

.team-row > svg { color: var(--ise-accent); }
.team-row strong { font-size: 14px; }

.route-signature {
  position: absolute;
  right: 42px;
  bottom: 34px;
  display: flex;
  align-items: center;
  width: 185px;
}

.route-signature span { flex: 1; height: 1px; background: rgba(199, 242, 74, 0.5); }
.route-signature i { width: 7px; height: 7px; border: 2px solid var(--ise-accent); border-radius: 50%; }
.route-signature i:last-child { background: var(--ise-accent); box-shadow: 0 0 0 5px rgba(199, 242, 74, 0.12); }

.system-card {
  grid-column: span 5;
  padding: clamp(24px, 3vw, 34px);
  background: var(--ise-surface);
}

.system-note {
  margin: 24px 0 18px;
  color: var(--ise-muted);
  font-size: 13px;
  line-height: 1.6;
}

.system-list { margin: 0; }
.system-list > div {
  display: grid;
  grid-template-columns: 82px minmax(0, 1fr);
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid var(--ise-border);
}

.system-list dt {
  color: var(--ise-muted);
  font-size: 12px;
}

.system-list dd {
  min-width: 0;
  margin: 0;
  color: var(--ise-text);
  font-family: "SFMono-Regular", Menlo, Consolas, monospace;
  font-size: 12px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.ua-value {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-height: 1.5;
}

.device-status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-top: 20px;
  padding: 7px 10px;
  border: 1px solid var(--ise-border);
  border-radius: 999px;
  color: var(--ise-primary-dark);
  background: #f7faf8;
  font-size: 11px;
  font-weight: 800;
}

.device-status span { width: 7px; height: 7px; border-radius: 50%; background: var(--ise-accent); box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.1); }

.maintenance-card {
  grid-column: span 5;
  display: flex;
  align-items: center;
  gap: 18px;
  min-height: 150px;
  padding: 24px 28px;
  background: #e7f1ed;
}

.maintenance-icon { color: #fff; background: var(--ise-primary); }
.maintenance-card h2 { margin-bottom: 8px; font-size: clamp(18px, 2vw, 23px); }
.maintenance-card span { color: var(--ise-muted); font-size: 13px; line-height: 1.55; }

.note-card {
  grid-column: span 7;
  display: flex;
  align-items: flex-start;
  gap: 18px;
  min-height: 186px;
  padding: 28px 32px;
  background: var(--ise-surface);
}

.note-card > svg { flex: 0 0 auto; margin-top: 2px; color: var(--ise-primary); }
.note-card h2 { margin-bottom: 18px; font-size: clamp(21px, 2.5vw, 30px); }
.note-card span { color: var(--ise-muted); font-size: 12px; }

.connect-footer {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding: 24px 4px 6px;
  color: var(--ise-muted);
  font-size: 10px;
}

.connect-footer span { display: inline-flex; align-items: center; gap: 6px; }
.mobile-home { display: none; }

button:focus-visible,
a:focus-visible {
  outline: 3px solid var(--ise-accent);
  outline-offset: 3px;
  box-shadow: 0 0 0 5px var(--ise-ink);
}

@media (max-width: 1023px) {
  .page-intro { grid-template-columns: 1fr 0.75fr; }
  .contact-card { grid-column: span 7; }
  .system-card { grid-column: span 5; }
}

@media (max-width: 700px) {
  .connect-page { padding: 12px 12px calc(92px + env(safe-area-inset-bottom)); }
  .connect-header { min-height: 52px; padding: 0 13px; border-radius: 16px; }
  .back-link { display: none; }
  .header-code { margin-left: auto; }
  .page-intro { grid-template-columns: 1fr; gap: 22px; padding: 42px 4px 28px; }
  h1 { font-size: clamp(36px, 11.4vw, 52px); }
  .intro-copy { max-width: 37em; margin-bottom: 0; font-size: 14px; }
  .support-grid { display: flex; flex-direction: column; }
  .contact-card,
  .system-card,
  .maintenance-card,
  .note-card { width: 100%; min-height: auto; border-radius: 22px; }
  .contact-card { padding: 26px 20px 86px; }
  .contact-lead { margin: 26px 0 20px; font-size: 14px; }
  .contact-actions a { padding-right: 12px; }
  .route-signature { right: 26px; bottom: 35px; width: 150px; }
  .system-card { padding: 24px 20px; }
  .system-list > div { grid-template-columns: 76px minmax(0, 1fr); }
  .maintenance-card { padding: 22px 20px; }
  .note-card { padding: 24px 20px; }
  .connect-footer { flex-direction: column; gap: 9px; padding: 22px 4px 0; }
  .mobile-home {
    position: fixed;
    right: 12px;
    bottom: calc(12px + env(safe-area-inset-bottom));
    left: 12px;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    min-height: 56px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 18px;
    color: #fff;
    background: var(--ise-ink);
    box-shadow: 0 14px 32px rgba(10, 46, 59, 0.2);
    font: inherit;
    font-weight: 800;
  }
}

@media (max-width: 420px) {
  .contact-actions a { grid-template-columns: 40px minmax(0, 1fr) 16px; gap: 10px; }
  .contact-actions strong { font-size: 12px; }
  .card-heading h2 { font-size: 20px; }
}

@media (prefers-reduced-motion: no-preference) {
  .page-intro > div,
  .intro-copy,
  .support-grid > * {
    opacity: 0;
    animation: reveal-up 480ms cubic-bezier(.16, 1, .3, 1) forwards;
  }
  .intro-copy { animation-delay: 80ms; }
  .support-grid > :nth-child(1) { animation-delay: 120ms; }
  .support-grid > :nth-child(2) { animation-delay: 160ms; }
  .support-grid > :nth-child(3) { animation-delay: 200ms; }
  .support-grid > :nth-child(4) { animation-delay: 240ms; }
  @keyframes reveal-up {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; animation: none !important; }
}
</style>
