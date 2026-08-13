<template>
  <main class="place-page">
    <div class="paper-grain" aria-hidden="true"></div>

    <header class="place-nav">
      <button class="nav-back" type="button" aria-label="返回校园探索首页" @click="goHome">
        <ArrowLeft :size="19" aria-hidden="true" />
      </button>
      <div class="brand-lockup">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 42 42" fill="none">
            <path d="M8 29C14 29 14 15 21 15S28 25 34 10" />
            <circle cx="8" cy="29" r="3" />
            <circle cx="21" cy="15" r="3" />
            <circle cx="34" cy="10" r="3" />
          </svg>
        </span>
        <span>
          <b>P · L · A · C · E</b>
          <small>Personal Lifestyle Atlas for Campus Exploration</small>
        </span>
      </div>
      <div v-if="stage !== 'intro' && stage !== 'result'" class="nav-progress" aria-live="polite">
        <div><span>FIELD LOG</span><b>{{ String(questionIndex + 1).padStart(2, '0') }}/{{ questions.length }}</b></div>
        <div class="progress-track"><i :style="{ width: `${progressPercent}%` }"></i></div>
      </div>
    </header>

    <section v-if="stage === 'intro'" class="intro-shell">
      <article class="intro-copy">
        <div class="intro-coordinates" aria-hidden="true">
          <span>N23°05'56.4"</span><span>E113°17'58.8"</span>
        </div>
        <h1><span>P · L · A · C · E</span></h1>
        <p class="intro-full-name">Personal Lifestyle Atlas for Campus Exploration</p>
        <p class="intro-lead">找到你在校园里的行动方式：怎么推进事情、怎么和人连接，又会被什么吸引。</p>

        <div class="intro-actions">
          <button class="primary-action" type="button" @click="startTest">
            <span>开始测试</span>
            <ArrowUpRight :size="19" aria-hidden="true" />
          </button>
          <p class="intro-duration">约 3 分钟</p>
        </div>
        <div class="route-line" aria-hidden="true"><i></i><i></i><i></i></div>
      </article>

      <aside class="specimen-card" aria-label="结果卡示意">
        <div class="specimen-topline"><span>TYPE PREVIEW</span><span>PLACE / 01</span></div>
        <div class="specimen-map" aria-hidden="true"><i></i><i></i><i></i></div>
        <div class="specimen-visual" aria-hidden="true">
          <img :src="growVisual" alt="">
          <img :src="wikiVisual" alt="">
        </div>
        <div class="specimen-code">GROW</div>
        <div class="specimen-cn">长期积累型</div>
        <p>这条技能树不急着满级，<br>但会一直点下去。</p>
        <div class="specimen-subtype">
          <small>EXPLORATION STYLE</small>
          <b>WIKI · 维基百科型</b>
          <span>一栋楼叫什么、以前做什么，会直接决定它在你眼里的清晰度。</span>
        </div>
        <div class="specimen-seal"><span></span>LIVE SAMPLE</div>
      </aside>
    </section>

    <section v-else-if="stage === 'questions'" class="question-shell">
      <div class="question-panel">
        <aside class="question-meta">
          <p class="panel-label">FIELD LOG / 2026</p>
          <div class="question-count"><strong>{{ String(questionIndex + 1).padStart(2, '0') }}</strong><span>/ {{ questions.length }}</span></div>
          <p>沿着第一反应作答，我们会逐步定位你的校园人格坐标。</p>
          <div class="question-route" aria-hidden="true"><i :style="{ width: `${progressPercent}%` }"></i><b></b></div>
          <small>SOUTH CAMPUS · FIELD STATION 01</small>
        </aside>

        <article class="question-card" :key="currentQuestion.id">
          <div class="question-card-head">
            <p class="question-number">Q{{ String(currentQuestion.id).padStart(2, '0') }}</p>
            <span>选择最接近第一反应的一项</span>
          </div>
          <h2 ref="questionHeading" tabindex="-1" aria-live="polite">{{ currentQuestion.prompt }}</h2>

          <div class="answer-list" role="group" :aria-label="currentQuestion.prompt">
            <button
              v-for="(item, index) in currentQuestion.options"
              :key="item.label"
              class="answer-option"
              :class="{ selected: answers[questionIndex] === index }"
              type="button"
              :aria-pressed="answers[questionIndex] === index"
              @click="selectAnswer(index)"
            >
              <span class="answer-letter">{{ String.fromCharCode(65 + index) }}</span>
              <span>{{ item.label }}</span>
              <ArrowUpRight :size="18" aria-hidden="true" />
            </button>
          </div>
        </article>
      </div>

      <div class="question-footer">
        <button v-if="questionIndex > 0" type="button" class="text-action" @click="previousStep"><ArrowLeft :size="16" aria-hidden="true" />上一题</button>
        <span>凭第一反应选就好，不用寻找“正确答案”。</span>
      </div>
    </section>

    <section v-else-if="stage === 'result' && result" class="result-shell">
      <div class="result-heading">
        <p class="eyebrow">YOUR PLACE TYPE · SOUTH CAMPUS EDITION</p>
        <div><h2>你的校园人格坐标已生成</h2><span>SPECIMEN / {{ result.mainCode }}-{{ result.subCode }}</span></div>
      </div>

      <div class="result-grid">
        <article
          class="type-profile"
          :class="resultVisual ? [
            'has-type-visual',
            `main-visual-${resultVisual.mainCode.toLowerCase()}`,
            `sub-visual-${resultVisual.subCode.toLowerCase()}`
          ] : null"
        >
          <div v-if="resultVisual" class="result-type-visual" aria-hidden="true">
            <img class="result-type-visual-main" :src="resultVisual.main" alt="">
            <img class="result-type-visual-sub" :src="resultVisual.sub" alt="">
          </div>
          <p class="panel-label">YOUR CAMPUS TYPE</p>
          <p class="result-kicker"><span></span>PERSONALITY COORDINATE</p>
          <div class="type-code-lockup">
            <strong>{{ result.main.displayCode || result.mainCode }}</strong>
            <span>/</span>
            <b>{{ result.subCode }}</b>
          </div>
          <h1>{{ result.main.name }}<i>·</i><span>{{ result.sub.name }}</span></h1>
          <blockquote>{{ result.main.hook }}</blockquote>
          <p class="result-intro">{{ result.main.intro }}</p>
          <div class="subtype-note">
            <small>探索偏好 · {{ result.subCode }}</small>
            <p>{{ result.sub.note }}</p>
          </div>
        </article>

      </div>

      <aside class="result-sidebar">
        <section v-if="result.badges.length" class="badge-section">
          <div>
            <p class="panel-label">SIDE BADGES</p>
            <h3>沿途点亮的校园徽章</h3>
            <p>这些小坐标记录了你的日常行动偏好。</p>
          </div>
          <div class="badge-list">
            <article v-for="badge in result.badges" :key="badge.name" class="badge-item">
              <img :src="badge.icon" alt="" aria-hidden="true">
              <span>{{ badge.name }}</span>
            </article>
          </div>
        </section>

        <section class="share-section">
          <div>
            <p class="panel-label">SHARE YOUR SPECIMEN</p>
            <h3>把你的校园人格样本收进相册</h3>
            <p>分享卡仅展示你的类型组合与校园徽章。</p>
          </div>
          <button ref="shareTrigger" class="primary-action compact-action" type="button" @click="openShareCard">
            <span>生成校园卡片</span><ArrowUpRight :size="18" aria-hidden="true" />
          </button>
        </section>
      </aside>

      <div class="result-actions">
        <button class="secondary-action" type="button" @click="restart"><RotateCcw :size="16" aria-hidden="true" />再测一次</button>
        <button class="secondary-action" type="button" @click="goHome"><Home :size="16" aria-hidden="true" />返回校园探索</button>
      </div>
      <p class="result-save-status" role="status" aria-live="polite">{{ resultSaveCopy }}</p>
    </section>

    <div v-if="shareCardVisible" class="share-modal" role="dialog" aria-modal="true" aria-label="分享卡预览" @click.self="closeShareCard">
      <div ref="shareDialog" class="share-dialog">
        <div class="share-dialog-head">
          <div><small>PLACE / EXPORT</small><b>校园样本卡已经生成</b></div>
          <button ref="shareClose" type="button" @click="closeShareCard" aria-label="关闭"><X :size="19" aria-hidden="true" /></button>
        </div>
        <div class="share-image-wrap">
          <div v-if="!shareImage" class="share-loading">正在排版…</div>
          <img v-else :src="shareImage" alt="PLACE 测试分享卡">
        </div>
        <p class="share-tip">手机端可以长按图片保存。</p>
        <div class="share-buttons">
          <button type="button" class="secondary-action" @click="downloadShareCard"><Download :size="16" aria-hidden="true" />保存图片</button>
          <button v-if="canNativeShare" type="button" class="primary-action compact-action" @click="nativeShare">
            <span>分享</span><Share2 :size="17" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>

    <footer class="place-footer">
      <span>P · L · A · C · E</span>
      <span>笃行校园探索 · 南校园首发版</span>
    </footer>
  </main>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, ArrowUpRight, Download, Home, RotateCcw, Share2, X } from '@lucide/vue'
import QRCode from 'qrcode'
import { request } from '@/utils/request'
import {
  clearAnonymousPersonality,
  currentAccountId,
  discardLegacyPersonality,
  saveAccountPersonality,
  saveAnonymousPersonality
} from '@/utils/personalityStorage'
import doneVisual from '../assets/place/main/done.webp'
import ddlVisual from '../assets/place/main/ddl.webp'
import growVisual from '../assets/place/main/grow.webp'
import hostVisual from '../assets/place/main/host.webp'
import pingVisual from '../assets/place/main/ping.webp'
import sideVisual from '../assets/place/main/side.webp'
import syncVisual from '../assets/place/main/sync.webp'
import tryVisual from '../assets/place/main/try.webp'
import baseVisual from '../assets/place/subtypes/base.webp'
import lensVisual from '../assets/place/subtypes/lens.webp'
import mapsVisual from '../assets/place/subtypes/maps.webp'
import runVisual from '../assets/place/subtypes/run.webp'
import treeVisual from '../assets/place/subtypes/tree.webp'
import wikiVisual from '../assets/place/subtypes/wiki.webp'
import aiVerifierBadge from '../assets/place/badges/ai-verifier.webp'
import ddlIgniterBadge from '../assets/place/badges/ddl-igniter.webp'
import detourBadge from '../assets/place/badges/detour.webp'
import fixedSeatBadge from '../assets/place/badges/fixed-seat.webp'
import groupStarterBadge from '../assets/place/badges/group-starter.webp'
import mealCallerBadge from '../assets/place/badges/meal-caller.webp'
import photoKeeperBadge from '../assets/place/badges/photo-keeper.webp'
import {
  SIGNALS,
  badgeDefs,
  mainTypes,
  questions,
  signalWeights,
  subTypes
} from '@/data/placeTest'

const router = useRouter()
const stage = ref('intro')
const questionIndex = ref(0)
const answers = ref(Array(questions.length).fill(null))
const result = ref(null)
const advancing = ref(false)
const shareCardVisible = ref(false)
const shareImage = ref('')
const resultSaveState = ref('idle')
const shareDialog = ref(null)
const shareClose = ref(null)
const shareTrigger = ref(null)
const questionHeading = ref(null)

const mainVisuals = {
  GROW: growVisual,
  SIDE: sideVisual,
  DONE: doneVisual,
  DDL: ddlVisual,
  HOST: hostVisual,
  SYNC: syncVisual,
  TRY: tryVisual,
  PING: pingVisual
}

const subtypeVisuals = {
  STAY: treeVisual,
  MAPS: mapsVisual,
  RUN: runVisual,
  LENS: lensVisual,
  WIKI: wikiVisual,
  BASE: baseVisual
}

const badgeVisuals = {
  ddlIgniter: ddlIgniterBadge,
  groupStarter: groupStarterBadge,
  fixedSeat: fixedSeatBadge,
  mealCaller: mealCallerBadge,
  aiVerifier: aiVerifierBadge,
  detour: detourBadge,
  photoKeeper: photoKeeperBadge
}

const currentQuestion = computed(() => questions[questionIndex.value])
const canNativeShare = computed(() => typeof navigator !== 'undefined' && typeof navigator.share === 'function')
const resultVisual = computed(() => {
  const mainCode = result.value?.mainCode
  const subCode = result.value?.subCode
  if (!mainCode || !subCode || !mainVisuals[mainCode] || !subtypeVisuals[subCode]) return null
  return {
    main: mainVisuals[mainCode],
    sub: subtypeVisuals[subCode],
    mainCode,
    subCode
  }
})
const progressPercent = computed(() => {
  if (stage.value === 'questions') return ((questionIndex.value + 1) / questions.length) * 100
  return 0
})
const resultSaveCopy = computed(() => ({
  idle: '测试完成后，结果会同步到个人主页。',
  saving: '正在同步到个人主页…',
  saved: 'PLACE 结果已同步到个人主页。',
  local: '结果已保存在本机，登录后会同步到个人主页。',
  error: '结果已保存在本机，进入个人主页后可重新同步。'
}[resultSaveState.value] || ''))

onMounted(() => {
  document.title = 'PLACE｜你的校园类型'
  window.scrollTo({ top: 0, left: 0 })
  window.addEventListener('keydown', handleDialogKeydown)
})

onBeforeUnmount(() => {
  document.body.classList.remove('dialog-open')
  window.removeEventListener('keydown', handleDialogKeydown)
})

function scrollTop() {
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
}

function startTest() {
  stage.value = 'questions'
  questionIndex.value = 0
  nextTick(() => {
    scrollTop()
    questionHeading.value?.focus({ preventScroll: true })
  })
}

function selectAnswer(index) {
  if (advancing.value) return
  answers.value[questionIndex.value] = index
  advancing.value = true
  window.setTimeout(() => {
    if (questionIndex.value < questions.length - 1) {
      questionIndex.value += 1
      nextTick(() => questionHeading.value?.focus({ preventScroll: true }))
    } else {
      buildResult()
    }
    advancing.value = false
    scrollTop()
  }, 170)
}

function previousStep() {
  if (stage.value === 'questions') {
    if (questionIndex.value === 0) stage.value = 'intro'
    else {
      questionIndex.value -= 1
      nextTick(() => questionHeading.value?.focus({ preventScroll: true }))
    }
  }
  scrollTop()
}

function normalizedSignals() {
  const actual = Object.fromEntries(SIGNALS.map(signal => [signal, 0]))
  questions.forEach((question, index) => {
    const choice = question.options[answers.value[index]]
    if (!choice) return
    Object.entries(choice.scores || {}).forEach(([signal, value]) => {
      actual[signal] = (actual[signal] || 0) + value
    })
  })

  const rawValues = SIGNALS.map(signal => {
    const minimum = questions.reduce((sum, question) => sum + Math.min(...question.options.map(item => item.scores?.[signal] || 0)), 0)
    const maximum = questions.reduce((sum, question) => sum + Math.max(...question.options.map(item => item.scores?.[signal] || 0)), 0)
    if (maximum === minimum) return 50
    return ((actual[signal] - minimum) / (maximum - minimum)) * 100
  })

  // 以四个选项等概率时的题库分布为中线，避免某些信号因题目数量不同而天然偏高。
  const baselineMean = [37.89, 34.84, 31.28, 29.71, 28.70, 37.08, 34.22, 28.18, 27.34, 32.96]
  const baselineDeviation = [10.72, 9.39, 10.90, 12.27, 10.52, 11.13, 13.21, 9.37, 10.22, 10.92]
  return rawValues.map((value, index) => {
    const calibrated = 50 + ((value - baselineMean[index]) / baselineDeviation[index]) * 15
    return Math.round(Math.max(0, Math.min(100, calibrated)))
  })
}

function chooseMainType(values) {
  return Object.entries(mainTypes)
    .map(([code, type]) => {
      const distance = values.reduce((sum, value, index) => sum + Math.abs(value - type.vector[index]) * signalWeights[index], 0)
      return { code, type, distance }
    })
    .sort((a, b) => a.distance - b.distance)[0]
}

function chooseSubType() {
  const counts = Object.fromEntries(Object.keys(subTypes).map(code => [code, 0]))
  const exposure = Object.fromEntries(Object.keys(subTypes).map(code => [code, 0]))
  questions.forEach(question => {
    question.options.forEach(option => {
      if (option.sub in exposure) exposure[option.sub] += 1
    })
  })
  questions.forEach((question, index) => {
    const code = question.options[answers.value[index]]?.sub
    if (code && code in counts) counts[code] += 1
  })
  // 各副类型在题库中的出现次数并不完全相同，按随机选择时的期望值校准。
  return Object.keys(counts)
    .map(code => ({ code, score: counts[code] / (exposure[code] / 4), raw: counts[code] }))
    .sort((a, b) => b.score - a.score || b.raw - a.raw)[0].code
}

function chooseBadges(mainCode) {
  const counts = Object.fromEntries(Object.keys(badgeDefs).map(code => [code, 0]))
  questions.forEach((question, index) => {
    const badges = question.options[answers.value[index]]?.badges || []
    badges.forEach(code => { if (code in counts) counts[code] += 1 })
  })
  let candidates = Object.entries(counts)
    .filter(([, count]) => count >= 2)
    .map(([code, count]) => ({ code, count, icon: badgeVisuals[code], ...badgeDefs[code] }))
    .sort((a, b) => b.count - a.count)

  if (mainCode === 'DDL') candidates = candidates.filter(item => item.code !== 'ddlIgniter')
  const selected = []
  const usedGroups = new Set()
  candidates.forEach(item => {
    if (selected.length >= 3) return
    if (!usedGroups.has(item.group) || selected.length >= 2) {
      selected.push(item)
      usedGroups.add(item.group)
    }
  })

  return selected
}

function buildResult() {
  const values = normalizedSignals()
  const main = chooseMainType(values)
  const subCode = chooseSubType()
  result.value = {
    mainCode: main.code,
    main: main.type,
    subCode,
    sub: subTypes[subCode],
    badges: chooseBadges(main.code)
  }
  stage.value = 'result'
  persistPersonality(result.value)
  nextTick(scrollTop)
}

function personalityPayload(card) {
  return {
    mainCode: card.mainCode,
    subCode: card.subCode,
    badges: card.badges.map(item => item.code),
    completedAt: Date.now()
  }
}

async function persistPersonality(card) {
  const payload = personalityPayload(card)
  discardLegacyPersonality()

  if (!localStorage.getItem('token')) {
    saveAnonymousPersonality(payload)
    resultSaveState.value = 'local'
    return
  }

  const accountId = currentAccountId()
  if (accountId) saveAccountPersonality(accountId, payload)
  resultSaveState.value = 'saving'
  const response = await request('/user/personality', 'PUT', payload)
  if (response.ok && response.data?.code === 0) {
    resultSaveState.value = 'saved'
    if (accountId) saveAccountPersonality(accountId, response.data.data.personality)
    clearAnonymousPersonality()
    return
  }
  resultSaveState.value = 'error'
}

function restart() {
  answers.value = Array(questions.length).fill(null)
  result.value = null
  resultSaveState.value = 'idle'
  questionIndex.value = 0
  stage.value = 'intro'
  scrollTop()
}

function goHome() {
  router.push('/')
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const chars = Array.from(text)
  const lines = []
  let current = ''
  chars.forEach(char => {
    const next = current + char
    if (ctx.measureText(next).width > maxWidth && current) {
      if ('，。！？；：、'.includes(char)) {
        lines.push(next)
        current = ''
      } else {
        lines.push(current)
        current = char
      }
    } else current = next
  })
  if (current) lines.push(current)
  lines.slice(0, maxLines).forEach((line, index) => ctx.fillText(line, x, y + lineHeight * index))
  return y + lineHeight * Math.min(lines.length, maxLines)
}

function loadCanvasImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

async function makeShareCard() {
  if (!result.value) return ''
  const card = result.value
  const canvas = document.createElement('canvas')
  canvas.width = 900
  canvas.height = 1200
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  ctx.fillStyle = '#F3F7F5'
  ctx.fillRect(0, 0, 900, 1200)
  ctx.strokeStyle = 'rgba(10, 46, 59, .055)'
  ctx.lineWidth = 1
  for (let x = 0; x <= 900; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1200); ctx.stroke() }
  for (let y = 0; y <= 1200; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(900, y); ctx.stroke() }
  ctx.fillStyle = '#0A2E3B'
  ctx.beginPath(); ctx.arc(790, 70, 210, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = 'rgba(199, 242, 74, .25)'
  ctx.beginPath(); ctx.arc(790, 70, 150, 0, Math.PI * 2); ctx.stroke()
  ctx.fillStyle = '#C7F24A'
  ctx.beginPath(); ctx.arc(36, 1120, 180, 0, Math.PI * 2); ctx.fill()

  if (resultVisual.value) {
    try {
      const [mainImage, subImage] = await Promise.all([
        loadCanvasImage(resultVisual.value.main),
        loadCanvasImage(resultVisual.value.sub)
      ])
      ctx.drawImage(mainImage, 638, 104, 226, 226)
      ctx.drawImage(subImage, 574, 108, 270, 270)
    } catch (error) {
      console.warn('Result artwork render failed', error)
    }
  }

  ctx.fillStyle = '#0A2E3B'
  roundedRect(ctx, 64, 58, 52, 52, 14); ctx.fill()
  ctx.fillStyle = '#C7F24A'
  ctx.font = '800 28px "Avenir Next", Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('P', 90, 94)
  ctx.textAlign = 'left'
  ctx.fillStyle = '#0A2E3B'
  ctx.font = '800 25px "Avenir Next", Arial, sans-serif'
  ctx.fillText('P · L · A · C · E', 136, 82)
  ctx.fillStyle = '#5E7271'
  ctx.font = '700 13px Menlo, monospace'
  ctx.fillText('CAMPUS PERSONALITY FIELD CONSOLE · SOUTH CAMPUS', 136, 106)

  const mainDisplayCode = card.main.displayCode || card.mainCode
  ctx.fillStyle = '#0A2E3B'
  ctx.font = '800 124px "Avenir Next", Arial, sans-serif'
  ctx.fillText(mainDisplayCode, 62, 272)
  const mainCodeWidth = ctx.measureText(mainDisplayCode).width
  const subCodeX = Math.min(62 + mainCodeWidth + 24, 500)
  ctx.fillStyle = '#AFC4BE'
  ctx.font = '500 42px "Avenir Next", Arial, sans-serif'
  ctx.fillText('/', subCodeX, 258)
  ctx.fillStyle = '#0D9488'
  ctx.font = '800 44px "Avenir Next", Arial, sans-serif'
  ctx.fillText(card.subCode, subCodeX + 30, 258)
  ctx.fillStyle = '#102A2E'
  ctx.font = '600 36px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText(`${card.main.name} · ${card.sub.name}`, 68, 332)
  ctx.fillStyle = '#5E7271'
  ctx.font = '500 27px "PingFang SC", "Microsoft YaHei", sans-serif'
  const hookBottom = drawWrappedText(ctx, card.main.hook, 68, 384, 730, 40, 2)

  const subtypeY = hookBottom + 8
  ctx.fillStyle = '#08766D'
  ctx.font = '600 14px Arial, sans-serif'
  ctx.fillText(`${card.subCode} · EXPLORATION PREFERENCE`, 68, subtypeY)
  ctx.fillStyle = '#5E7271'
  ctx.font = '500 23px "PingFang SC", "Microsoft YaHei", sans-serif'
  const subtypeBottom = drawWrappedText(ctx, card.sub.note, 68, subtypeY + 34, 730, 32, 2)

  const profileY = subtypeBottom + 24
  ctx.fillStyle = '#0A2E3B'
  roundedRect(ctx, 64, profileY, 772, 230, 30); ctx.fill()
  ctx.fillStyle = '#C7F24A'
  ctx.font = '700 15px Menlo, monospace'
  ctx.fillText('TYPE PROFILE', 102, profileY + 50)
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '500 28px "PingFang SC", "Microsoft YaHei", sans-serif'
  drawWrappedText(ctx, card.main.intro, 102, profileY + 104, 690, 42, 3)

  const shareBadges = card.badges.slice(0, 2)
  const badgeImages = await Promise.all(shareBadges.map(async badge => {
    try {
      return await loadCanvasImage(badge.icon)
    } catch (error) {
      console.warn('Badge artwork render failed', error)
      return null
    }
  }))
  const badgeY = profileY + 280
  ctx.fillStyle = '#08766D'
  ctx.font = '700 13px Menlo, monospace'
  ctx.fillText('SIDE BADGES', 66, badgeY - 16)
  shareBadges.forEach((badge, index) => {
    const badgeX = 66 + index * 198
    ctx.fillStyle = '#FFFFFF'
    roundedRect(ctx, badgeX, badgeY, 184, 144, 20); ctx.fill()
    if (badgeImages[index]) ctx.drawImage(badgeImages[index], badgeX + 40, badgeY + 2, 104, 104)
    ctx.fillStyle = '#102A2E'
    ctx.font = '500 14px "PingFang SC", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(badge.name, badgeX + 92, badgeY + 132)
  })
  ctx.textAlign = 'left'

  try {
    const shareUrl = window.location.href.split('?')[0]
    const qrDataUrl = await QRCode.toDataURL(shareUrl, {
      width: 132,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0A2E3B', light: '#FFFFFF' }
    })
    const qrImage = await new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = reject
      image.src = qrDataUrl
    })
    ctx.fillStyle = '#FFFFFF'
    roundedRect(ctx, 690, 1004, 146, 146, 14); ctx.fill()
    ctx.drawImage(qrImage, 697, 1011, 132, 132)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#5E7271'
    ctx.font = '500 14px "PingFang SC", sans-serif'
    ctx.fillText('扫码测测你的校园类型', 836, 1166)
    ctx.textAlign = 'left'
  } catch (error) {
    console.warn('QR code render failed', error)
  }

  ctx.fillStyle = '#0A2E3B'
  ctx.font = '800 18px "Avenir Next", Arial, sans-serif'
  ctx.fillText('P · L · A · C · E · 笃行校园探索', 66, 1166)

  return canvas.toDataURL('image/png')
}

async function openShareCard() {
  shareCardVisible.value = true
  shareImage.value = ''
  document.body.classList.add('dialog-open')
  try {
    await nextTick()
    shareClose.value?.focus()
    const image = await makeShareCard()
    if (!image) throw new Error('Share card rendering is unavailable')
    shareImage.value = image
  } catch (error) {
    console.error('Share card generation failed', error)
    closeShareCard()
  }
}

function closeShareCard() {
  shareCardVisible.value = false
  shareImage.value = ''
  document.body.classList.remove('dialog-open')
  nextTick(() => shareTrigger.value?.focus())
}

function handleDialogKeydown(event) {
  if (!shareCardVisible.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    closeShareCard()
    return
  }
  if (event.key !== 'Tab') return
  const focusable = [...(shareDialog.value?.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') || [])]
  if (!focusable.length) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (!shareDialog.value?.contains(document.activeElement)) {
    event.preventDefault()
    first.focus()
    return
  }
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function downloadShareCard() {
  if (!shareImage.value) return
  const link = document.createElement('a')
  link.href = shareImage.value
  link.download = `PLACE-${result.value.mainCode}-${result.value.subCode}.png`
  link.click()
}

async function nativeShare() {
  if (!shareImage.value || !navigator.share) return
  try {
    const blob = await (await fetch(shareImage.value)).blob()
    const file = new File([blob], 'place-campus-type.png', { type: 'image/png' })
    await navigator.share({ title: '我的 PLACE 校园类型', text: result.value.main.hook, files: [file] })
  } catch (error) {
    if (error?.name !== 'AbortError') downloadShareCard()
  }
}
</script>

<style scoped>
.place-page {
  --ink: #0a2e3b;
  --primary: #0d9488;
  --primary-dark: #08766d;
  --accent: #c7f24a;
  --canvas: #f3f7f5;
  --surface: #ffffff;
  --text: #102a2e;
  --muted: #5e7271;
  --border: #d6e4df;
  --danger: #c2413a;
  --display: "DIN Alternate", "Avenir Next", "Noto Sans SC", "PingFang SC", sans-serif;
  --technical: "SFMono-Regular", Menlo, Consolas, monospace;
  position: relative;
  min-height: 100vh;
  overflow-x: clip;
  background: var(--canvas);
  color: var(--text);
  font-family: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
}

.paper-grain {
  position: fixed;
  inset: 0;
  pointer-events: none;
  opacity: .58;
  background-image:
    linear-gradient(rgba(10, 46, 59, .045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(10, 46, 59, .045) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: linear-gradient(to bottom, #000 0%, rgba(0,0,0,.8) 64%, transparent 100%);
}

.place-nav {
  position: relative;
  z-index: 20;
  width: min(1240px, calc(100% - 48px));
  min-height: 78px;
  margin: 14px auto 0;
  padding: 0 18px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(180px, 320px);
  align-items: center;
  gap: 14px;
  border: 1px solid rgba(214, 228, 223, .86);
  border-radius: 20px;
  background: rgba(243, 247, 245, .88);
  backdrop-filter: blur(16px);
}

.nav-back {
  width: 44px;
  min-height: 44px;
  display: grid;
  place-items: center;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 50%;
  transition: transform .2s ease, border-color .2s ease, background .2s ease;
}
.nav-back:hover { transform: translateX(-2px); border-color: var(--primary); background: #eef7f4; }

.brand-lockup {
  justify-self: start;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
}
.brand-lockup > span:last-child { min-width: 0; }

.brand-mark {
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 14px 5px 14px 5px;
  background: var(--ink);
  box-shadow: inset 0 0 0 1px rgba(199,242,74,.12);
}
.brand-mark svg { width: 32px; height: 32px; overflow: visible; }
.brand-mark path { stroke: var(--accent); stroke-width: 2; stroke-linecap: round; }
.brand-mark circle { fill: var(--ink); stroke: var(--accent); stroke-width: 2; }
.brand-mark circle:nth-of-type(2) { fill: var(--accent); }

.brand-lockup b,
.brand-lockup small { display: block; }
.brand-lockup b { font: 800 14px/1.1 var(--display); letter-spacing: -.01em; }
.brand-lockup small { margin-top: 4px; overflow: hidden; color: var(--muted); font: 700 9px/1.2 var(--technical); text-overflow: ellipsis; }

.nav-progress { display: grid; gap: 7px; color: var(--muted); font: 700 10px/1 var(--technical); }
.nav-progress > div:first-child { display: flex; justify-content: space-between; }
.nav-progress b { color: var(--ink); }
.progress-track { height: 5px; overflow: hidden; border-radius: 999px; background: var(--border); }
.progress-track i { display: block; height: 100%; border-radius: inherit; background: var(--accent); transform-origin: left center; transition: width .32s cubic-bezier(.16,1,.3,1); }
.intro-shell {
  position: relative;
  z-index: 1;
  width: min(1240px, calc(100% - 48px));
  min-height: calc(100vh - 116px);
  margin: 0 auto;
  padding: 40px 0 72px;
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 16px;
  align-items: stretch;
}

.eyebrow,
.panel-label {
  margin: 0;
  color: var(--primary-dark);
  font: 800 10px/1.2 var(--technical);
  letter-spacing: .04em;
  text-transform: uppercase;
}

.intro-copy {
  position: relative;
  grid-column: span 7;
  min-height: 610px;
  padding: clamp(32px, 4.5vw, 64px);
  overflow: hidden;
  border-radius: 34px 10px 34px 10px;
  color: #fff;
  background-color: var(--ink);
  background-image:
    linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px);
  background-size: 44px 44px;
  animation: cardIn .46s cubic-bezier(.16,1,.3,1) both;
}
.intro-copy::after { content: ''; position: absolute; right: -120px; bottom: -160px; width: 430px; height: 430px; border: 1px solid rgba(199,242,74,.26); border-radius: 50%; box-shadow: 0 0 0 54px rgba(199,242,74,.035), 0 0 0 108px rgba(199,242,74,.025); pointer-events: none; }
.intro-coordinates { position: absolute; top: 28px; right: 30px; display: grid; gap: 5px; color: rgba(255,255,255,.5); font: 700 9px/1 var(--technical); text-align: right; }
.intro-copy h1 {
  margin: 44px 0 14px;
  font: 800 clamp(64px, 8vw, 112px)/.82 var(--display);
  letter-spacing: -.075em;
}
.intro-copy h1 span { display: block; }
.intro-full-name { margin: 0; color: var(--accent); font: 800 11px/1.35 var(--technical); letter-spacing: .035em; }
.intro-lead { max-width: 620px; margin: 28px 0 0; color: rgba(255,255,255,.86); font-size: clamp(18px, 2vw, 25px); font-weight: 650; line-height: 1.55; letter-spacing: -.02em; }
.intro-actions { position: relative; z-index: 2; margin-top: 46px; display: flex; align-items: center; gap: 24px; }
.intro-duration { margin: 0; color: rgba(255,255,255,.68); font: 700 12px/1 var(--technical); letter-spacing: .04em; }
.route-line { position: absolute; left: 64px; right: 64px; bottom: 30px; height: 1px; background: rgba(255,255,255,.17); }
.route-line i { position: absolute; top: 50%; width: 10px; height: 10px; border: 2px solid var(--ink); border-radius: 50%; background: var(--accent); transform: translate(-50%,-50%); box-shadow: 0 0 0 1px rgba(199,242,74,.5); }
.route-line i:nth-child(1) { left: 0; }.route-line i:nth-child(2) { left: 48%; }.route-line i:nth-child(3) { left: 100%; }

.primary-action {
  min-width: 182px;
  min-height: 54px;
  padding: 0 18px 0 22px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  color: var(--ink);
  background: var(--accent);
  transition: transform .24s cubic-bezier(.16,1,.3,1), filter .24s ease;
}
.primary-action:hover { transform: translateY(-2px); filter: brightness(1.04); }
.primary-action:active { transform: scale(.99); }
.primary-action span { font-size: 16px; font-weight: 600; }

.specimen-card {
  position: relative;
  grid-column: span 5;
  min-height: 610px;
  padding: 32px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 10px 34px 10px 34px;
  color: var(--text);
  background: rgba(255,255,255,.86);
  animation: cardIn .46s .08s cubic-bezier(.16,1,.3,1) both;
}
.specimen-topline { position: relative; z-index: 3; display: flex; justify-content: space-between; color: var(--primary-dark); font: 800 10px/1 var(--technical); }
.specimen-map { position: absolute; inset: 0; opacity: .42; background-image: linear-gradient(rgba(13,148,136,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(13,148,136,.08) 1px, transparent 1px); background-size: 32px 32px; }
.specimen-map::after { content:''; position:absolute; right:-70px; top:54px; width:230px; height:230px; border:1px solid rgba(13,148,136,.28); border-radius:50%; box-shadow:0 0 0 38px rgba(13,148,136,.045),0 0 0 76px rgba(13,148,136,.03); }
.specimen-map i { position:absolute; width:8px; height:8px; border-radius:50%; background:var(--accent); box-shadow:0 0 0 4px var(--ink); }
.specimen-map i:nth-child(1){right:77px;top:110px}.specimen-map i:nth-child(2){right:152px;top:182px}.specimen-map i:nth-child(3){right:92px;top:265px}
.specimen-visual { position: absolute; z-index: 1; right: -18px; top: 92px; width: 58%; height: 330px; pointer-events: none; }
.specimen-visual img { position: absolute; right: 0; width: 100%; height: 100%; object-fit: contain; }
.specimen-visual img:first-child { opacity: .32; transform: translate(6%,-4%) scale(.92); }
.specimen-visual img:last-child { filter: drop-shadow(0 14px 18px rgba(10,46,59,.16)); }
.specimen-code { position: relative; z-index: 2; margin-top: 88px; font: 800 clamp(64px, 7vw, 96px)/.88 var(--display); letter-spacing: -.07em; color: var(--ink); }
.specimen-cn { position: relative; z-index: 2; margin-top: 10px; font-size: 25px; font-weight: 800; }
.specimen-card > p { position: relative; z-index: 2; max-width: 250px; margin: 24px 0; color: var(--muted); font-size: 15px; line-height: 1.7; }
.specimen-subtype { position: absolute; z-index: 3; left: 30px; right: 30px; bottom: 30px; padding: 21px; border: 1px solid var(--border); border-radius: 20px 6px 20px 6px; color: var(--text); background: rgba(243,247,245,.94); }
.specimen-subtype small, .specimen-subtype b, .specimen-subtype span { display: block; }
.specimen-subtype small { color: var(--primary-dark); font: 800 9px/1 var(--technical); }
.specimen-subtype b { margin-top: 10px; font-size: 18px; }
.specimen-subtype span { margin-top: 7px; color: var(--muted); font-size: 12px; line-height: 1.55; }
.specimen-seal { position: absolute; z-index:3; right: 24px; top: 64px; padding:7px 10px; display:flex; align-items:center; gap:7px; border:1px solid var(--border); border-radius:999px; color:var(--muted); background:#fff; font:800 9px/1 var(--technical); }
.specimen-seal span { width:7px;height:7px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 2px var(--ink); }

.question-shell {
  position: relative;
  z-index: 1;
  width: min(1240px, calc(100% - 48px));
  min-height: calc(100vh - 94px);
  margin: 0 auto;
  padding: 40px 0 72px;
}
.question-panel {
  display: grid;
  grid-template-columns: repeat(12,minmax(0,1fr));
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 30px 9px 30px 9px;
  background: rgba(255,255,255,.9);
  box-shadow: 0 18px 48px rgba(10,46,59,.08);
  animation: cardIn .36s cubic-bezier(.16,1,.3,1) both;
}
.question-meta { grid-column: span 4; min-height: 540px; padding: 30px; color: #fff; background: var(--ink); }
.question-count { margin-top: 48px; display:flex; align-items:baseline; gap:8px; }
.question-count strong { color:var(--accent); font:800 clamp(72px,8vw,118px)/.8 var(--display); letter-spacing:-.07em; }
.question-count span { color:rgba(255,255,255,.5);font:700 15px/1 var(--technical); }
.question-meta > p:not(.panel-label) { margin:24px 0 0;max-width:280px;color:rgba(255,255,255,.67);font-size:13px;line-height:1.7; }
.question-route { position:relative;height:5px;margin-top:38px;border-radius:999px;background:rgba(255,255,255,.15); }
.question-route i { display:block;height:100%;border-radius:inherit;background:var(--accent);transition:width .32s cubic-bezier(.16,1,.3,1); }
.question-route b { position:absolute;right:0;top:50%;width:12px;height:12px;border:3px solid var(--ink);border-radius:50%;background:var(--accent);transform:translate(50%,-50%);box-shadow:0 0 0 1px var(--accent); }
.question-meta > small { display:block;margin-top:18px;color:rgba(255,255,255,.42);font:700 9px/1.4 var(--technical); }
.question-meta .panel-label { color:var(--accent); }
.question-card { grid-column: span 8; min-height:540px;padding:clamp(28px,4vw,50px);border-left:1px solid var(--border);background:rgba(255,255,255,.9); }
@keyframes cardIn { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
.question-card-head { display:flex;align-items:center;justify-content:space-between;gap:16px; }
.question-card-head > span { color:var(--muted);font-size:11px; }
.question-number { margin: 0; color: var(--primary-dark); font: 800 11px/1 var(--technical); }
.question-card h2 { max-width: 760px; margin: 38px 0 34px; font-size: clamp(28px, 3.7vw, 46px); line-height: 1.25; letter-spacing: -.035em; }
.question-card h2:focus { outline: none; }
.answer-list { display: grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap: 12px; }
.answer-option {
  width: 100%;
  min-height: 112px;
  padding: 18px;
  display: grid;
  grid-template-columns: 42px 1fr 22px;
  gap: 12px;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 18px 6px 18px 6px;
  color: var(--text);
  background: var(--canvas);
  text-align: left;
  transition: border-color .24s ease, background .24s ease, transform .24s cubic-bezier(.16,1,.3,1);
}
.answer-option:hover { border-color:var(--primary);transform:translateY(-2px); }
.answer-option.selected { color: #fff; border-color: var(--ink); background: var(--ink); }
.answer-letter { width: 36px; height: 36px; display: grid; place-items: center; border: 1px solid currentColor; border-radius: 50%; font: 800 12px/1 var(--technical); }
.answer-option.selected .answer-letter { color:var(--ink);border-color:var(--accent);background:var(--accent); }
.answer-option > span:nth-child(2) { font-size: 15px; font-weight:600;line-height: 1.55; }
.answer-option svg { justify-self: end; color: var(--primary-dark); }
.answer-option.selected svg { color: var(--accent); }

.question-footer { width:calc(66.666% - 6px);margin:10px 0 0 auto;padding:4px 8px;display:flex;align-items:center;justify-content:space-between;color:var(--muted);font-size:11px; }
.question-footer > span { margin-left:auto; }
.text-action { min-height:44px;display:inline-flex;align-items:center;gap:7px;color:var(--ink);font-weight:700; }

.result-shell {
  position: relative;
  z-index: 1;
  width: min(1240px, calc(100% - 48px));
  margin: 0 auto;
  padding: 40px 0 72px;
  display:grid;
  grid-template-columns:repeat(12,minmax(0,1fr));
  gap:16px;
}
.result-heading { grid-column:1 / -1;margin-bottom:8px; }
.result-heading > div { margin-top:10px;display:flex;align-items:end;justify-content:space-between;gap:20px; }
.result-heading h2 { margin:0;font-size:clamp(28px,4vw,48px);line-height:1.05;letter-spacing:-.04em; }
.result-heading span { color:var(--muted);font:700 10px/1 var(--technical); }
.result-grid { grid-column:1 / span 8;grid-row:2;display:grid; }
.type-profile { position: relative; min-height: 590px; padding: clamp(30px,4vw,52px); overflow: hidden; border-radius: 34px 10px 34px 10px; color:#fff;background-color:var(--ink);background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);background-size:44px 44px; }
.type-profile::after { content:'';position:absolute;right:-120px;bottom:-190px;width:430px;height:430px;border:1px solid rgba(199,242,74,.2);border-radius:50%;box-shadow:0 0 0 56px rgba(199,242,74,.025),0 0 0 112px rgba(199,242,74,.018); }
.result-type-visual { position: absolute; inset: 0 0 0 44%; z-index: 0; pointer-events: none; }
.result-type-visual img { position: absolute; display: block; width: auto; height: auto; object-fit: contain; }
.result-type-visual-main { right: -8%; top: -4%; max-width: 112%; max-height: 112%; opacity: .25; }
.result-type-visual-sub { right: -3%; bottom: -5%; max-width: 108%; max-height: 108%; filter: drop-shadow(0 16px 24px rgba(0,0,0,.24)); }
.main-visual-sync .result-type-visual-main,
.main-visual-try .result-type-visual-main { right: -24%; max-width: 132%; }
.main-visual-grow .result-type-visual-main,
.main-visual-side .result-type-visual-main { top: -2%; max-width: 102%; max-height: 102%; }
.main-visual-host .result-type-visual-main { right: -18%; }
.sub-visual-maps .result-type-visual-sub { right: 0; max-width: 88%; max-height: 96%; }
.sub-visual-lens .result-type-visual-sub,
.sub-visual-wiki .result-type-visual-sub { right: -2%; max-width: 96%; max-height: 96%; }
.sub-visual-stay .result-type-visual-sub { right: -8%; max-width: 108%; }
.sub-visual-base .result-type-visual-sub { right: -10%; bottom: -8%; max-width: 112%; max-height: 106%; }
.type-profile.has-type-visual > :not(.result-type-visual) { position: relative; z-index: 1; }
.type-profile.has-type-visual > :not(.result-type-visual) { max-width: 59%; }
.type-profile .panel-label { color: var(--accent); }
.result-kicker { margin: 22px 0 8px; display:flex;align-items:center;gap:9px;color: rgba(255,255,255,.52); font:700 9px/1 var(--technical); }
.result-kicker span { width:8px;height:8px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 3px rgba(199,242,74,.18); }
.type-code-lockup { display: flex; align-items: baseline; gap: 12px; white-space: nowrap; }
.type-code-lockup strong { color:#fff;font: 800 clamp(72px, 7.5vw, 108px)/.9 var(--display); letter-spacing: .015em; }
.type-code-lockup span { color: rgba(255,255,255,.22); font: 500 32px/1 var(--display); }
.type-code-lockup b { color: var(--accent); font: 800 clamp(30px, 3.4vw, 46px)/1 var(--display); letter-spacing: -.04em; }
.type-profile h1 { margin: 8px 0 16px; font-size: clamp(23px, 2.5vw, 31px); letter-spacing: -.04em; }
.type-profile.has-type-visual h1 { max-width: 84%; }
.type-profile h1 i { margin: 0 8px; color: rgba(255,255,255,.3); font-style: normal; font-weight: 400; }
.type-profile h1 span { color: var(--accent); }
.type-profile blockquote { margin: 0; padding-left: 14px; border-left: 3px solid var(--accent); font-size: 18px; font-weight: 650; line-height: 1.55; }
.result-intro { margin: 10px 0 0; color: rgba(255,255,255,.67); font-size: 12px; line-height: 1.65; }
.subtype-note { margin-top: 14px; padding: 14px 16px; border:1px solid rgba(255,255,255,.09);border-radius: 16px 5px 16px 5px; background: rgba(255,255,255,.06); }
.subtype-note small { color: var(--accent); font:800 12px/1.2 var(--technical); letter-spacing:.02em; }
.subtype-note p { margin: 9px 0 0; color: rgba(255,255,255,.7); font-size: 11px; line-height: 1.55; }
.result-sidebar { grid-column:9 / -1;grid-row:2;min-width:0;display:flex;flex-direction:column;gap:16px; }
.badge-section, .share-section { padding:28px;border-radius:10px 28px 10px 28px;display:flex;flex-direction:column;align-items:stretch;gap:22px; }
.badge-section { border:1px solid var(--border);background:rgba(255,255,255,.9); }
.badge-section h3, .share-section h3 { margin: 9px 0 0; font-size: 21px;line-height:1.3; }
.badge-section > div:first-child > p:last-child { margin:8px 0 0;color:var(--muted);font-size:11px;line-height:1.55; }
.badge-list { display: grid; gap: 8px; }
.badge-item { min-height:72px;padding:8px 12px 8px 8px;border:1px solid var(--border);border-radius:16px 5px 16px 5px;display:flex;align-items:center;gap:12px;background:var(--canvas); }
.badge-item img { width: 54px; height: 54px; flex: 0 0 auto; object-fit: contain; }
.badge-item span { color:var(--text);font-size:12px;font-weight:700; }
.share-section { color: #fff; background: var(--primary-dark); }
.share-section .panel-label { color: var(--accent); }
.share-section p:last-child { margin: 8px 0 0; color: rgba(255,255,255,.65); font-size: 11px; }
.share-section .primary-action { width:100%;min-width:0; }
.compact-action { min-width: 220px; min-height: 52px; }
.result-actions { grid-column:1 / span 8;align-self:start;display:flex;align-items:center;justify-content:flex-end;gap:8px; }
.result-save-status { grid-column:1 / span 8;min-height:1.5em;margin:0;color:var(--muted);font-size:11px;text-align:right; }
.secondary-action { min-height: 46px; padding: 0 18px; border: 1px solid var(--border); border-radius: 999px; display:inline-flex;align-items:center;justify-content:center;gap:7px;background: #fff; color:var(--ink);font-size: 12px; font-weight: 700; }

.share-modal { position: fixed; inset: 0; z-index: 13000; padding: 24px; overflow-y: auto; display: grid; align-items:start;justify-items:center; background: rgba(10,46,59,.78); backdrop-filter: blur(14px); }
.share-dialog { width: min(480px, 100%); margin:auto 0; padding: 18px; border:1px solid rgba(255,255,255,.35);border-radius: 28px 8px 28px 8px; background: var(--canvas); box-shadow: 0 30px 80px rgba(10,46,59,.28); }
.share-dialog-head { padding: 4px 4px 14px; display: flex; align-items: center; justify-content: space-between; }
.share-dialog-head small, .share-dialog-head b { display: block; }
.share-dialog-head small { color: var(--primary-dark); font: 800 9px/1 var(--technical); }
.share-dialog-head b { margin-top: 4px; font-size: 16px; }
.share-dialog-head button { width: 40px; height: 40px; display:grid;place-items:center;border-radius: 50%; background: var(--surface); }
.share-image-wrap { aspect-ratio: 3 / 4; overflow: hidden; border:1px solid var(--border);border-radius: 20px 6px 20px 6px; background: var(--surface); }
.share-image-wrap img { width: 100%; height: 100%; display: block; object-fit: cover; }
.share-loading { height: 100%; display: grid; place-items: center; color: var(--muted); }
.share-tip { margin: 12px 0 0; color: var(--muted); font-size: 11px; text-align: center; }
.share-buttons { margin-top: 14px; display: flex; justify-content: flex-end; gap: 10px; }

.place-footer { position: relative; z-index: 1; width: min(1240px, calc(100% - 48px)); margin: 0 auto; min-height: 74px; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border); color: var(--muted); font:700 9px/1 var(--technical); }

button:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; box-shadow: 0 0 0 5px var(--ink); }

@media (max-width: 1023px) {
  .place-nav,.intro-shell,.question-shell,.result-shell,.place-footer { width:min(100% - 32px,1240px); }
  .intro-copy { grid-column:span 7;padding:38px; }
  .specimen-card { grid-column:span 5;padding:26px; }
  .intro-actions { align-items:flex-start;flex-direction:column; }
  .question-meta { grid-column:span 4;padding:24px; }
  .question-card { grid-column:span 8;padding:30px; }
  .answer-list { grid-template-columns:1fr; }
  .answer-option { min-height:78px; }
  .type-profile.has-type-visual > :not(.result-type-visual) { max-width:66%; }
}

@media (max-width: 899px) {
  .intro-shell,.question-shell,.result-shell { display:block; }
  .specimen-card,.result-sidebar { margin-top:16px; }
  .question-panel { display:block; }
  .question-meta { min-height:auto; }
  .question-card { min-height:auto;border-top:1px solid var(--border);border-left:0; }
  .question-footer { margin-top:10px; }
  .result-actions { margin-top:16px; }
  .result-save-status { margin-top:10px; }
}

@media (max-width: 699px) {
  .place-nav { min-height:68px;margin-top:8px;padding:0 12px;grid-template-columns:auto minmax(0,1fr);gap:10px; }
  .brand-lockup b { font-size:11px;letter-spacing:.02em; }
  .brand-lockup small { display:block;font-size:7px;white-space:nowrap; }
  .brand-mark { width:38px;height:38px; }
  .nav-progress { display:none; }
  .intro-shell,.question-shell,.result-shell { width:calc(100% - 24px);padding:28px 0 56px;display:block; }
  .intro-shell { min-height:auto;padding-bottom:24px; }
  .intro-copy { min-height:540px;padding:28px;border-radius:26px 8px 26px 8px; }
  .intro-coordinates { top:22px;right:22px; }
  .intro-coordinates { display:none; }
  .intro-copy h1 { margin-top:46px;font-size:clamp(32px,10vw,50px);letter-spacing:-.04em; }
  .intro-lead { font-size:18px; }
  .intro-actions { margin-top:34px; }
  .intro-duration { font-size:11px; }
  .route-line { left:28px;right:28px;bottom:22px; }
  .specimen-card {
    position:absolute;
    right:14px;
    top:348px;
    bottom:auto;
    z-index:4;
    width:48%;
    min-height:202px;
    margin:0;
    padding:14px;
    border-color:rgba(199,242,74,.28);
    border-radius:5px 20px 5px 20px;
    color:#fff;
    background:rgba(8,48,60,.82);
    box-shadow:inset 0 1px rgba(255,255,255,.05),0 14px 28px rgba(2,22,29,.18);
    backdrop-filter:blur(8px);
  }
  .specimen-topline { color:var(--accent);font-size:7px; }
  .specimen-map { opacity:.34;background-image:linear-gradient(rgba(255,255,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.08) 1px,transparent 1px);background-size:20px 20px; }
  .specimen-map::after { right:-54px;top:36px;width:150px;height:150px;border-color:rgba(199,242,74,.22);box-shadow:0 0 0 24px rgba(199,242,74,.025),0 0 0 48px rgba(199,242,74,.018); }
  .specimen-map i { display:none; }
  .specimen-code { margin-top:36px;color:#fff;font-size:32px;letter-spacing:.01em; }
  .specimen-cn { margin-top:4px;color:rgba(255,255,255,.82);font-size:13px; }
  .specimen-card > p { display:none; }
  .specimen-visual { right:-4px;top:34px;width:62%;height:118px; }
  .specimen-visual img:first-child { opacity:.12; }
  .specimen-visual img:last-child { filter:drop-shadow(0 10px 14px rgba(0,0,0,.28)); }
  .specimen-subtype { left:10px;right:10px;bottom:10px;padding:9px 10px;border-color:rgba(255,255,255,.12);border-radius:10px 3px 10px 3px;color:#fff;background:rgba(255,255,255,.06); }
  .specimen-subtype small { color:var(--accent);font-size:6px; }
  .specimen-subtype b { margin-top:5px;color:#fff;font-size:10px; }
  .specimen-subtype span { display:none; }
  .specimen-seal { display:none; }
  .question-panel { border-radius:24px 7px 24px 7px; }
  .question-meta { min-height:auto;padding:20px 22px 18px;display:grid;grid-template-columns:1fr auto;gap:7px 18px; }
  .question-meta .panel-label { grid-column:1; }
  .question-count { grid-column:2;grid-row:1;margin:0;align-self:center; }
  .question-count strong { font-size:46px; }
  .question-count span { font-size:12px; }
  .question-meta > p:not(.panel-label),.question-meta > small { display:none; }
  .question-route { grid-column:1 / -1;margin-top:10px; }
  .question-card { min-height:0;margin:0;padding:24px; }
  .question-card-head > span { display:none; }
  .question-card h2 { margin:28px 0 26px;font-size:28px; }
  .answer-option { min-height:76px;padding:14px;grid-template-columns:38px 1fr 18px; }
  .answer-letter { width:32px;height:32px; }
  .answer-option > span:nth-child(2) { font-size:14px; }
  .question-footer { width:100%;margin-top:8px;padding:0 4px;align-items:flex-start;gap:14px; }
  .question-footer > span { text-align:right;white-space:nowrap;line-height:1.55; }
  .result-heading { margin-bottom:20px; }
  .result-heading > div { align-items:flex-start;flex-direction:column; }
  .result-heading h2 { font-size:32px; }
  .type-profile { min-height:0;padding:26px;border-radius:26px 8px 26px 8px; }
  .type-profile.has-type-visual > :not(.result-type-visual) { max-width:none; }
  .result-kicker { margin-top:14px; }
  .type-code-lockup strong { font-size:66px; }
  .type-code-lockup b { font-size:29px; }
  .type-profile h1 { margin-top:6px;font-size:23px; }
  .result-type-visual { inset:14px 6px auto auto;width:39%;height:230px;opacity:.92; }
  .result-type-visual-main { display:none; }
  .result-type-visual-sub { right:0;top:0;bottom:auto;max-width:100%;max-height:100%; }
  .result-sidebar { margin-top:12px;display:block; }
  .badge-section,.share-section { margin-top:12px;padding:24px; }
  .result-actions,.result-save-status { grid-column:auto;grid-row:auto; }
  .result-actions { margin-top:12px;display:grid;grid-template-columns:1fr 1fr; }
  .result-actions button { padding:0 10px; }
  .result-save-status { margin-top:10px;text-align:center; }
  .share-modal { padding:12px; }
  .share-dialog { padding:14px; }
  .share-buttons > * { flex:1;min-width:0; }
  .place-footer { width:calc(100% - 24px);min-height:68px;flex-direction:column;justify-content:center;align-items:flex-start;gap:5px; }
}

@media (max-width: 479px) {
  .intro-copy { min-height:560px;padding:24px; }
  .intro-copy h1 { font-size:clamp(29px,9.2vw,42px); }
  .specimen-card { right:10px;top:348px;bottom:auto;width:49%;min-height:202px; }
  .question-card { padding:20px; }
  .question-card h2 { font-size:25px; }
  .answer-option svg { display:none; }
  .answer-option { grid-template-columns:36px 1fr; }
  .type-profile { min-height:0;padding:22px; }
  .type-code-lockup { min-width:0;max-width:100%;gap:5px; }
  .type-code-lockup strong { font-size:clamp(46px,16vw,58px); }
  .type-code-lockup span { font-size:clamp(20px,7vw,26px); }
  .type-code-lockup b { font-size:clamp(19px,7vw,25px); }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; animation: none !important; transition: none !important; }
}
</style>
