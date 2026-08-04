<template>
  <div class="future-page">
    <img class="page-bg" :src="PAGE_BACKGROUND" alt="" aria-hidden="true" />

    <header class="site-header">
      <button class="back-button" type="button" @click="router.push('/')">‹ 返回图鉴</button>
      <img class="site-logo" :src="SITE_LOGO" alt="中山大学智能工程学院" />
      <span class="user-chip">{{ currentUser?.username || '智工新生' }}</span>
    </header>

    <main class="page-shell">
      <section class="intro">
        <div>
          <p class="eyebrow">FUTURE LETTER · 2026—2030</p>
          <h1>写下此刻，寄给<em>未来的你</em></h1>
          <p class="lede">生活期盼与四年后的寄语可以同时创作，每一封都有独立的文字和卡片样式。</p>
        </div>
        <div class="year-seal" aria-hidden="true"><strong>2030</strong><span>与未来<br />如期相见</span></div>
      </section>

      <div v-if="pageError" class="page-alert" role="alert">{{ pageError }}</div>

      <section class="workspace">
        <div class="editor-panel">
          <div class="section-title">
            <span>01</span>
            <div><h2>选择内容类型</h2><p>两类内容会分别保留，不会互相覆盖。</p></div>
          </div>

          <div class="mode-switch" role="tablist" aria-label="内容类型">
            <button
              v-for="mode in MODES"
              :key="mode.id"
              type="button"
              role="tab"
              :aria-selected="activeMode === mode.id"
              :class="{ active: activeMode === mode.id }"
              @click="activeMode = mode.id"
            >
              <strong>{{ mode.label }}</strong>
              <small>最多 {{ LIMITS[mode.id] }} 字</small>
            </button>
          </div>

          <label class="field-label" for="future-content">{{ activeModeConfig.label }}</label>
          <textarea
            id="future-content"
            v-model="activeDraft.content"
            :placeholder="activeModeConfig.placeholder"
            spellcheck="false"
            @blur="normalizeActiveDraft"
          />
          <div class="input-footer">
            <span>{{ activeModeConfig.hint }}</span>
            <strong :class="{ over: activeCount > activeLimit }">{{ activeCount }} / {{ activeLimit }}</strong>
          </div>
          <p class="validation-message" aria-live="polite">{{ validationMessage }}</p>

          <div class="section-title compact">
            <span>02</span>
            <div><h2>编辑卡片</h2><p>当前模式的设置只作用于这一封信。</p></div>
          </div>

          <div class="control-group">
            <span class="field-label">美术模板</span>
            <div class="template-grid">
              <button
                v-for="template in TEMPLATES"
                :key="template.id"
                type="button"
                class="template-card"
                :class="[{ selected: activeDraft.style.templateId === template.id }, `template-${template.id}`]"
                @click="activeDraft.style.templateId = template.id"
              >
                <span class="template-swatch" />
                <strong>{{ template.label }}</strong>
                <small>{{ template.caption }}</small>
              </button>
            </div>
          </div>

          <div class="control-row">
            <label class="control-group">
              <span class="field-label">中文字体</span>
              <select v-model="activeDraft.style.fontId">
                <option value="song">宋体风</option>
                <option value="sans">黑体风</option>
                <option value="hand">手写风</option>
              </select>
            </label>
            <div class="control-group">
              <span class="field-label">字号</span>
              <div class="pill-group">
                <button v-for="size in SIZES" :key="size.id" type="button" :class="{ selected: activeDraft.style.size === size.id }" @click="activeDraft.style.size = size.id">{{ size.label }}</button>
              </div>
            </div>
          </div>

          <div class="control-row">
            <div class="control-group">
              <span class="field-label">文字对齐</span>
              <div class="pill-group">
                <button type="button" :class="{ selected: activeDraft.style.align === 'left' }" @click="activeDraft.style.align = 'left'">左对齐</button>
                <button type="button" :class="{ selected: activeDraft.style.align === 'center' }" @click="activeDraft.style.align = 'center'">居中</button>
              </div>
            </div>
            <label class="control-group signature-control">
              <span class="field-label">署名</span>
              <select v-model="activeDraft.style.signatureMode">
                <option value="default">一名智工新生</option>
                <option value="nickname">使用账号昵称</option>
              </select>
            </label>
          </div>

          <div class="editor-actions">
            <button type="button" class="secondary-button" :disabled="busy" @click="saveCurrent(false)">保存当前</button>
            <button type="button" class="secondary-button" :disabled="busy" @click="saveBoth">保存两类内容</button>
            <button type="button" class="primary-button" :disabled="busy" @click="saveCurrent(true)">{{ busy ? '处理中…' : '保存并生成图片' }}</button>
          </div>
          <p class="save-status">{{ saveStatus }}</p>
        </div>

        <aside class="preview-panel">
          <div class="preview-heading">
            <div><p class="eyebrow">LIVE PREVIEW</p><h2>实时预览</h2></div>
            <span>1080 × 1440</span>
          </div>
          <div class="canvas-frame">
            <canvas ref="previewCanvas" width="1080" height="1440" aria-label="时光信笺卡片预览" />
            <div v-if="previewBusy" class="canvas-loading">正在载入字体…</div>
          </div>
          <p class="preview-note" :class="{ warning: layoutOverflow }">
            {{ layoutOverflow ? '当前字号无法完整排下全部文字，请缩短内容或选择更小字号。' : '预览与导出使用同一套 Canvas 排版。' }}
          </p>
        </aside>
      </section>

      <section class="saved-section">
        <div class="saved-heading">
          <div><p class="eyebrow">MY LETTERS</p><h2>已保存的信笺</h2></div>
          <button type="button" class="text-button" @click="loadCards">刷新</button>
        </div>
        <div v-if="savedLoading" class="empty-state">正在读取你的信笺…</div>
        <div v-else-if="!savedCards.length" class="empty-state">还没有保存的信笺，写下第一封吧。</div>
        <div v-else class="saved-grid">
          <article v-for="card in savedCards" :key="card.id" class="saved-card">
            <canvas :ref="el => setThumbnailRef(card.id, el)" width="1080" height="1440" aria-hidden="true" />
            <div class="saved-card-body">
              <h3>{{ modeLabel(card.mode) }}</h3>
              <p>{{ card.content }}</p>
              <time>{{ formatDate(card.updatedAt) }}</time>
              <div class="saved-actions">
                <button type="button" @click="editCard(card)">重新编辑</button>
                <button type="button" @click="copyCard(card)">复制一张</button>
                <button type="button" @click="removeCard(card)">删除</button>
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>

    <div v-if="resultVisible" class="result-mask" role="dialog" aria-modal="true" aria-labelledby="result-title" @click.self="closeResult">
      <div class="result-dialog">
        <button class="dialog-close" type="button" aria-label="关闭" @click="closeResult">×</button>
        <p class="eyebrow">YOUR LETTER IS READY</p>
        <h2 id="result-title">这一刻，值得被保存。</h2>
        <canvas ref="resultCanvas" width="1080" height="1440" />
        <div class="result-actions">
          <button type="button" class="secondary-button" @click="downloadResult">保存图片</button>
          <button type="button" class="primary-button" @click="shareResult">系统分享</button>
        </div>
        <div class="result-links">
          <button type="button" class="text-button" @click="closeResult">重新编辑</button>
          <button type="button" class="text-button" @click="copyResult">复制一张</button>
        </div>
      </div>
    </div>

    <div class="toast" :class="{ visible: toastMessage }" role="status">{{ toastMessage }}</div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { request } from '@/utils/request'
import auth from '@/utils/auth'
import '@/styles/futureFonts.css'

const PAGE_BACKGROUND = 'https://sysuzngcxy-1322240898.cos.ap-guangzhou.myqcloud.com/bg.jpg'
const SITE_LOGO = 'https://sysuzngcxy-1322240898.cos.ap-guangzhou.myqcloud.com/logo1.png'
const DRAFT_VERSION = 'v2'
const LIMITS = Object.freeze({ expectation: 60, letter: 500 })
const MODES = Object.freeze([
  { id: 'expectation', label: '我的大学生活期盼', hint: '一句目标也可以，先从最想实现的事写起。', placeholder: '例如：希望四年后，我已经做出了第一个真正改变世界的小项目。' },
  { id: 'letter', label: '给四年后的我', hint: '写给未来的自己，慢一点也没有关系。', placeholder: '例如：嘿，四年后的我。还记得刚进入智工学院时，对未来既紧张又期待的你吗？' }
])
const TEMPLATES = Object.freeze([
  { id: 'sysu-editorial', label: '中大红·校刊', caption: '克制、庄重' },
  { id: 'lake-morning', label: '逸仙湖·晨光', caption: '清新、温暖' },
  { id: 'engineering-blueprint', label: '智工蓝图', caption: '理性、未来' }
])
const SIZES = Object.freeze([{ id: 'small', label: '小' }, { id: 'medium', label: '中' }, { id: 'large', label: '大' }])
const THEMES = Object.freeze({
  'sysu-editorial': { bg: '#fff8f3', ink: '#1c1715', muted: '#725c56', accent: '#8c1515', secondary: '#eadbd5' },
  'lake-morning': { bg: '#eef7ed', ink: '#24372d', muted: '#627568', accent: '#b77b21', secondary: '#b7dcc8' },
  'engineering-blueprint': { bg: '#1c2d3b', ink: '#f7f2e8', muted: '#b8c9c9', accent: '#e8b45c', secondary: '#6e9a9b' }
})
const FONT_FAMILIES = Object.freeze({
  song: '"Noto Serif SC", serif',
  sans: '"Noto Sans SC", sans-serif',
  hand: '"Ma Shan Zheng", cursive'
})

function createDraft(mode) {
  return {
    id: null,
    mode,
    content: '',
    style: {
      templateId: mode === 'expectation' ? 'sysu-editorial' : 'lake-morning',
      fontId: 'sans',
      size: 'medium',
      align: 'left',
      signatureMode: 'default',
      signatureText: '一名智工新生'
    }
  }
}

const router = useRouter()
const activeMode = ref('expectation')
const drafts = reactive({ expectation: createDraft('expectation'), letter: createDraft('letter') })
const currentUser = ref(null)
const previewCanvas = ref(null)
const resultCanvas = ref(null)
const resultVisible = ref(false)
const resultCard = ref(null)
const lastBlob = ref(null)
const busy = ref(false)
const previewBusy = ref(true)
const layoutOverflow = ref(false)
const pageError = ref('')
const saveStatus = ref('草稿会自动保存在当前设备')
const savedCards = ref([])
const savedLoading = ref(false)
const thumbnailRefs = new Map()
const toastMessage = ref('')
let toastTimer = null
let renderFrame = null

const activeDraft = computed(() => drafts[activeMode.value])
const activeModeConfig = computed(() => MODES.find(item => item.id === activeMode.value) || MODES[0])
const activeLimit = computed(() => LIMITS[activeMode.value])
const activeCount = computed(() => visibleLength(activeDraft.value.content))
const validationMessage = computed(() => {
  if (!activeDraft.value.content) return ''
  if (!activeDraft.value.content.trim()) return '内容不能只包含空格或换行。'
  if (activeCount.value > activeLimit.value) return `当前内容超出 ${activeCount.value - activeLimit.value} 个可见字符。`
  return ''
})

function draftKey() {
  return currentUser.value?.id == null ? '' : `future-card-drafts:${DRAFT_VERSION}:${currentUser.value.id}`
}

function visibleLength(value) {
  const text = String(value || '').normalize('NFC').replace(/\r\n?/g, '\n')
  const segmenter = globalThis.Intl?.Segmenter ? new Intl.Segmenter('zh-CN', { granularity: 'grapheme' }) : null
  const parts = segmenter ? [...segmenter.segment(text)].map(item => item.segment) : Array.from(text)
  return parts.filter(part => !/^\s+$/u.test(part)).length
}

function normalizeActiveDraft() {
  activeDraft.value.content = String(activeDraft.value.content || '').normalize('NFKC').replace(/\r\n?/g, '\n')
}

function persistDrafts() {
  const key = draftKey()
  if (!key) return
  try {
    localStorage.setItem(key, JSON.stringify({ activeMode: activeMode.value, drafts }))
  } catch {
    saveStatus.value = '浏览器存储不可用，请及时同步到账号'
  }
}

function restoreDrafts() {
  const key = draftKey()
  if (!key) return
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null')
    if (!saved || typeof saved !== 'object') return
    for (const mode of ['expectation', 'letter']) {
      const incoming = saved.drafts?.[mode]
      if (!incoming || typeof incoming !== 'object') continue
      const base = createDraft(mode)
      drafts[mode] = {
        ...base,
        id: typeof incoming.id === 'string' ? incoming.id : null,
        content: typeof incoming.content === 'string' ? incoming.content : '',
        style: { ...base.style, ...(incoming.style || {}) }
      }
    }
    activeMode.value = saved.activeMode === 'letter' ? 'letter' : 'expectation'
  } catch {
    localStorage.removeItem(key)
  }
}

function signatureFor(snapshot) {
  if (snapshot.style.signatureMode === 'nickname') {
    if (snapshot.updatedAt && snapshot.style.signatureText) return snapshot.style.signatureText
    if (currentUser.value?.username) return String(currentUser.value.username).slice(0, 24)
  }
  return '一名智工新生'
}

function snapshotFromDraft(mode = activeMode.value) {
  const draft = drafts[mode]
  return {
    id: draft.id,
    mode,
    content: String(draft.content || '').replace(/\r\n?/g, '\n').trim(),
    templateId: draft.style.templateId,
    style: { ...draft.style, signatureText: signatureFor(draft) },
    createdAt: new Date().toISOString()
  }
}

function validateDraft(mode) {
  const draft = drafts[mode]
  const content = String(draft.content || '').replace(/\r\n?/g, '\n').trim()
  const count = visibleLength(content)
  if (!content || !count) throw clientError('CONTENT_EMPTY', '请先写下一点内容')
  if (count > LIMITS[mode]) throw clientError('CONTENT_TOO_LONG', `当前内容最多 ${LIMITS[mode]} 个可见字符`)
  return content
}

function clientError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function responseData(response) {
  if (response?.ok && response?.data?.code === 0) return response.data.data || {}
  const body = response?.data || {}
  throw clientError(body.errorCode || (response?.status === 401 ? 'AUTH_REQUIRED' : 'REQUEST_FAILED'), body.message || '请求失败，请稍后重试')
}

function payloadFor(mode) {
  const draft = drafts[mode]
  return {
    mode,
    content: validateDraft(mode),
    templateId: draft.style.templateId,
    style: {
      fontId: draft.style.fontId,
      size: draft.style.size,
      align: draft.style.align,
      signatureMode: draft.style.signatureMode
    }
  }
}

async function saveMode(mode, reload = true) {
  const draft = drafts[mode]
  const method = draft.id ? 'PATCH' : 'POST'
  const endpoint = draft.id ? `/future-cards/${encodeURIComponent(draft.id)}` : '/future-cards'
  const response = await request(endpoint, method, payloadFor(mode))
  const { card } = responseData(response)
  drafts[mode] = {
    id: card.id,
    mode: card.mode,
    content: card.content,
    style: { templateId: card.templateId, ...card.style }
  }
  persistDrafts()
  if (reload) await loadCards()
  saveStatus.value = `已同步至账号 · ${formatDateTime(card.updatedAt)}`
  return card
}

async function saveCurrent(generateAfterSave) {
  if (busy.value) return
  busy.value = true
  pageError.value = ''
  try {
    const card = await saveMode(activeMode.value)
    showToast(generateAfterSave ? '已保存，正在生成图片' : '当前信笺已保存')
    if (generateAfterSave) await openResult(card)
  } catch (error) {
    handleSaveError(error)
  } finally {
    busy.value = false
  }
}

async function saveBoth() {
  if (busy.value) return
  const modes = ['expectation', 'letter'].filter(mode => String(drafts[mode].content || '').trim())
  if (!modes.length) return showToast('请至少写下一类内容')
  busy.value = true
  pageError.value = ''
  const results = []
  for (const mode of modes) {
    try {
      await saveMode(mode, false)
      results.push({ mode, ok: true })
    } catch (error) {
      results.push({ mode, ok: false, error })
    }
  }
  await loadCards()
  busy.value = false
  const successes = results.filter(item => item.ok).length
  const failures = results.length - successes
  if (failures) {
    const first = results.find(item => !item.ok)?.error
    pageError.value = `已保存 ${successes} 份，${failures} 份失败：${friendlyError(first)}`
    showToast('部分内容未能保存，本地草稿仍在')
  } else {
    saveStatus.value = `两类内容已分别保存，共 ${successes} 份`
    showToast(saveStatus.value)
  }
}

function friendlyError(error) {
  if (error?.code === 'CONTENT_REJECTED') return '内容未通过安全检查，请换一种表达'
  if (error?.code === 'RATE_LIMITED') return '操作太频繁，请稍后重试'
  if (error?.code === 'AUTH_REQUIRED') return '登录状态已失效'
  return error?.message || '网络暂时不可用'
}

function handleSaveError(error) {
  if (error?.code === 'AUTH_REQUIRED') {
    router.push({ path: '/signin', query: { redirect: '/future-card' } })
    return
  }
  pageError.value = friendlyError(error)
  saveStatus.value = '本地草稿已保留，账号同步可稍后重试'
  showToast(error?.code === 'CONTENT_REJECTED' ? '内容未通过安全检查，未生成图片' : '保存失败，本地草稿仍在')
}

async function loadCards() {
  savedLoading.value = true
  try {
    const response = await request('/future-cards', 'GET')
    savedCards.value = responseData(response).cards || []
    savedLoading.value = false
    await nextTick()
    renderThumbnails()
  } catch (error) {
    if (error?.code === 'AUTH_REQUIRED') router.push({ path: '/signin', query: { redirect: '/future-card' } })
    else pageError.value = friendlyError(error)
  } finally {
    savedLoading.value = false
  }
}

function editCard(card) {
  drafts[card.mode] = {
    id: card.id,
    mode: card.mode,
    content: card.content,
    style: { templateId: card.templateId, ...card.style }
  }
  activeMode.value = card.mode
  persistDrafts()
  window.scrollTo({ top: 0, behavior: 'smooth' })
  showToast('已载入这封信，可以继续编辑')
}

function copyCard(card) {
  drafts[card.mode] = {
    id: null,
    mode: card.mode,
    content: card.content,
    style: { templateId: card.templateId, ...card.style }
  }
  activeMode.value = card.mode
  persistDrafts()
  window.scrollTo({ top: 0, behavior: 'smooth' })
  showToast('已复制为一封新的本地草稿')
}

async function removeCard(card) {
  if (!window.confirm('确定删除这封信吗？删除后无法恢复。')) return
  try {
    const response = await request(`/future-cards/${encodeURIComponent(card.id)}`, 'DELETE…133 tokens truncated…s.load('400 32px "Noto Sans SC"'),
    document.fonts.load('400 32px "Ma Shan Zheng"')
  ]).then(() => true).catch(() => false)
  return Promise.race([ready, timeout])
}

async function openResult(card) {
  previewBusy.value = true
  const fontsReady = await waitForFonts()
  previewBusy.value = false
  if (!fontsReady) showToast('部分字体加载失败，将使用系统字体生成')
  resultCard.value = card
  resultVisible.value = true
  await nextTick()
  const layout = drawCard(resultCanvas.value, card)
  if (layout.overflow) {
    resultVisible.value = false
    resultCard.value = null
    throw clientError('LAYOUT_OVERFLOW', '当前字号无法完整排下全部文字，请选择更小字号')
  }
  lastBlob.value = await canvasBlob(resultCanvas.value)
}

function canvasBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(clientError('EXPORT_FAILED', '图片生成失败')), 'image/png'))
}

function downloadResult() {
  if (!lastBlob.value) return
  const url = URL.createObjectURL(lastBlob.value)
  const link = document.createElement('a')
  link.href = url
  link.download = `时光信笺-${resultCard.value?.mode === 'letter' ? '四年后的我' : '大学期盼'}.png`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function shareResult() {
  if (!lastBlob.value) return
  const file = new File([lastBlob.value], '时光信笺.png', { type: 'image/png' })
  if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
    try {
      await navigator.share({ title: '我的时光信笺', text: '写给四年后的自己', files: [file] })
      return
    } catch (error) {
      if (error?.name === 'AbortError') return
    }
  }
  downloadResult()
  showToast('当前浏览器不支持图片分享，已改为下载')
}

function closeResult() {
  resultVisible.value = false
}

function copyResult() {
  if (resultCard.value) copyCard(resultCard.value)
  closeResult()
}

function setThumbnailRef(id, element) {
  if (element) thumbnailRefs.set(id, element)
  else thumbnailRefs.delete(id)
}

function renderThumbnails() {
  for (const card of savedCards.value) {
    const canvas = thumbnailRefs.get(card.id)
    if (canvas) drawCard(canvas, card)
  }
}

function graphemes(value) {
  const text = String(value || '')
  if (!globalThis.Intl?.Segmenter) return Array.from(text)
  return [...new Intl.Segmenter('zh-CN', { granularity: 'grapheme' }).segment(text)].map(item => item.segment)
}

function wrapText(ctx, text, maxWidth) {
  const lines = []
  String(text || '').split('\n').forEach(paragraph => {
    let line = ''
    for (const char of graphemes(paragraph)) {
      const candidate = line + char
      if (line && ctx.measureText(candidate).width > maxWidth) {
        lines.push(line)
        line = char
      } else line = candidate
    }
    lines.push(line)
  })
  return lines.length ? lines : ['']
}

function line(ctx, x1, y1, x2, y2, color, width = 1, alpha = 1) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.globalAlpha = alpha
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.restore()
}

function drawBackground(ctx, theme, templateId) {
  ctx.fillStyle = theme.bg
  ctx.fillRect(0, 0, 1080, 1440)
  if (templateId === 'sysu-editorial') {
    ctx.fillStyle = theme.accent
    ctx.fillRect(0, 0, 1080, 28)
    ctx.fillRect(0, 1412, 1080, 28)
    ctx.save()
    ctx.strokeStyle = theme.secondary
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(885, 185, 205, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(885, 185, 166, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
    line(ctx, 105, 105, 105, 1330, theme.secondary, 1)
    line(ctx, 975, 105, 975, 1330, theme.secondary, 1)
    ctx.save()
    ctx.strokeStyle = theme.accent
    ctx.globalAlpha = 0.35
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(120, 1330)
    ctx.lineTo(120, 1260)
    ctx.lineTo(180, 1260)
    ctx.lineTo(180, 1200)
    ctx.lineTo(245, 1200)
    ctx.lineTo(245, 1318)
    ctx.lineTo(330, 1318)
    ctx.stroke()
    ctx.restore()
  } else if (templateId === 'lake-morning') {
    ctx.fillStyle = '#f3c977'
    ctx.globalAlpha = 0.64
    ctx.beginPath()
    ctx.arc(865, 190, 88, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    for (let index = 0; index < 7; index += 1) line(ctx, 95, 1250 + index * 22, 985, 1240 + index * 22, '#7eaf9a', 2, 0.42)
    ctx.fillStyle = '#c8dfc6'
    ctx.globalAlpha = 0.68
    ctx.beginPath()
    ctx.arc(160, 1310, 78, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  } else {
    for (let x = 60; x < 1080; x += 44) line(ctx, x, 0, x, 1440, '#c7e0dc', 1, 0.2)
    for (let y = 60; y < 1440; y += 44) line(ctx, 0, y, 1080, y, '#c7e0dc', 1, 0.2)
    ctx.save()
    ctx.strokeStyle = theme.accent
    ctx.lineWidth = 4
    ctx.globalAlpha = 0.7
    ctx.beginPath()
    ctx.moveTo(110, 1320)
    ctx.lineTo(205, 1320)
    ctx.lineTo(205, 1260)
    ctx.lineTo(320, 1260)
    ctx.lineTo(320, 1340)
    ctx.lineTo(445, 1340)
    ctx.stroke()
    ctx.restore()
  }
}

function drawCard(canvas, snapshot) {
  if (!canvas) return { overflow: false }
  const ctx = canvas.getContext('2d')
  const templateId = snapshot.templateId || snapshot.style?.templateId || 'sysu-editorial'
  const theme = THEMES[templateId] || THEMES['sysu-editorial']
  const style = snapshot.style || {}
  const fontFamily = FONT_FAMILIES[style.fontId] || FONT_FAMILIES.sans
  const mode = snapshot.mode === 'letter' ? 'letter' : 'expectation'
  const title = modeLabel(mode)
  const created = snapshot.createdAt ? new Date(snapshot.createdAt) : new Date()
  const dateText = `${created.getFullYear()}.${String(created.getMonth() + 1).padStart(2, '0')}.${String(created.getDate()).padStart(2, '0')}`
  const sizes = mode === 'letter'
    ? { small: 24, medium: 27, large: 30 }
    : { small: 34, medium: 41, large: 48 }
  const contentSize = sizes[style.size] || sizes.medium
  const lineHeight = Math.round(contentSize * (mode === 'letter' ? 1.32 : 1.55))
  const contentTop = mode === 'letter' ? 425 : 500
  const contentBottom = 1215
  const maxLines = Math.floor((contentBottom - contentTop) / lineHeight) + 1

  ctx.clearRect(0, 0, 1080, 1440)
  drawBackground(ctx, theme, templateId)
  ctx.fillStyle = theme.accent
  ctx.font = '600 19px Georgia, serif'
  ctx.fillText('SCHOOL OF INTELLIGENT ENGINEERING', 150, 135)
  ctx.font = `400 17px ${fontFamily}`
  ctx.fillStyle = theme.muted
  ctx.fillText(dateText, 150, 174)
  ctx.textAlign = 'right'
  ctx.fillText('未来信笺  /  2030', 930, 154)
  ctx.textAlign = 'left'
  ctx.fillStyle = theme.ink
  ctx.font = `400 56px ${fontFamily}`
  ctx.fillText(title, 150, 275)
  line(ctx, 150, 330, 930, 330, theme.accent, 3, 0.9)
  ctx.fillStyle = theme.muted
  ctx.font = '400 16px Georgia, serif'
  ctx.fillText(mode === 'letter' ? 'A LETTER TO THE PERSON I WILL BECOME' : 'A SMALL PROMISE TO MY FUTURE SELF', 150, 372)

  ctx.fillStyle = theme.ink
  ctx.font = `400 ${contentSize}px ${fontFamily}`
  const textLines = wrapText(ctx, snapshot.content || '在这里写下你想对未来说的话。', 780)
  const overflow = textLines.length > maxLines
  const drawable = textLines.slice(0, maxLines)
  ctx.textAlign = style.align === 'center' ? 'center' : 'left'
  const textX = style.align === 'center' ? 540 : 150
  drawable.forEach((text, index) => ctx.fillText(text, textX, contentTop + index * lineHeight))
  ctx.textAlign = 'left'

  const footerY = 1260
  line(ctx, 150, footerY, 930, footerY, theme.secondary, 2, 0.8)
  ctx.fillStyle = theme.muted
  ctx.font = `400 17px ${fontFamily}`
  ctx.fillText('中山大学智能工程学院', 150, footerY + 48)
  ctx.font = '400 15px Georgia, serif'
  ctx.fillText('2026 入学  →  2030 预计毕业', 150, footerY + 80)
  ctx.textAlign = 'right'
  ctx.fillStyle = theme.ink
  ctx.font = `400 22px ${fontFamily}`
  ctx.fillText(signatureFor(snapshot), 930, footerY + 56)
  ctx.fillStyle = theme.muted
  ctx.font = '400 13px Georgia, serif'
  ctx.fillText('KEEP GOING', 930, footerY + 84)
  ctx.textAlign = 'left'
  ctx.fillStyle = theme.accent
  ctx.font = '600 15px Georgia, serif'
  ctx.fillText('03', 150, 1380)
  ctx.fillStyle = theme.muted
  ctx.font = '400 13px Georgia, serif'
  ctx.fillText('THE FIRST PAGE OF A LONG STORY', 188, 1380)
  return { overflow }
}

function schedulePreview() {
  if (renderFrame) cancelAnimationFrame(renderFrame)
  renderFrame = requestAnimationFrame(() => {
    const result = drawCard(previewCanvas.value, snapshotFromDraft())
    layoutOverflow.value = result.overflow
  })
}

function modeLabel(mode) {
  return mode === 'letter' ? '给四年后的我' : '我的大学生活期盼'
}

function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('zh-CN')
}

function formatDateTime(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-CN', { dateStyle: 'short', timeStyle: 'short' })
}

function showToast(message) {
  toastMessage.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMessage.value = '' }, 3000)
}

watch(drafts, () => {
  persistDrafts()
  schedulePreview()
}, { deep: true })
watch(activeMode, () => {
  persistDrafts()
  schedulePreview()
})

onMounted(async () => {
  document.title = '时光信笺｜笃行校园图鉴'
  if (!auth.isLoggedIn()) {
    router.push({ path: '/signin', query: { redirect: '/future-card' } })
    return
  }
  try {
    const response = await request('/auth/me', 'GET')
    if (!response?.ok || response?.data?.code !== 0) throw clientError('AUTH_REQUIRED', '请重新登录')
    currentUser.value = response.data.userInfo
    restoreDrafts()
    await nextTick()
    schedulePreview()
    previewBusy.value = true
    const fontsReady = await waitForFonts()
    previewBusy.value = false
    if (!fontsReady) showToast('部分字体加载失败，已启用系统字体回退')
    schedulePreview()
    await loadCards()
  } catch (error) {
    if (error?.code === 'AUTH_REQUIRED') router.push({ path: '/signin', query: { redirect: '/future-card' } })
    else pageError.value = friendlyError(error)
  }
})

onBeforeUnmount(() => {
  clearTimeout(toastTimer)
  if (renderFrame) cancelAnimationFrame(renderFrame)
  if (lastBlob.value) lastBlob.value = null
})
</script>

<style scoped>
.future-page{min-height:100vh;color:#17231e;font-family:"Noto Sans SC","Microsoft YaHei",sans-serif;position:relative}.page-bg{position:fixed;inset:0;width:100vw;height:100vh;object-fit:cover;z-index:-2}.future-page::before{content:"";position:fixed;inset:0;background:rgba(246,242,232,.86);backdrop-filter:blur(4px);z-index:-1}.site-header{height:70px;position:sticky;top:0;z-index:30;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:0 clamp(16px,4vw,54px);border-bottom:1px solid rgba(38,73,61,.16);background:rgba(250,248,242,.92);backdrop-filter:blur(14px)}.back-button,.text-button{border:0;background:none;color:#176b52;cursor:pointer}.back-button{justify-self:start;font-size:14px;padding:10px 0}.site-logo{height:46px;max-width:220px;object-fit:contain}.user-chip{justify-self:end;border:1px solid rgba(23,107,82,.25);background:#fff;border-radius:999px;padding:7px 13px;font-size:12px;color:#315c4f}.page-shell{max-width:1250px;margin:0 auto;padding:clamp(38px,6vw,76px) clamp(16px,4vw,52px) 100px}.intro{display:flex;align-items:flex-end;justify-content:space-between;gap:30px;margin-bottom:clamp(36px,6vw,70px)}.eyebrow{margin:0;color:#8c1515;font:600 11px Georgia,serif;letter-spacing:.16em}.intro h1{font-family:"Noto Serif SC",serif;font-size:clamp(38px,6vw,70px);font-weight:400;letter-spacing:-.045em;line-height:1.2;margin:16px 0}.intro h1 em{font-style:normal;color:#8c1515}.lede{max-width:670px;line-height:1.8;color:#56645e;margin:0}.year-seal{width:126px;height:126px;border:1px solid #8c1515;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#8c1515;transform:rotate(6deg);flex:none}.year-seal strong{font:400 29px Georgia,serif}.year-seal span{text-align:center;font-size:9px;letter-spacing:.12em;line-height:1.5}.page-alert{margin:-30px 0 28px;padding:12px 15px;border:1px solid #ddb5b5;border-radius:8px;background:#fff5f4;color:#8c1515;font-size:13px}.workspace{display:grid;grid-template-columns:minmax(0,1fr) minmax(370px,500px);gap:clamp(35px,6vw,88px);align-items:start}.editor-panel{min-width:0}.section-title{display:flex;gap:14px;align-items:flex-start;margin-bottom:20px}.section-title.compact{margin-top:48px}.section-title>span{color:#8c1515;font:400 16px Georgia,serif;padding-top:3px}.section-title h2,.preview-heading h2,.saved-heading h2{font-size:20px;margin:0 0 5px}.section-title p{color:#68756f;font-size:12px;margin:0}.mode-switch{display:grid;grid-template-columns:1fr 1fr;padding:4px;border:1px solid #d7d7cf;border-radius:10px;background:#edf0eb;margin-bottom:25px}.mode-switch button{border:0;border-radius:7px;background:transparent;text-align:left;padding:12px 14px;color:#44554e;display:flex;flex-direction:column;gap:3px}.mode-switch button.active{background:#fff;color:#8c1515;box-shadow:0 3px 13px rgba(35,64,53,.1)}.mode-switch strong{font-size:14px}.mode-switch small{font-size:11px}.field-label{display:block;color:#4f5e58;font-size:12px;letter-spacing:.05em;margin-bottom:8px}.editor-panel textarea{width:100%;min-height:185px;resize:vertical;border:1px solid #d5d7cf;border-radius:8px;background:rgba(255,255,255,.96);padding:16px 17px;font:400 16px/1.75 "Noto Sans SC",sans-serif;outline:none;color:#17231e}.editor-panel textarea:focus,.control-group select:focus{border-color:#176b52;box-shadow:0 0 0 3px rgba(23,107,82,.12)}.input-footer{display:flex;justify-content:space-between;gap:15px;margin-top:7px;color:#748078;font-size:11px}.input-footer strong{white-space:nowrap;font:400 12px Georgia,serif}.input-footer strong.over,.validation-message{color:#a31c25}.validation-message{min-height:20px;margin:5px 0 0;font-size:12px}.control-group{margin-top:20px}.template-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.template-card{border:1px solid #d5d7cf;border-radius:8px;background:#fff;padding:8px;text-align:left;color:#24332d}.template-card.selected{border-color:#8c1515;box-shadow:inset 0 0 0 1px #8c1515}.template-card strong,.template-card small{display:block}.template-card strong{font-size:11px;margin-top:6px}.template-card small{font-size:9px;color:#748078;margin-top:2px}.template-swatch{height:40px;border-radius:5px;display:block}.template-sysu-editorial .template-swatch{background:linear-gradient(120deg,#fff8f3 0 66%,#8c1515 67%)}.template-lake-morning .template-swatch{background:radial-gradient(circle at 78% 25%,#f3c977 0 12%,transparent 13%),linear-gradient(150deg,#eef7ed 0 62%,#a8d8c4 63%)}.template-engineering-blueprint .template-swatch{background-color:#1c2d3b;background-image:linear-gradient(rgba(218,237,236,.2) 1px,transparent 1px),linear-gradient(90deg,rgba(218,237,236,.2) 1px,transparent 1px);background-size:10px 10px}.control-row{display:grid;grid-template-columns:1fr 1fr;gap:18px}.control-group select{height:43px;width:100%;border:1px solid #d5d7cf;border-radius:7px;background:#fff;padding:0 11px;outline:none;color:#26362f}.pill-group{display:flex;gap:7px}.pill-group button{height:43px;flex:1;border:1px solid #d5d7cf;border-radius:7px;background:#fff;color:#516059}.pill-group button.selected{background:#176b52;border-color:#176b52;color:#fff}.editor-actions{display:grid;grid-template-columns:auto auto 1fr;gap:8px;margin-top:30px}.primary-button,.secondary-button{height:47px;border-radius:7px;padding:0 16px;font-size:13px}.primary-button{border:1px solid #8c1515;background:#8c1515;color:#fff}.secondary-button{border:1px solid #cfd4cc;background:#fff;color:#23332d}.primary-button:disabled,.secondary-button:disabled{opacity:.55;cursor:wait}.save-status{text-align:right;color:#748078;font-size:11px;margin:9px 0 0}.preview-panel{position:sticky;top:96px}.preview-heading,.saved-heading{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:14px}.preview-heading>span{font:400 11px Georgia,serif;color:#73817a}.canvas-frame{position:relative;border-radius:7px;overflow:hidden;background:#fff;box-shadow:0 18px 50px rgba(31,55,46,.16)}.canvas-frame canvas{width:100%;height:auto;display:block}.canvas-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.72);font-size:12px;color:#52615a}.preview-note{font-size:11px;line-height:1.6;color:#748078}.preview-note.warning{color:#a31c25}.saved-section{margin-top:100px;border-top:1px solid rgba(38,73,61,.18);padding-top:38px}.saved-heading .text-button{font-size:12px}.saved-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.empty-state{padding:34px;border:1px dashed #bdc9c1;border-radius:8px;text-align:center;color:#6f7e76;background:rgba(255,255,255,.62)}.saved-card{display:grid;grid-template-columns:92px minmax(0,1fr);gap:12px;padding:10px;border:1px solid #d2d8d0;border-radius:8px;background:rgba(255,255,255,.9)}.saved-card canvas{width:92px;height:123px;border-radius:4px;background:#eee}.saved-card-body{display:flex;flex-direction:column;min-width:0}.saved-card h3{font-size:12px;margin:2px 0 5px}.saved-card p{font-size:11px;line-height:1.45;color:#68756f;margin:0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.saved-card time{margin-top:auto;font-size:9px;color:#8a958f}.saved-actions{display:flex;gap:8px;margin-top:7px;flex-wrap:wrap}.saved-actions button{border:0;background:none;color:#176b52;padding:0;font-size:10px}.result-mask{position:fixed;inset:0;z-index:80;background:rgba(14,28,22,.65);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:18px}.result-dialog{width:min(520px,100%);max-height:94vh;overflow:auto;border-radius:14px;background:#f9f7f0;padding:28px clamp(18px,5vw,40px);text-align:center;position:relative}.dialog-close{position:absolute;right:16px;top:10px;border:0;background:none;color:#69766f;font-size:26px}.result-dialog h2{font-family:"Noto Serif SC",serif;font-weight:400;margin:10px 0 18px}.result-dialog canvas{display:block;width:min(260px,70vw);height:auto;margin:0 auto 20px;border-radius:5px;box-shadow:0 10px 32px rgba(0,0,0,.18)}.result-actions{display:flex;gap:9px}.result-actions>*{flex:1}.result-links{display:flex;justify-content:center;gap:20px;margin-top:12px}.toast{position:fixed;left:50%;bottom:25px;z-index:100;transform:translate(-50%,20px);opacity:0;pointer-events:none;background:#17231e;color:#fff;padding:10px 16px;border-radius:999px;font-size:12px;transition:.25s;max-width:calc(100% - 32px);text-align:center}.toast.visible{opacity:1;transform:translate(-50%,0)}
@media(max-width:900px){.workspace{grid-template-columns:1fr}.preview-panel{position:static;max-width:540px;margin:20px auto 0}.saved-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:560px){.site-header{height:60px;padding:0 15px}.site-logo{height:38px;max-width:150px}.user-chip{max-width:88px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.page-shell{padding-top:34px;padding-bottom:75px}.intro{align-items:flex-start}.intro h1{font-size:40px}.lede{font-size:13px}.year-seal{width:74px;height:74px}.year-seal strong{font-size:18px}.year-seal span{font-size:6px}.control-row{grid-template-columns:1fr;gap:0}.template-grid{gap:6px}.template-card{padding:6px}.editor-actions{position:sticky;bottom:0;z-index:20;grid-template-columns:1fr 1fr;margin:26px -16px -20px;padding:10px 16px calc(10px + env(safe-area-inset-bottom));background:rgba(249,247,240,.95);backdrop-filter:blur(12px)}.editor-actions .primary-button{grid-column:1/-1;grid-row:1}.saved-grid{grid-template-columns:1fr}.result-dialog{padding-top:32px}}
</style>

