<template>
  <main class="place-page">
    <div class="paper-grain" aria-hidden="true"></div>

    <header class="place-nav">
      <button class="brand-lockup" type="button" @click="goHome" aria-label="返回校园图鉴">
        <span class="brand-mark">P</span>
        <span>
          <b>PLACE @ SYSU</b>
          <small>Personal Lifestyle Atlas for Campus Exploration</small>
        </span>
      </button>
      <div v-if="stage !== 'intro' && stage !== 'result'" class="nav-progress" aria-live="polite">
        <span>{{ progressLabel }}</span>
        <div class="progress-track"><i :style="{ width: `${progressPercent}%` }"></i></div>
      </div>
      <button class="nav-exit" type="button" @click="goHome">校园图鉴 ↗</button>
    </header>

    <section v-if="stage === 'intro'" class="intro-shell">
      <div class="intro-copy">
        <p class="eyebrow">A CAMPUS PERSONALITY FIELD TEST · 2026</p>
        <h1>PLACE<br><em>@ SYSU</em></h1>
        <p class="intro-lead">你在大学里怎么推进事情、怎么和人连接，又会被校园里的什么吸引？</p>

        <button class="primary-action" type="button" @click="startTest">
          <span>开始测试</span>
          <i>约 5 分钟</i>
        </button>
      </div>

      <aside class="specimen-card" aria-label="结果卡示意">
        <div class="specimen-topline"><span>TYPE SPECIMEN</span><span>NO. 01</span></div>
        <div class="specimen-code">GROW</div>
        <div class="specimen-cn">长线练级人</div>
        <p>这条技能树不急着满级，<br>但我会一直点下去。</p>
        <div class="specimen-place">
          <small>TODAY'S PLACE</small>
          <b>竹种标本园</b>
          <span>这片竹林的技能树，已经点了近百年。</span>
        </div>
        <div class="specimen-seal">SYSU<br>PLACE</div>
      </aside>
    </section>

    <section v-else-if="stage === 'questions'" class="question-shell">
      <div class="question-meta">
        <span>LONG-TERM PATTERN</span>
        <b>{{ String(questionIndex + 1).padStart(2, '0') }} / {{ questions.length }}</b>
      </div>

      <article class="question-card" :key="currentQuestion.id">
        <p class="question-number">Q{{ String(currentQuestion.id).padStart(2, '0') }}</p>
        <h2>{{ currentQuestion.prompt }}</h2>

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
            <i aria-hidden="true">↗</i>
          </button>
        </div>
      </article>

      <div class="question-footer">
        <button type="button" class="text-action" @click="previousStep">← 上一题</button>
        <span>凭第一反应选就好，不用寻找“正确答案”。</span>
      </div>
    </section>

    <section v-else-if="stage === 'today'" class="question-shell today-shell">
      <div class="question-meta">
        <span>TODAY'S STATUS</span>
        <b>{{ String(todayIndex + 1).padStart(2, '0') }} / {{ todayFields.length }}</b>
      </div>

      <article class="question-card today-card" :key="currentTodayField.id">
        <p class="question-number">{{ currentTodayField.eyebrow }}</p>
        <h2>{{ currentTodayField.prompt }}</h2>
        <p v-if="currentTodayField.note" class="field-note">{{ currentTodayField.note }}</p>

        <div class="today-options" :class="{ compact: currentTodayField.id === 'origin' }" role="group" :aria-label="currentTodayField.prompt">
          <button
            v-for="item in currentTodayField.options"
            :key="item.value"
            class="today-option"
            :class="{ selected: todayAnswers[currentTodayField.id] === item.value }"
            type="button"
            :aria-pressed="todayAnswers[currentTodayField.id] === item.value"
            @click="selectToday(item.value)"
          >
            <b>{{ item.label }}</b>
            <span>{{ item.note }}</span>
            <i aria-hidden="true"></i>
          </button>
        </div>
      </article>

      <div class="question-footer">
        <button type="button" class="text-action" @click="previousStep">← 上一步</button>
        <span>今日状态只影响地点推荐，不会改变你的类型。</span>
      </div>
    </section>

    <section v-else-if="stage === 'result' && result" class="result-shell">
      <div class="result-heading">
        <p class="eyebrow">YOUR PLACE TYPE · SOUTH CAMPUS EDITION</p>
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
          <p class="result-kicker">你的校园类型组合</p>
          <div class="type-code-lockup">
            <strong :style="{ color: result.main.color }">{{ result.main.displayCode || result.mainCode }}</strong>
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

        <article class="place-panel">
          <p class="panel-label">TODAY'S PLACE</p>
          <div class="place-title-row">
            <div>
              <span>南校园 · NO. {{ String(result.place.id).padStart(3, '0') }}</span>
              <h3>{{ result.place.name }}</h3>
            </div>
            <div class="place-stamp">GO<br>TODAY</div>
          </div>
          <p class="culture-line">{{ result.line }}</p>
          <div class="visit-meta">
            <span>{{ result.distanceLabel }}</span>
            <span>{{ result.place.access }}</span>
          </div>
          <div class="micro-task">
            <small>到达以后，顺手做一件小事</small>
            <p>{{ result.task }}</p>
          </div>
        </article>
      </div>

      <section v-if="result.badges.length" class="badge-section">
        <div>
          <p class="panel-label">SIDE BADGES</p>
          <h3>你还掉落了这些校园徽章</h3>
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
          <h3>把今天的校园样本收进相册</h3>
          <p>分享卡不会包含起点、同行状态、体力或步行范围。</p>
        </div>
        <button class="primary-action compact-action" type="button" @click="openShareCard">
          <span>生成我的校园卡片</span><i>3:4</i>
        </button>
      </section>

      <div class="result-actions">
        <button class="secondary-action" type="button" @click="restart">再测一次</button>
        <button class="secondary-action" type="button" @click="goHome">回到校园图鉴 ↗</button>
      </div>
    </section>

    <div v-if="shareCardVisible" class="share-modal" role="dialog" aria-modal="true" aria-label="分享卡预览" @click.self="closeShareCard">
      <div class="share-dialog">
        <div class="share-dialog-head">
          <div><small>PLACE @ SYSU</small><b>校园样本卡已经生成</b></div>
          <button type="button" @click="closeShareCard" aria-label="关闭">×</button>
        </div>
        <div class="share-image-wrap">
          <div v-if="!shareImage" class="share-loading">正在排版…</div>
          <img v-else :src="shareImage" alt="PLACE @ SYSU 测试分享卡">
        </div>
        <p class="share-tip">手机端可以长按图片保存。</p>
        <div class="share-buttons">
          <button type="button" class="secondary-action" @click="downloadShareCard">保存图片</button>
          <button v-if="canNativeShare" type="button" class="primary-action compact-action" @click="nativeShare">
            <span>分享</span><i>↗</i>
          </button>
        </div>
      </div>
    </div>

    <footer class="place-footer">
      <span>PLACE @ SYSU</span>
      <span>笃行校园图鉴 · 南校园首发版</span>
    </footer>
  </main>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import QRCode from 'qrcode'
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
  fallbackClosers,
  mainTypes,
  origins,
  places,
  questions,
  recommendations,
  signalWeights,
  subTypes,
  todayFields,
  zonePoints
} from '@/data/placeTest'

const router = useRouter()
const stage = ref('intro')
const questionIndex = ref(0)
const todayIndex = ref(0)
const answers = ref(Array(questions.length).fill(null))
const todayAnswers = ref({})
const result = ref(null)
const advancing = ref(false)
const shareCardVisible = ref(false)
const shareImage = ref('')

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
  TREE: treeVisual,
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
const currentTodayField = computed(() => todayFields[todayIndex.value])
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
  if (stage.value === 'questions') return ((questionIndex.value + 1) / questions.length) * 82
  if (stage.value === 'today') return 82 + ((todayIndex.value + 1) / todayFields.length) * 18
  return 0
})
const progressLabel = computed(() => stage.value === 'questions' ? '长期倾向' : '今日状态')

onMounted(() => {
  document.title = 'PLACE @ SYSU｜你的校园类型'
  window.scrollTo({ top: 0, left: 0 })
})

onBeforeUnmount(() => {
  document.body.classList.remove('dialog-open')
})

function scrollTop() {
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
}

function startTest() {
  stage.value = 'questions'
  questionIndex.value = 0
  scrollTop()
}

function selectAnswer(index) {
  if (advancing.value) return
  answers.value[questionIndex.value] = index
  advancing.value = true
  window.setTimeout(() => {
    if (questionIndex.value < questions.length - 1) {
      questionIndex.value += 1
    } else {
      stage.value = 'today'
      todayIndex.value = 0
    }
    advancing.value = false
    scrollTop()
  }, 170)
}

function selectToday(value) {
  if (advancing.value) return
  const field = currentTodayField.value
  todayAnswers.value = { ...todayAnswers.value, [field.id]: value }
  advancing.value = true
  window.setTimeout(() => {
    if (todayIndex.value < todayFields.length - 1) {
      todayIndex.value += 1
      advancing.value = false
      scrollTop()
      return
    }
    buildResult()
    advancing.value = false
  }, 170)
}

function previousStep() {
  if (stage.value === 'questions') {
    if (questionIndex.value === 0) stage.value = 'intro'
    else questionIndex.value -= 1
  } else if (stage.value === 'today') {
    if (todayIndex.value === 0) {
      stage.value = 'questions'
      questionIndex.value = questions.length - 1
    } else todayIndex.value -= 1
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

function zoneDistance(a, b) {
  const p1 = zonePoints[a] || zonePoints.center
  const p2 = zonePoints[b] || zonePoints.center
  return Math.ceil((Math.abs(p1[0] - p2[0]) + Math.abs(p1[1] - p2[1])) / 2)
}

function choosePlace(mainCode, subCode) {
  const today = todayAnswers.value
  const origin = origins.find(item => item.id === today.origin) || origins[3]
  const preferred = recommendations[mainCode][subCode]
  const rangeCaps = { near: 0, detour: 1, walk: 2, any: 99 }
  const rangeCap = rangeCaps[today.range] ?? 2

  const ranked = places.map(place => {
    const distance = zoneDistance(origin.zone, place.zone)
    let score = 0
    if (place.id === preferred.placeId) score += 42
    if (place.tags.includes(subCode)) score += 30
    if (place.mains.includes(mainCode)) score += 14
    if (place.experiences.includes(today.experience)) score += 18
    if (place.energy.includes(today.energy)) score += 8
    if (place.company.includes(today.company)) score += 5
    if (place.times.includes(today.time)) score += 7
    else score -= 24
    if (distance <= rangeCap) score += 14 - distance * 4
    else score -= 28 + (distance - rangeCap) * 7
    return { place, score, distance }
  }).sort((a, b) => b.score - a.score)

  const picked = ranked[0]
  const isPreferred = picked.place.id === preferred.placeId
  return {
    ...picked,
    line: isPreferred ? preferred.line : `${picked.place.fact}${fallbackClosers[mainCode]}`,
    task: isPreferred ? preferred.task : genericTask(mainCode, subCode, picked.place)
  }
}

function genericTask(mainCode, subCode, place) {
  const bySub = {
    TREE: '找个不挡路的位置，安静待五分钟。',
    MAPS: '找到门额、门牌或地点编号，把这一格收进地图。',
    RUN: '到达后再挑一个看得见的方向，多走一小段。',
    LENS: '不拍全景，只拍一个屋顶、窗户或倒影。',
    WIKI: '找一个年份、人名或碑刻，再回头看一遍这里。',
    BASE: '选一个愿意下次再来的位置，坐一会儿。'
  }
  const prefix = {
    GROW: '带走一个以前不知道的点：',
    SIDE: '追着最感兴趣的细节去：',
    DONE: '给自己一个明确的小目标：',
    DDL: '控制在十分钟内：',
    HOST: '把它变成一句开场白：',
    SYNC: '和搭子各做一半：',
    TRY: '做一件以前路过时没做过的事：',
    PING: '不查攻略，让现场决定：'
  }
  return `${prefix[mainCode]}${bySub[subCode] || `认真看一眼${place.name}。`}`
}

function distanceCopy(distance) {
  if (distance === 0) return '就在你选的起点附近'
  if (distance === 1) return '需要稍微绕一点路'
  if (distance === 2) return '适合慢慢走过去'
  return '今天可以把它当成一次小远征'
}

function buildResult() {
  const values = normalizedSignals()
  const main = chooseMainType(values)
  const subCode = chooseSubType()
  const picked = choosePlace(main.code, subCode)
  result.value = {
    mainCode: main.code,
    main: main.type,
    subCode,
    sub: subTypes[subCode],
    badges: chooseBadges(main.code),
    place: picked.place,
    line: picked.line,
    task: picked.task,
    distanceLabel: distanceCopy(picked.distance)
  }
  stage.value = 'result'
  nextTick(scrollTop)
}

function restart() {
  answers.value = Array(questions.length).fill(null)
  todayAnswers.value = {}
  result.value = null
  questionIndex.value = 0
  todayIndex.value = 0
  stage.value = 'intro'
  scrollTop()
}

function goHome() {
  router.push('/atlas')
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
      lines.push(current)
      current = char
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

  ctx.fillStyle = '#FCF9F8'
  ctx.fillRect(0, 0, 900, 1200)
  ctx.fillStyle = '#FDECEC'
  ctx.beginPath(); ctx.arc(780, 70, 220, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#E8F5E9'
  ctx.beginPath(); ctx.arc(40, 1120, 190, 0, Math.PI * 2); ctx.fill()

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

  ctx.fillStyle = '#8C1515'
  ctx.fillRect(64, 58, 52, 52)
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '600 30px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.fillText('P', 90, 94)
  ctx.textAlign = 'left'
  ctx.fillStyle = '#1A1A1A'
  ctx.font = '600 25px Georgia, serif'
  ctx.fillText('PLACE @ SYSU', 136, 82)
  ctx.fillStyle = '#4A4A4A'
  ctx.font = '500 14px Arial, sans-serif'
  ctx.fillText('CAMPUS PERSONALITY SPECIMEN · SOUTH CAMPUS', 136, 106)

  const mainDisplayCode = card.main.displayCode || card.mainCode
  ctx.fillStyle = card.main.color || '#8C1515'
  ctx.font = '500 124px Georgia, serif'
  ctx.fillText(mainDisplayCode, 62, 272)
  const mainCodeWidth = ctx.measureText(mainDisplayCode).width
  const subCodeX = Math.min(62 + mainCodeWidth + 24, 500)
  ctx.fillStyle = '#B8C9C6'
  ctx.font = '400 42px Georgia, serif'
  ctx.fillText('/', subCodeX, 258)
  ctx.fillStyle = '#2F4F4F'
  ctx.font = '600 44px Georgia, serif'
  ctx.fillText(card.subCode, subCodeX + 30, 258)
  ctx.fillStyle = '#1A1A1A'
  ctx.font = '600 36px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText(`${card.main.name} · ${card.sub.name}`, 68, 332)
  ctx.fillStyle = '#4A4A4A'
  ctx.font = '500 27px "PingFang SC", "Microsoft YaHei", sans-serif'
  const hookBottom = drawWrappedText(ctx, card.main.hook, 68, 384, 730, 40, 2)

  const subtypeY = hookBottom + 8
  ctx.fillStyle = '#2F4F4F'
  ctx.font = '600 14px Arial, sans-serif'
  ctx.fillText(`${card.subCode} · EXPLORATION PREFERENCE`, 68, subtypeY)
  ctx.fillStyle = '#4A4A4A'
  ctx.font = '500 23px "PingFang SC", "Microsoft YaHei", sans-serif'
  const subtypeBottom = drawWrappedText(ctx, card.sub.note, 68, subtypeY + 34, 730, 32, 2)

  const placeY = subtypeBottom + 20
  ctx.fillStyle = '#8C1515'
  roundedRect(ctx, 64, placeY, 772, 320, 30); ctx.fill()
  ctx.fillStyle = '#F9D7D7'
  ctx.font = '600 16px Arial, sans-serif'
  ctx.fillText('TODAY\'S PLACE', 102, placeY + 50)
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '600 50px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText(card.place.name, 102, placeY + 116)
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '400 25px "PingFang SC", "Microsoft YaHei", sans-serif'
  drawWrappedText(ctx, card.line, 102, placeY + 176, 690, 40, 3)

  const shareBadges = card.badges.slice(0, 2)
  const badgeImages = await Promise.all(shareBadges.map(async badge => {
    try {
      return await loadCanvasImage(badge.icon)
    } catch (error) {
      console.warn('Badge artwork render failed', error)
      return null
    }
  }))
  const badgeY = placeY + 370
  ctx.fillStyle = '#8C1515'
  ctx.font = '600 13px Arial, sans-serif'
  ctx.fillText('SIDE BADGES', 66, badgeY - 16)
  shareBadges.forEach((badge, index) => {
    const badgeX = 66 + index * 198
    ctx.fillStyle = '#F7F5F1'
    roundedRect(ctx, badgeX, badgeY, 184, 144, 24); ctx.fill()
    if (badgeImages[index]) ctx.drawImage(badgeImages[index], badgeX + 40, badgeY + 2, 104, 104)
    ctx.fillStyle = '#1A1A1A'
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
      color: { dark: '#1A1A1A', light: '#FFFFFF' }
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
    ctx.fillStyle = '#4A4A4A'
    ctx.font = '500 14px "PingFang SC", sans-serif'
    ctx.fillText('扫码测测你的校园类型', 836, 1166)
    ctx.textAlign = 'left'
  } catch (error) {
    console.warn('QR code render failed', error)
  }

  ctx.fillStyle = '#1A1A1A'
  ctx.font = '600 18px Georgia, serif'
  ctx.fillText('PLACE @ SYSU · 笃行校园图鉴', 66, 1166)

  return canvas.toDataURL('image/png')
}

async function openShareCard() {
  shareCardVisible.value = true
  shareImage.value = ''
  document.body.classList.add('dialog-open')
  try {
    await nextTick()
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
    const file = new File([blob], 'place-at-sysu.png', { type: 'image/png' })
    await navigator.share({ title: '我的 PLACE @ SYSU 校园类型', text: result.value.main.hook, files: [file] })
  } catch (error) {
    if (error?.name !== 'AbortError') downloadShareCard()
  }
}
</script>

<style scoped>
.place-page {
  --primary: #8c1515;
  --primary-soft: #fdecec;
  --ink: #1a1a1a;
  --body: #4a4a4a;
  --canvas: #fcf9f8;
  --surface: #f4f4f2;
  --hairline: #dadad8;
  --gold: #b8860b;
  --teal: #2f4f4f;
  position: relative;
  min-height: 100vh;
  overflow-x: clip;
  background: var(--canvas);
  color: var(--ink);
  font-family: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
}

.paper-grain {
  position: fixed;
  inset: 0;
  pointer-events: none;
  opacity: .35;
  background-image: radial-gradient(rgba(26, 26, 26, .06) .6px, transparent .6px);
  background-size: 5px 5px;
  mask-image: linear-gradient(to bottom, black, transparent 88%);
}

.place-nav {
  position: relative;
  z-index: 5;
  width: min(1120px, calc(100% - 48px));
  margin: 0 auto;
  min-height: 96px;
  display: grid;
  grid-template-columns: 1fr minmax(180px, 320px) 1fr;
  align-items: center;
  border-bottom: 1px solid var(--hairline);
}

.brand-lockup {
  justify-self: start;
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
}

.brand-mark {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  color: #fff;
  background: var(--primary);
  font: 600 22px Georgia, serif;
}

.brand-lockup b,
.brand-lockup small { display: block; }
.brand-lockup b { font: 600 14px Georgia, serif; letter-spacing: .06em; }
.brand-lockup small { margin-top: 2px; color: var(--body); font-size: 10px; letter-spacing: .08em; }

.nav-progress { display: grid; gap: 8px; color: var(--body); font-size: 12px; text-align: center; }
.progress-track { height: 2px; overflow: hidden; background: var(--hairline); }
.progress-track i { display: block; height: 100%; background: var(--primary); transition: width .3s ease; }
.nav-exit { justify-self: end; color: var(--body); font-size: 13px; }

.intro-shell {
  position: relative;
  z-index: 1;
  width: min(1120px, calc(100% - 48px));
  min-height: calc(100vh - 170px);
  margin: 0 auto;
  padding: 76px 0 88px;
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(330px, .85fr);
  gap: 90px;
  align-items: start;
}

.eyebrow,
.panel-label {
  margin: 0;
  color: var(--primary);
  font: 600 12px Georgia, serif;
  letter-spacing: .13em;
  text-transform: uppercase;
}

.intro-copy h1 {
  margin: 18px 0 24px;
  font: 500 clamp(76px, 10vw, 142px)/.8 Georgia, "Times New Roman", serif;
  letter-spacing: -.07em;
}

.intro-copy h1 em { color: var(--primary); font-style: normal; }
.intro-lead { max-width: 640px; margin: 0; font-size: clamp(22px, 3vw, 34px); font-weight: 600; line-height: 1.45; letter-spacing: -.03em; }

.intro-copy > .primary-action { margin-top: 32px; }

.primary-action {
  min-width: 240px;
  min-height: 58px;
  padding: 0 18px 0 28px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 28px;
  color: #fff;
  background: var(--primary);
  box-shadow: 0 12px 34px rgba(140, 21, 21, .16);
  transition: transform .2s ease, box-shadow .2s ease;
}
.primary-action:hover { transform: translateY(-2px); box-shadow: 0 16px 38px rgba(140, 21, 21, .22); }
.primary-action span { font-size: 16px; font-weight: 600; }
.primary-action i { min-width: 70px; padding: 8px 12px; border-radius: 999px; color: #7d1111; background: #fff; font-size: 11px; font-style: normal; }

.specimen-card {
  position: relative;
  min-height: 610px;
  padding: 30px;
  overflow: hidden;
  border-radius: 26px;
  color: #fff;
  background: var(--primary);
  box-shadow: 0 30px 70px rgba(140, 21, 21, .24);
  transform: rotate(2deg);
}
.specimen-card::after { content: ''; position: absolute; width: 260px; height: 260px; right: -100px; top: 80px; border-radius: 50%; border: 1px solid rgba(255,255,255,.25); box-shadow: 0 0 0 45px rgba(255,255,255,.04), 0 0 0 90px rgba(255,255,255,.03); }
.specimen-topline { display: flex; justify-content: space-between; color: #f2bcbc; font: 600 11px Georgia, serif; letter-spacing: .12em; }
.specimen-code { position: relative; z-index: 1; margin-top: 72px; font: 500 clamp(76px, 9vw, 116px)/1 Georgia, serif; letter-spacing: -.06em; }
.specimen-cn { margin-top: 6px; font-size: 27px; font-weight: 600; }
.specimen-card > p { margin: 24px 0; color: #ffe9e9; font-size: 17px; line-height: 1.7; }
.specimen-place { position: absolute; left: 30px; right: 30px; bottom: 30px; padding: 24px; border-radius: 18px; color: var(--ink); background: #fff; }
.specimen-place small, .specimen-place b, .specimen-place span { display: block; }
.specimen-place small { color: var(--primary); font: 600 10px Georgia, serif; letter-spacing: .12em; }
.specimen-place b { margin-top: 10px; font-size: 24px; }
.specimen-place span { margin-top: 7px; color: var(--body); font-size: 13px; }
.specimen-seal { position: absolute; right: 22px; top: 24px; width: 68px; height: 68px; display: grid; place-items: center; border: 1px solid rgba(255,255,255,.4); border-radius: 50%; color: #f7d1d1; font: 600 11px/1.25 Georgia, serif; text-align: center; transform: rotate(12deg); }

.question-shell {
  position: relative;
  z-index: 1;
  width: min(880px, calc(100% - 48px));
  min-height: calc(100vh - 170px);
  margin: 0 auto;
  padding: 70px 0 100px;
}
.question-meta { margin-bottom: 30px; display: flex; justify-content: space-between; color: var(--body); font: 600 12px Georgia, serif; letter-spacing: .12em; }
.question-meta b { color: var(--primary); font-weight: 600; }
.question-card { animation: cardIn .35s ease both; }
@keyframes cardIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
.question-number { margin: 0 0 14px; color: var(--primary); font: 600 13px Georgia, serif; letter-spacing: .1em; }
.question-card h2 { max-width: 760px; margin: 0 0 42px; font-size: clamp(28px, 5vw, 44px); line-height: 1.35; letter-spacing: -.035em; }
.field-note { margin: -26px 0 36px; color: var(--body); }
.answer-list { display: grid; gap: 12px; }
.answer-option {
  width: 100%;
  min-height: 78px;
  padding: 14px 20px;
  display: grid;
  grid-template-columns: 42px 1fr 24px;
  gap: 12px;
  align-items: center;
  border: 1px solid var(--hairline);
  border-radius: 16px;
  color: var(--ink);
  background: rgba(255,255,255,.6);
  text-align: left;
  transition: border-color .18s ease, background .18s ease, transform .18s ease;
}
.answer-option:hover { border-color: #b7b7b4; transform: translateX(4px); }
.answer-option.selected { color: #fff; border-color: var(--primary); background: var(--primary); }
.answer-letter { width: 34px; height: 34px; display: grid; place-items: center; border: 1px solid currentColor; border-radius: 50%; font: 600 13px Georgia, serif; }
.answer-option > span:nth-child(2) { font-size: 16px; line-height: 1.55; }
.answer-option i { justify-self: end; color: #9c9c98; font-style: normal; }
.answer-option.selected i { color: #fff; }

.question-footer { margin-top: 28px; display: flex; align-items: center; justify-content: space-between; color: #767673; font-size: 12px; }
.text-action { color: var(--primary); font-weight: 600; }

.today-shell { width: min(920px, calc(100% - 48px)); }
.today-options { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
.today-options.compact { grid-template-columns: repeat(2, 1fr); }
.today-option {
  position: relative;
  min-height: 104px;
  padding: 20px 52px 18px 20px;
  border: 1px solid var(--hairline);
  border-radius: 16px;
  background: rgba(255,255,255,.66);
  text-align: left;
  transition: border-color .18s ease, background .18s ease;
}
.today-option:hover { border-color: #b7b7b4; }
.today-option b, .today-option span { display: block; }
.today-option b { font-size: 17px; }
.today-option span { margin-top: 7px; color: var(--body); font-size: 12px; }
.today-option i { position: absolute; right: 20px; top: 50%; width: 19px; height: 19px; border: 1px solid #aaa; border-radius: 50%; transform: translateY(-50%); }
.today-option.selected { border-color: var(--teal); background: #e8f5e9; }
.today-option.selected i { border: 5px solid var(--teal); background: #fff; }

.result-shell {
  position: relative;
  z-index: 1;
  width: min(1120px, calc(100% - 48px));
  margin: 0 auto;
  padding: 52px 0 76px;
}
.result-heading {
  margin-bottom: 18px;
}
.result-grid { display: grid; grid-template-columns: 1.22fr .78fr; gap: 16px; align-items: stretch; }
.type-profile, .place-panel { position: relative; min-height: 430px; padding: 30px; overflow: hidden; border-radius: 22px; }
.type-profile { border: 1px solid rgba(47,79,79,.12); background: linear-gradient(135deg, rgba(255,255,255,.92), rgba(238,243,241,.88)); }
.place-panel { background: var(--surface); }
.result-type-visual { position: absolute; inset: 0 0 0 48%; z-index: 0; pointer-events: none; }
.result-type-visual img { position: absolute; display: block; width: auto; height: auto; object-fit: contain; }
.result-type-visual-main { right: -8%; top: -4%; max-width: 108%; max-height: 108%; opacity: .68; }
.result-type-visual-sub { right: -3%; bottom: -8%; max-width: 104%; max-height: 104%; filter: drop-shadow(0 10px 16px rgba(16, 48, 47,.18)); }
.main-visual-sync .result-type-visual-main,
.main-visual-try .result-type-visual-main { right: -24%; max-width: 132%; }
.main-visual-grow .result-type-visual-main,
.main-visual-side .result-type-visual-main { top: -2%; max-width: 102%; max-height: 102%; }
.main-visual-host .result-type-visual-main { right: -18%; }
.sub-visual-maps .result-type-visual-sub { right: 0; max-width: 88%; max-height: 96%; }
.sub-visual-lens .result-type-visual-sub,
.sub-visual-wiki .result-type-visual-sub { right: -2%; max-width: 96%; max-height: 96%; }
.sub-visual-tree .result-type-visual-sub { right: -8%; max-width: 108%; }
.sub-visual-base .result-type-visual-sub { right: -10%; bottom: -8%; max-width: 112%; max-height: 106%; }
.type-profile.has-type-visual > :not(.result-type-visual) { position: relative; z-index: 1; }
.type-profile.has-type-visual > :not(.result-type-visual) { max-width: 58%; }
.type-profile .panel-label { color: var(--primary); }
.result-kicker { margin: 26px 0 5px; color: var(--body); font-size: 12px; }
.type-code-lockup { min-height: 92px; display: flex; align-items: baseline; gap: 12px; white-space: nowrap; }
.type-code-lockup strong { font: 500 clamp(68px, 7.2vw, 104px)/.88 Georgia, serif; letter-spacing: -.07em; }
.type-code-lockup span { color: #aab9b6; font: 400 30px Georgia, serif; }
.type-code-lockup b { color: var(--teal); font: 600 clamp(30px, 3.4vw, 46px)/1 Georgia, serif; letter-spacing: -.04em; }
.type-profile h1 { margin: 10px 0 16px; font-size: clamp(23px, 2.3vw, 30px); letter-spacing: -.04em; }
.type-profile.has-type-visual h1 { max-width: 76%; }
.type-profile h1 i { margin: 0 8px; color: #b7b7b4; font-style: normal; font-weight: 400; }
.type-profile h1 span { color: var(--teal); }
.type-profile blockquote { margin: 0; padding-left: 14px; border-left: 3px solid var(--primary); font-size: 18px; font-weight: 600; line-height: 1.55; }
.result-intro { margin: 12px 0 0; color: var(--body); font-size: 12px; line-height: 1.7; }
.subtype-note { margin-top: 16px; padding: 12px 14px; border-radius: 14px; background: rgba(255,255,255,.78); }
.subtype-note small { color: var(--teal); font-size: 10px; font-weight: 700; letter-spacing: .04em; }
.subtype-note p { margin: 5px 0 0; color: var(--body); font-size: 11px; line-height: 1.55; }
.place-title-row { margin-top: 36px; display: flex; justify-content: space-between; gap: 20px; align-items: start; }
.place-title-row span { color: var(--body); font-size: 11px; letter-spacing: .08em; }
.place-title-row h3 { margin: 6px 0 0; font-size: clamp(30px, 4vw, 42px); letter-spacing: -.04em; }
.place-stamp { width: 66px; height: 66px; flex: 0 0 auto; display: grid; place-items: center; border: 1px solid var(--primary); border-radius: 50%; color: var(--primary); font: 600 10px/1.2 Georgia, serif; text-align: center; transform: rotate(9deg); }
.culture-line { max-width: 620px; margin: 18px 0 14px; font-size: 16px; font-weight: 600; line-height: 1.6; }
.visit-meta { display: flex; flex-wrap: wrap; gap: 8px; }
.visit-meta span { padding: 7px 12px; border: 1px solid var(--hairline); border-radius: 999px; color: var(--body); background: #fff; font-size: 11px; }
.micro-task { margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--hairline); }
.micro-task small { color: var(--primary); font-size: 11px; font-weight: 600; }
.micro-task p { margin: 8px 0 0; color: var(--body); font-size: 14px; line-height: 1.7; }

.badge-section, .share-section { margin-top: 16px; padding: 26px; border-radius: 20px; display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.badge-section { border: 1px solid var(--hairline); background: rgba(255,255,255,.52); }
.badge-section h3, .share-section h3 { margin: 8px 0 0; font-size: 22px; }
.badge-list { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.badge-item { min-width: 152px; padding: 8px 12px 8px 8px; border: 1px solid rgba(140,21,21,.08); border-radius: 18px; display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,.72); }
.badge-item img { width: 52px; height: 52px; flex: 0 0 auto; object-fit: contain; }
.badge-item span { color: #5e4610; font-size: 12px; font-weight: 600; white-space: nowrap; }
.share-section { margin-top: 24px; color: #fff; background: var(--primary); }
.share-section .panel-label { color: #f1bebe; }
.share-section p:last-child { margin: 8px 0 0; color: #f6dcdc; font-size: 12px; }
.share-section .primary-action { color: var(--primary); background: #fff; box-shadow: none; }
.share-section .primary-action i { color: #fff; background: var(--primary); }
.compact-action { min-width: 260px; min-height: 54px; }
.result-actions { margin-top: 16px; display: flex; justify-content: flex-end; gap: 10px; }
.secondary-action { min-height: 48px; padding: 0 20px; border: 1px solid var(--hairline); border-radius: 999px; background: #fff; font-size: 13px; font-weight: 600; }

.share-modal { position: fixed; inset: 0; z-index: 13000; padding: 24px; overflow-y: auto; display: grid; place-items: center; background: rgba(26,26,26,.72); backdrop-filter: blur(14px); }
.share-dialog { width: min(480px, 100%); padding: 18px; border-radius: 24px; background: var(--canvas); box-shadow: 0 30px 80px rgba(0,0,0,.25); }
.share-dialog-head { padding: 4px 4px 14px; display: flex; align-items: center; justify-content: space-between; }
.share-dialog-head small, .share-dialog-head b { display: block; }
.share-dialog-head small { color: var(--primary); font: 600 10px Georgia, serif; letter-spacing: .12em; }
.share-dialog-head b { margin-top: 4px; font-size: 16px; }
.share-dialog-head button { width: 34px; height: 34px; border-radius: 50%; background: var(--surface); font-size: 22px; }
.share-image-wrap { aspect-ratio: 3 / 4; overflow: hidden; border-radius: 16px; background: var(--surface); }
.share-image-wrap img { width: 100%; height: 100%; display: block; object-fit: cover; }
.share-loading { height: 100%; display: grid; place-items: center; color: var(--body); }
.share-tip { margin: 12px 0 0; color: var(--body); font-size: 11px; text-align: center; }
.share-buttons { margin-top: 14px; display: flex; justify-content: flex-end; gap: 10px; }

.place-footer { position: relative; z-index: 1; width: min(1120px, calc(100% - 48px)); margin: 0 auto; min-height: 74px; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--hairline); color: var(--body); font-size: 11px; letter-spacing: .06em; }

button:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(140,21,21,.22); }

@media (min-width: 801px) and (max-height: 850px) {
  .place-nav { min-height: 78px; }
  .intro-shell {
    min-height: calc(100vh - 152px);
    padding: 24px 0 30px;
    gap: 70px;
  }
  .intro-copy h1 { margin: 18px 0 28px; font-size: clamp(76px, 8vw, 108px); line-height: .88; }
  .intro-lead { font-size: clamp(22px, 2.4vw, 30px); line-height: 1.5; }
  .intro-copy > .primary-action { min-height: 56px; margin-top: 38px; }
  .specimen-card { min-height: 500px; padding: 24px; border-radius: 22px; }
  .specimen-code { margin-top: 44px; font-size: clamp(72px, 7vw, 92px); }
  .specimen-cn { margin-top: 4px; font-size: 24px; }
  .specimen-card > p { margin: 16px 0; font-size: 15px; line-height: 1.55; }
  .specimen-place { left: 24px; right: 24px; bottom: 24px; padding: 18px; border-radius: 16px; }
  .specimen-place b { margin-top: 6px; font-size: 20px; }
  .specimen-place span { margin-top: 4px; font-size: 12px; }
  .specimen-seal { right: 18px; top: 18px; width: 58px; height: 58px; font-size: 10px; }
  .question-shell,
  .today-shell {
    min-height: calc(100vh - 152px);
    padding: 24px 0 30px;
  }
  .question-meta { margin-bottom: 16px; }
  .question-number { margin-bottom: 8px; }
  .question-card h2 { margin-bottom: 20px; font-size: clamp(26px, 3.2vw, 38px); line-height: 1.25; }
  .field-note { margin: -8px 0 18px; }
  .answer-list { gap: 8px; }
  .answer-option {
    min-height: 60px;
    padding: 8px 18px;
    grid-template-columns: 38px 1fr 20px;
    gap: 10px;
  }
  .answer-letter { width: 30px; height: 30px; }
  .answer-option > span:nth-child(2) { font-size: 15px; }
  .question-footer { margin-top: 14px; }
  .today-options { gap: 10px; }
  .today-option { min-height: 82px; padding: 14px 46px 14px 18px; }
  .today-options.compact { grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .today-options.compact .today-option { min-height: 58px; padding: 8px 40px 8px 14px; }
  .today-options.compact .today-option b { font-size: 14px; }
  .today-options.compact .today-option span { margin-top: 2px; font-size: 10px; }
  .today-options.compact .today-option i { right: 14px; width: 17px; height: 17px; }
}

@media (max-width: 800px) {
  .place-nav { width: min(100% - 32px, 1120px); min-height: 78px; grid-template-columns: 1fr auto; }
  .nav-progress { position: absolute; left: 0; right: 0; bottom: -13px; }
  .nav-progress span { display: none; }
  .nav-exit { font-size: 0; }
  .nav-exit::after { content: '图鉴 ↗'; font-size: 12px; }
  .intro-shell { width: min(100% - 36px, 1120px); padding: 54px 0 74px; grid-template-columns: 1fr; gap: 60px; }
  .intro-copy h1 { font-size: clamp(74px, 27vw, 116px); }
  .intro-lead { font-size: 24px; }
  .specimen-card { min-height: 540px; transform: rotate(0); }
  .question-shell, .today-shell { width: min(100% - 32px, 920px); padding: 62px 0 80px; }
  .question-card h2 { margin-bottom: 30px; font-size: 29px; }
  .answer-option { min-height: 74px; padding: 12px 14px; grid-template-columns: 38px 1fr 18px; }
  .answer-option > span:nth-child(2) { font-size: 14px; }
  .question-footer { align-items: flex-start; gap: 20px; }
  .question-footer > span { max-width: 210px; text-align: right; }
  .today-options, .today-options.compact { grid-template-columns: 1fr; }
  .today-option { min-height: 86px; }
  .result-shell { width: min(100% - 32px, 1120px); padding: 48px 0 72px; }
  .result-heading { margin-bottom: 18px; }
  .result-grid { grid-template-columns: 1fr; }
  .type-profile, .place-panel { min-height: 360px; padding: 26px; }
  .type-profile.has-type-visual > :not(.result-type-visual) { max-width: 64%; }
  .result-type-visual { left: 44%; opacity: .82; }
  .type-code-lockup { min-height: 76px; }
  .badge-section, .share-section { padding: 26px; align-items: flex-start; flex-direction: column; }
  .badge-list { justify-content: flex-start; }
  .share-section .primary-action { width: 100%; }
  .result-actions { justify-content: stretch; }
  .result-actions button { flex: 1; }
  .place-footer { width: min(100% - 32px, 1120px); flex-direction: column; justify-content: center; gap: 4px; align-items: flex-start; }
}

@media (max-width: 560px) {
  .type-profile { min-height: 500px; }
  .type-profile.has-type-visual > :not(.result-type-visual) { max-width: none; }
  .result-type-visual { inset: auto 0 0 30%; height: 52%; opacity: .34; }
  .type-code-lockup { gap: 8px; }
  .type-code-lockup strong { font-size: 64px; }
  .type-code-lockup b { font-size: 30px; }
  .type-profile h1 { font-size: 24px; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; animation: none !important; transition: none !important; }
}
</style>
