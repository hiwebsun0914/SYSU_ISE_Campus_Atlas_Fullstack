<template>
  <main class="place-page">
    <div class="paper-grain" aria-hidden="true"></div>

    <header class="place-nav">
      <button class="brand-lockup" type="button" @click="goHome" aria-label="返回校园图鉴">
        <span class="brand-mark">P</span>
        <span>
          <b>PLACE @ SYSU</b>
          <small>Personal Lifestyle Atlas</small>
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
        <p class="intro-note">这不是心理诊断。它更像一张个人校园使用说明，最后还会根据你今天的状态，推荐一个南校园去处。</p>

        <button class="primary-action" type="button" @click="startTest">
          <span>开始测试</span>
          <i>约 5 分钟</i>
        </button>

        <div class="intro-facts" aria-label="测试说明">
          <div><strong>28</strong><span>长期倾向题</span></div>
          <div><strong>06</strong><span>今日状态</span></div>
          <div><strong>24</strong><span>首发地点</span></div>
        </div>
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

        <div class="answer-list" role="radiogroup" :aria-label="currentQuestion.prompt">
          <button
            v-for="(item, index) in currentQuestion.options"
            :key="item.label"
            class="answer-option"
            :class="{ selected: answers[questionIndex] === index }"
            type="button"
            role="radio"
            :aria-checked="answers[questionIndex] === index"
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

        <div class="today-options" :class="{ compact: currentTodayField.id === 'origin' }" role="radiogroup">
          <button
            v-for="item in currentTodayField.options"
            :key="item.value"
            class="today-option"
            :class="{ selected: todayAnswers[currentTodayField.id] === item.value }"
            type="button"
            role="radio"
            :aria-checked="todayAnswers[currentTodayField.id] === item.value"
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
        <p class="result-kicker">你的校园主类型是</p>
        <h1 :style="{ color: result.main.color }">{{ result.main.displayCode || result.mainCode }}</h1>
        <h2>{{ result.main.name }}</h2>
        <blockquote>{{ result.main.hook }}</blockquote>
        <p class="result-intro">{{ result.main.intro }}</p>
      </div>

      <div class="result-grid">
        <article class="subtype-panel">
          <div class="panel-index">01</div>
          <p class="panel-label">CAMPUS EXPLORATION TYPE</p>
          <div class="subtype-code">{{ result.subCode }}</div>
          <h3>{{ result.sub.name }}</h3>
          <p>{{ result.sub.note }}</p>
        </article>

        <article class="place-panel">
          <div class="panel-index">02</div>
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
          <span v-for="badge in result.badges" :key="badge.name">{{ badge.name }}</span>
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
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import QRCode from 'qrcode'
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

const currentQuestion = computed(() => questions[questionIndex.value])
const currentTodayField = computed(() => todayFields[todayIndex.value])
const canNativeShare = computed(() => typeof navigator !== 'undefined' && typeof navigator.share === 'function')
const progressPercent = computed(() => {
  if (stage.value === 'questions') return ((questionIndex.value + 1) / questions.length) * 82
  if (stage.value === 'today') return 82 + ((todayIndex.value + 1) / todayFields.length) * 18
  return 0
})
const progressLabel = computed(() => stage.value === 'questions' ? '长期倾向' : '今日状态')

onMounted(() => {
  document.title = 'PLACE @ SYSU｜你的校园类型'
})

function scrollTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
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
    .map(([code, count]) => ({ code, count, ...badgeDefs[code] }))
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
      lines.push(current)
      current = char
    } else current = next
  })
  if (current) lines.push(current)
  lines.slice(0, maxLines).forEach((line, index) => ctx.fillText(line, x, y + lineHeight * index))
  return y + lineHeight * Math.min(lines.length, maxLines)
}

async function makeShareCard() {
  if (!result.value) return ''
  const card = result.value
  const canvas = document.createElement('canvas')
  canvas.width = 900
  canvas.height = 1200
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#FCF9F8'
  ctx.fillRect(0, 0, 900, 1200)
  ctx.fillStyle = '#FDECEC'
  ctx.beginPath(); ctx.arc(780, 70, 220, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#E8F5E9'
  ctx.beginPath(); ctx.arc(40, 1120, 190, 0, Math.PI * 2); ctx.fill()

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

  ctx.fillStyle = card.main.color || '#8C1515'
  ctx.font = '500 150px Georgia, serif'
  ctx.fillText(card.main.displayCode || card.mainCode, 62, 286)
  ctx.fillStyle = '#1A1A1A'
  ctx.font = '600 45px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText(card.main.name, 68, 350)
  ctx.fillStyle = '#4A4A4A'
  ctx.font = '400 30px "PingFang SC", "Microsoft YaHei", sans-serif'
  drawWrappedText(ctx, card.main.hook, 68, 410, 730, 48, 2)

  ctx.fillStyle = '#2F4F4F'
  roundedRect(ctx, 66, 520, 420, 62, 31); ctx.fill()
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '600 24px "PingFang SC", sans-serif'
  ctx.fillText(`${card.subCode} · ${card.sub.name}`, 92, 560)

  ctx.fillStyle = '#8C1515'
  roundedRect(ctx, 64, 632, 772, 350, 30); ctx.fill()
  ctx.fillStyle = '#F9D7D7'
  ctx.font = '600 16px Arial, sans-serif'
  ctx.fillText('TODAY\'S PLACE', 102, 688)
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '600 54px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText(card.place.name, 102, 766)
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '400 27px "PingFang SC", "Microsoft YaHei", sans-serif'
  drawWrappedText(ctx, card.line, 102, 836, 690, 43, 3)

  let badgeX = 66
  let badgeY = 1024
  card.badges.slice(0, 2).forEach(badge => {
    ctx.font = '500 20px "PingFang SC", sans-serif'
    const width = Math.ceil(ctx.measureText(`# ${badge.name}`).width) + 44
    if (badgeX + width > 650) {
      badgeX = 66
      badgeY += 62
    }
    ctx.fillStyle = '#F4F4F2'
    roundedRect(ctx, badgeX, badgeY, width, 54, 27); ctx.fill()
    ctx.fillStyle = '#1A1A1A'
    ctx.fillText(`# ${badge.name}`, badgeX + 22, badgeY + 35)
    badgeX += width + 12
  })

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
  await nextTick()
  shareImage.value = await makeShareCard()
}

function closeShareCard() {
  shareCardVisible.value = false
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
  align-items: center;
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
.intro-note { max-width: 610px; margin: 22px 0 32px; color: var(--body); font-size: 15px; line-height: 1.8; }

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

.intro-facts { margin-top: 50px; display: flex; gap: 44px; }
.intro-facts div { display: grid; gap: 4px; }
.intro-facts strong { font: 500 30px Georgia, serif; }
.intro-facts span { color: var(--body); font-size: 12px; }

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
  padding: 80px 0 110px;
}
.result-heading { max-width: 820px; margin-bottom: 70px; }
.result-kicker { margin: 50px 0 0; color: var(--body); font-size: 14px; }
.result-heading h1 { margin: 4px 0 -10px; font: 500 clamp(92px, 16vw, 190px)/1 Georgia, serif; letter-spacing: -.07em; }
.result-heading h2 { margin: 0; font-size: clamp(30px, 5vw, 50px); letter-spacing: -.04em; }
.result-heading blockquote { margin: 28px 0 0; padding-left: 20px; border-left: 3px solid var(--primary); font-size: clamp(20px, 3vw, 28px); font-weight: 600; line-height: 1.5; }
.result-intro { max-width: 680px; margin: 20px 0 0; color: var(--body); font-size: 15px; line-height: 1.8; }
.result-grid { display: grid; grid-template-columns: .78fr 1.22fr; gap: 20px; align-items: stretch; }
.subtype-panel, .place-panel { position: relative; min-height: 430px; padding: 34px; overflow: hidden; border-radius: 24px; }
.subtype-panel { color: #fff; background: var(--teal); }
.place-panel { background: var(--surface); }
.panel-index { position: absolute; right: 28px; top: 20px; color: rgba(255,255,255,.25); font: 500 64px Georgia, serif; }
.place-panel .panel-index { color: rgba(26,26,26,.08); }
.subtype-panel .panel-label { color: #b8d0cd; }
.subtype-code { margin-top: 90px; font: 500 76px/1 Georgia, serif; letter-spacing: -.05em; }
.subtype-panel h3 { margin: 12px 0 18px; font-size: 26px; }
.subtype-panel > p:last-child { max-width: 340px; color: #d4dfde; font-size: 14px; line-height: 1.8; }
.place-title-row { margin-top: 58px; display: flex; justify-content: space-between; gap: 20px; align-items: start; }
.place-title-row span { color: var(--body); font-size: 11px; letter-spacing: .08em; }
.place-title-row h3 { margin: 8px 0 0; font-size: clamp(30px, 5vw, 48px); letter-spacing: -.04em; }
.place-stamp { width: 66px; height: 66px; flex: 0 0 auto; display: grid; place-items: center; border: 1px solid var(--primary); border-radius: 50%; color: var(--primary); font: 600 10px/1.2 Georgia, serif; text-align: center; transform: rotate(9deg); }
.culture-line { max-width: 620px; margin: 26px 0 20px; font-size: 18px; font-weight: 600; line-height: 1.65; }
.visit-meta { display: flex; flex-wrap: wrap; gap: 8px; }
.visit-meta span { padding: 7px 12px; border: 1px solid var(--hairline); border-radius: 999px; color: var(--body); background: #fff; font-size: 11px; }
.micro-task { margin-top: 26px; padding-top: 20px; border-top: 1px solid var(--hairline); }
.micro-task small { color: var(--primary); font-size: 11px; font-weight: 600; }
.micro-task p { margin: 8px 0 0; color: var(--body); font-size: 14px; line-height: 1.7; }

.badge-section, .share-section { margin-top: 20px; padding: 34px; border-radius: 24px; display: flex; align-items: center; justify-content: space-between; gap: 28px; }
.badge-section { border: 1px solid var(--hairline); background: rgba(255,255,255,.52); }
.badge-section h3, .share-section h3 { margin: 8px 0 0; font-size: 22px; }
.badge-list { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 10px; }
.badge-list span { padding: 11px 16px; border-radius: 999px; color: #6b5000; background: #fff3c7; font-size: 13px; font-weight: 600; }
.share-section { margin-top: 70px; color: #fff; background: var(--primary); }
.share-section .panel-label { color: #f1bebe; }
.share-section p:last-child { margin: 8px 0 0; color: #f6dcdc; font-size: 12px; }
.share-section .primary-action { color: var(--primary); background: #fff; box-shadow: none; }
.share-section .primary-action i { color: #fff; background: var(--primary); }
.compact-action { min-width: 260px; min-height: 54px; }
.result-actions { margin-top: 22px; display: flex; justify-content: flex-end; gap: 10px; }
.secondary-action { min-height: 48px; padding: 0 20px; border: 1px solid var(--hairline); border-radius: 999px; background: #fff; font-size: 13px; font-weight: 600; }

.share-modal { position: fixed; inset: 0; z-index: 100; padding: 24px; overflow-y: auto; display: grid; place-items: center; background: rgba(26,26,26,.72); backdrop-filter: blur(14px); }
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

@media (max-width: 800px) {
  .place-nav { width: min(100% - 32px, 1120px); min-height: 78px; grid-template-columns: 1fr auto; }
  .nav-progress { position: absolute; left: 0; right: 0; bottom: -13px; }
  .nav-progress span { display: none; }
  .nav-exit { font-size: 0; }
  .nav-exit::after { content: '图鉴 ↗'; font-size: 12px; }
  .intro-shell { width: min(100% - 36px, 1120px); padding: 54px 0 74px; grid-template-columns: 1fr; gap: 60px; }
  .intro-copy h1 { font-size: clamp(74px, 27vw, 116px); }
  .intro-lead { font-size: 24px; }
  .intro-facts { gap: 28px; justify-content: space-between; }
  .specimen-card { min-height: 540px; transform: rotate(0); }
  .question-shell, .today-shell { width: min(100% - 32px, 920px); padding: 62px 0 80px; }
  .question-card h2 { margin-bottom: 30px; font-size: 29px; }
  .answer-option { min-height: 74px; padding: 12px 14px; grid-template-columns: 38px 1fr 18px; }
  .answer-option > span:nth-child(2) { font-size: 14px; }
  .question-footer { align-items: flex-start; gap: 20px; }
  .question-footer > span { max-width: 210px; text-align: right; }
  .today-options, .today-options.compact { grid-template-columns: 1fr; }
  .today-option { min-height: 86px; }
  .result-shell { width: min(100% - 32px, 1120px); padding: 62px 0 90px; }
  .result-heading { margin-bottom: 48px; }
  .result-kicker { margin-top: 38px; }
  .result-grid { grid-template-columns: 1fr; }
  .subtype-panel, .place-panel { min-height: 390px; padding: 26px; }
  .subtype-code { margin-top: 82px; }
  .badge-section, .share-section { padding: 26px; align-items: flex-start; flex-direction: column; }
  .badge-list { justify-content: flex-start; }
  .share-section .primary-action { width: 100%; }
  .result-actions { justify-content: stretch; }
  .result-actions button { flex: 1; }
  .place-footer { width: min(100% - 32px, 1120px); flex-direction: column; justify-content: center; gap: 4px; align-items: flex-start; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; animation: none !important; transition: none !important; }
}
</style>
