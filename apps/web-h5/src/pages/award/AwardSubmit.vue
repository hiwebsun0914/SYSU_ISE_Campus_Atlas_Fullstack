<template>
  <div class="submit-page">
    <header class="submit-header">
      <a class="back-link" href="#/award" @click.prevent="router.push('/award')">‹ 返回投稿首页</a>
      <div class="header-inner">
        <div class="header-title">
          <p class="eyebrow"><span></span> SUBMISSION / 作品投稿</p>
          <h1>{{ currentCategory?.name || '作品投稿' }}</h1>
        </div>
        <div class="header-side">
          <span class="deadline" :class="{ closed }">
            <CalendarDays :size="14" aria-hidden="true" />
            {{ closed ? '投稿已截止' : `截止 ${deadlineText}` }}
          </span>
        </div>
      </div>
    </header>

    <main class="submit-main">
      <div v-if="notLoggedIn" class="empty">
        <p>投稿前需要先登录</p>
        <button class="primary-btn" type="button" @click="goSignin">去登录</button>
      </div>

      <form v-else-if="!closed" class="submit-form" @submit.prevent="onSubmitClick">
        <!-- 奖项 -->
        <section class="form-section">
          <h2><span class="step">01</span> 选择奖项</h2>
          <div class="cat-picker">
            <button
              v-for="cat in categories"
              :key="cat.id"
              type="button"
              :class="{ active: form.category === cat.id }"
              :aria-pressed="form.category === cat.id"
              @click="pickCategory(cat.id)"
            >
              <span class="cat-icon" aria-hidden="true">
                <component :is="categoryIcon(cat.id)" :size="20" :stroke-width="1.8" />
              </span>
              <b>{{ cat.name }}</b>
              <small>{{ cat.description }}</small>
              <Check v-if="form.category === cat.id" class="cat-check" :size="15" :stroke-width="2.6" aria-hidden="true" />
            </button>
          </div>
        </section>

        <!-- 作品信息 -->
        <section class="form-section">
          <h2><span class="step">02</span> 作品信息</h2>
          <label class="field">
            <span>作品名称 <em>（{{ title.length }}/30）</em></span>
            <input v-model="form.title" maxlength="30" placeholder="给你的作品起个名字" />
          </label>
          <label class="field">
            <span>作品说明 <em>（{{ description.length }}/500）</em></span>
            <textarea v-model="form.description" maxlength="500" rows="5" placeholder="介绍一下你的创作思路 / 拍摄故事" />
          </label>
          <label class="field">
            <span>对应打卡点</span>
            <select v-model.number="form.locationId">
              <option :value="0" disabled>请选择打卡点</option>
              <option v-for="loc in locations" :key="loc.backendId" :value="Number(loc.backendId)">{{ loc.name }}</option>
            </select>
          </label>
        </section>

        <!-- 图片上传 -->
        <section class="form-section">
          <h2><span class="step">03</span> 上传作品图片 <em>（{{ images.length }}/{{ maxImagesPerWork }}）</em></h2>
          <div class="upload-grid">
            <div v-for="(img, i) in images" :key="img.uid" class="upload-item">
              <img :src="img.preview" :alt="`作品图 ${i + 1}`" />
              <div class="upload-ops">
                <span>{{ img.file.name }} · {{ sizeText(img.file.size) }}</span>
                <button type="button" class="remove-btn" @click="removeImage(img.uid)">删除</button>
              </div>
            </div>

            <button
              v-if="images.length < maxImagesPerWork"
              type="button"
              class="upload-add"
              :disabled="uploading"
              @click="pickFile"
            >
              <Plus :size="26" :stroke-width="1.8" aria-hidden="true" />
              <span>{{ uploading ? '上传中…' : '选择图片' }}</span>
              <small>JPG / PNG / WebP / GIF，单张 ≤ {{ maxImageMB }}MB</small>
            </button>
          </div>
          <p class="tip">支持删除后重新选择；提交前图片只保存在本地预览中。</p>
        </section>

        <p v-if="error" class="form-error" role="alert">{{ error }}</p>

        <div class="form-actions">
          <button class="primary-btn" type="submit" :disabled="submitting || uploading">
            {{ submitting ? '提交中…' : '提交投稿' }}
          </button>
          <span class="hint">提交后由管理员审核，通过后将在作品展示区公开</span>
        </div>
      </form>

      <div v-else class="empty">
        <p>活动已截止，无法进行操作，请耐心期待最终结果公布。</p>
        <button class="ghost-btn" type="button" @click="router.push('/award')">查看作品</button>
      </div>
    </main>

    <!-- 提交成功提示 -->
    <div v-if="successVisible" class="success-mask">
      <div class="success-card">
        <span class="success-icon"><Check :size="26" :stroke-width="2.6" aria-hidden="true" /></span>
        <h2>投稿成功</h2>
        <p>你的作品已提交，等待管理员审核。</p>
        <div class="success-actions">
          <button class="primary-btn" type="button" @click="router.push('/award/my')">查看我的投稿</button>
          <button class="ghost-btn" type="button" @click="router.push('/award')">返回首页</button>
        </div>
      </div>
    </div>

    <!-- 已提交同类别作品提示 -->
    <div v-if="dupModalVisible" class="success-mask">
      <div class="success-card">
        <span class="success-icon warn"><TriangleAlert :size="24" :stroke-width="2.2" aria-hidden="true" /></span>
        <h2>已提交过{{ existingActive?.categoryName }}</h2>
        <p>
          你已提交过{{ existingActive?.categoryName }}（{{ existingStateText }}）。
          每个奖项每人最多投稿 1 个作品，请确认是否选择了正确的类别，或前往删除原有作品后再提交。
        </p>
        <div class="success-actions">
          <button class="primary-btn" type="button" @click="switchCategoryThenClose">换个奖项投稿</button>
          <button class="ghost-btn" type="button" @click="router.push('/award/my')">去删除原有作品</button>
        </div>
      </div>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif"
      hidden
      @change="onFilesChosen"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { request } from '@/utils/request'
import { AWARD_CONFIG } from '@/data/awards'
import { CalendarDays, Camera, Check, Lightbulb, Plus, TriangleAlert } from '@lucide/vue'

const route = useRoute()
const router = useRouter()

const meta = ref(null)
const locations = ref([])
const mine = ref([])
const notLoggedIn = ref(false)

const categories = computed(() => meta.value?.categories || AWARD_CONFIG.categories)
const deadline = computed(() => meta.value?.deadline || AWARD_CONFIG.deadline)
const perUserPerCategory = computed(() => meta.value?.perUserPerCategory ?? AWARD_CONFIG.perUserPerCategory)
const maxImagesPerWork = computed(() => meta.value?.maxImagesPerWork ?? AWARD_CONFIG.maxImagesPerWork)
const maxImageMB = computed(() => meta.value?.maxImageMB ?? AWARD_CONFIG.maxImageMB)
const allowedTypes = computed(() => meta.value?.allowedImageTypes || AWARD_CONFIG.allowedImageTypes)

const closed = computed(() => {
  if (!deadline.value) return false
  return Date.now() > new Date(deadline.value).getTime()
})
const deadlineText = computed(() => {
  try {
    return new Date(deadline.value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
  } catch {
    return deadline.value
  }
})

const form = ref({
  category: String(route.query.category || 'creative'),
  title: '',
  description: '',
  locationId: 0
})
const title = computed(() => form.value.title)
const description = computed(() => form.value.description)
const currentCategory = computed(() => categories.value.find(c => c.id === form.value.category) || null)

function categoryIcon(category) {
  return category === 'photography' ? Camera : Lightbulb
}

const images = ref([])
const uploading = ref(false)
const submitting = ref(false)
const error = ref('')
const successVisible = ref(false)
const dupModalVisible = ref(false)
const fileInput = ref(null)
let uidSeq = 1

const existingActive = computed(() =>
  mine.value.find(item =>
    item.category === form.value.category &&
    (item.status === 'pending' || item.status === 'approved' || (item.status === 'rejected' && item.appealStatus === 'pending'))
  )
)

const existingStateText = computed(() => {
  if (!existingActive.value) return ''
  if (existingActive.value.status === 'approved') return '已通过'
  if (existingActive.value.status === 'pending') return '审核中'
  return '申诉中'
})

function isAuthed() {
  return !!localStorage.getItem('token')
}

function goSignin() {
  router.push({ path: '/signin', query: { redirect: route.fullPath } })
}

function pickCategory(id) {
  form.value.category = id
  error.value = ''
  if (existingActive.value) {
    dupModalVisible.value = true
  }
}

function switchCategory() {
  const other = categories.value.find(c => c.id !== form.value.category)
  if (other) pickCategory(other.id)
}

function sizeText(bytes) {
  const mb = bytes / 1024 / 1024
  if (mb >= 1) return `${mb.toFixed(1)}MB`
  return `${Math.round(bytes / 1024)}KB`
}

function pickFile() {
  fileInput.value?.click()
}

function onFilesChosen(e) {
  const files = Array.from(e.target.files || [])
  e.target.value = ''
  if (!files.length) return

  const maxBytes = maxImageMB.value * 1024 * 1024
  for (const file of files) {
    if (images.value.length >= maxImagesPerWork.value) {
      error.value = `每份作品最多上传 ${maxImagesPerWork.value} 张图片`
      break
    }
    if (!allowedTypes.value.includes(file.type)) {
      error.value = `${file.name} 格式不支持，请使用 JPG / PNG / WebP / GIF`
      continue
    }
    if (file.size > maxBytes) {
      error.value = `${file.name} 超过 ${maxImageMB.value}MB，请压缩后重试`
      continue
    }
    images.value.push({
      uid: `img-${Date.now()}-${uidSeq++}`,
      file,
      preview: URL.createObjectURL(file)
    })
  }
}

function removeImage(uid) {
  const idx = images.value.findIndex(img => img.uid === uid)
  if (idx >= 0) {
    URL.revokeObjectURL(images.value[idx].preview)
    images.value.splice(idx, 1)
  }
}

async function uploadOne(file) {
  // 图片先传给后端，由后端转发到存储桶（不依赖存储桶跨域配置，任何设备都能上传）
  const form = new FormData()
  form.append('file', file)
  const res = await request('/submissions/upload', 'POST', form)
  if (res?.data?.code !== 0) throw new Error(res?.data?.message || '图片上传失败，请重试')
  return { key: res.data.data.key, url: res.data.data.url }
}

async function submit() {
  error.value = ''
  if (existingActive.value) {
    dupModalVisible.value = true
    return
  }
  if (!form.value.title.trim()) {
    error.value = '请填写作品名称'
    return
  }
  if (!form.value.description.trim()) {
    error.value = '请填写作品说明'
    return
  }
  if (!form.value.locationId) {
    error.value = '请选择对应打卡点'
    return
  }
  if (!images.value.length) {
    error.value = '请至少上传一张作品图片'
    return
  }
  submitting.value = true
  uploading.value = true
  try {
    const uploaded = []
    for (const img of images.value) {
      uploaded.push(await uploadOne(img.file))
    }
    uploading.value = false

    const res = await request('/submissions', 'POST', {
      category: form.value.category,
      title: form.value.title.trim(),
      description: form.value.description.trim(),
      locationId: form.value.locationId,
      images: uploaded
    })

    if (res?.data?.code === 0) {
      images.value.forEach(img => URL.revokeObjectURL(img.preview))
      images.value = []
      successVisible.value = true
    } else {
      error.value = res?.data?.message || '提交失败，请重试'
    }
  } catch (e) {
    error.value = e?.message || '提交失败，请重试'
  } finally {
    submitting.value = false
    uploading.value = false
  }
}

function onSubmitClick() {
  if (existingActive.value) {
    dupModalVisible.value = true
    return
  }
  submit()
}

function closeDupModal() {
  dupModalVisible.value = false
}

function switchCategoryThenClose() {
  closeDupModal()
  switchCategory()
}

async function load() {
  if (!isAuthed()) {
    notLoggedIn.value = true
    return
  }
  try {
    const [metaRes, locRes, mineRes] = await Promise.all([
      request('/submissions/meta', 'GET'),
      request('/locations', 'GET'),
      request('/submissions/mine', 'GET')
    ])
    if (metaRes?.data?.code === 0) meta.value = metaRes.data.data
    const list = locRes?.data?.data?.locations || locRes?.data?.locations || []
    locations.value = list
    if (mineRes?.data?.code === 0) mine.value = mineRes.data.list || []
  } catch {
    // 忽略网络错误，页面仍可打开
  }
}

onMounted(() => {
  document.title = '作品投稿 · 打卡作品投稿'
  load()
})
</script>

<style scoped>
.submit-page {
  --ink: #0a2e3b;
  --primary: #0d9488;
  --primary-dark: #08766d;
  --accent: #c7f24a;
  --canvas: #f3f7f5;
  --surface: #ffffff;
  --text: #102a2e;
  --muted: #5e7271;
  --border: #d6e4df;
  min-height: 100vh;
  color: var(--text);
  background-color: var(--canvas);
  background-image:
    linear-gradient(rgba(10, 46, 59, .035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(10, 46, 59, .035) 1px, transparent 1px);
  background-size: 32px 32px;
  font-family: "Noto Sans SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
}

/* 轻量页头：无深色大色块，与其他奖项页面同一语言 */
.submit-header {
  padding: 20px clamp(16px, 4vw, 52px) 26px;
  border-top: 4px solid var(--ink);
  border-bottom: 1px solid var(--border);
  background: rgba(243, 247, 245, .92);
}
.back-link {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  color: var(--muted);
  text-decoration: none;
  font-size: 13px;
  transition: color .2s ease;
}
.back-link:hover { color: var(--primary); }
.header-inner { max-width: 820px; margin: 10px auto 0; display: flex; flex-wrap: wrap; align-items: flex-end; gap: 14px; }
.header-title { flex: 1 1 auto; min-width: 0; }
.eyebrow {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0;
  color: var(--primary-dark);
  font: 700 10px "SFMono-Regular", Menlo, Consolas, monospace;
  letter-spacing: .08em;
}
.eyebrow span { width: 18px; height: 3px; background: var(--accent); box-shadow: 8px 0 0 var(--ink); }
.submit-header h1 {
  margin: 12px 0 0;
  color: var(--ink);
  font-family: "DIN Alternate", "Avenir Next", "Noto Sans SC", sans-serif;
  font-size: clamp(28px, 5.5vw, 40px);
  font-weight: 800;
  line-height: 1.02;
  letter-spacing: -.03em;
}
.header-side { flex: 0 0 auto; }
.deadline {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 13px;
  border: 1px solid #bfd0ca;
  border-radius: 999px;
  background: rgba(255, 255, 255, .72);
  color: var(--ink);
  font: 700 11px "SFMono-Regular", Menlo, Consolas, monospace;
}
.deadline svg { color: var(--primary); }
.deadline.closed { border-color: var(--border); color: var(--muted); }

.submit-main { max-width: 820px; margin: 0 auto; padding: 28px clamp(16px, 4vw, 52px) 100px; }
.submit-form { display: grid; gap: 16px; }
.form-section { padding: 22px; border-radius: 16px; background: var(--surface); border: 1px solid var(--border); }
.form-section h2 {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 0 0 16px;
  color: var(--ink);
  font-size: 17px;
}
.form-section h2 .step {
  color: var(--primary-dark);
  font: 700 11px "SFMono-Regular", Menlo, Consolas, monospace;
  letter-spacing: .06em;
}
.form-section h2 em { color: #8a958f; font-size: 12px; font-style: normal; font-weight: 400; }

.cat-picker { display: grid; grid-template-columns: 1fr; gap: 10px; }
.cat-picker button {
  position: relative;
  display: grid;
  grid-template-columns: 42px 1fr;
  gap: 2px 12px;
  align-items: center;
  text-align: left;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  transition: border-color .18s ease, background .18s ease;
}
.cat-picker button:hover { border-color: #b9cdc6; }
.cat-picker button.active { border-color: var(--primary); background: #f2f8f6; box-shadow: inset 0 0 0 1px var(--primary); }
.cat-icon {
  grid-row: span 2;
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: 14px 5px 14px 5px;
  background: var(--surface);
  color: var(--primary-dark);
}
.cat-picker b { font-size: 14px; color: var(--ink); }
.cat-picker small { grid-column: 2; color: var(--muted); font-size: 11px; line-height: 1.5; }
.cat-check {
  position: absolute;
  top: 10px;
  right: 12px;
  padding: 2px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--ink);
  box-sizing: content-box;
}

.field { display: grid; gap: 8px; margin-top: 16px; }
.field > span { color: #405a5c; font-size: 13px; font-weight: 700; }
.field em { color: #8a958f; font-style: normal; font-size: 11px; font-weight: 400; }
.field input, .field textarea, .field select {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  padding: 12px 14px;
  font-size: 14px;
  color: var(--text);
  outline: none;
  box-sizing: border-box;
  font-family: inherit;
  transition: border-color .18s ease, box-shadow .18s ease;
}
.field input:focus, .field textarea:focus, .field select:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(13, 148, 136, .12); }
.field textarea { resize: vertical; line-height: 1.7; }

.upload-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.upload-item { position: relative; border-radius: 12px; overflow: hidden; background: #eef4f1; border: 1px solid var(--border); }
.upload-item img { width: 100%; height: 150px; object-fit: cover; display: block; }
.upload-ops { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; }
.upload-ops span { font-size: 11px; color: var(--muted); max-width: 70%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.remove-btn { border: 1px solid #e2b6b1; background: transparent; color: #b42318; border-radius: 999px; padding: 4px 10px; font-size: 11px; cursor: pointer; }
.upload-add {
  min-height: 190px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px dashed #a9bfb8;
  border-radius: 12px;
  background: transparent;
  color: #405a5c;
  font-size: 13px;
  cursor: pointer;
  transition: border-color .18s ease, color .18s ease;
}
.upload-add:hover { border-color: var(--primary); color: var(--primary-dark); }
.upload-add svg { color: var(--primary); }
.upload-add small { color: #8a958f; font-size: 11px; }
.upload-add:disabled { opacity: .6; cursor: wait; }
.tip { margin: 10px 0 0; color: #8a958f; font-size: 12px; }

.form-error { margin: 0; padding: 12px 14px; border-radius: 10px; border: 1px solid #f0ccc9; background: #fdf4f3; color: #b42318; font-size: 13px; }
.form-actions { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.hint { color: #8a958f; font-size: 12px; }

/* 主 CTA：酸橙胶囊 + 深青文字；次级操作为描边按钮 */
.primary-btn {
  display: inline-flex;
  min-height: 46px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--accent);
  border-radius: 999px;
  background: var(--accent);
  color: var(--ink);
  padding: 0 26px;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  transition: transform .2s cubic-bezier(.16, 1, .3, 1), background .2s ease;
}
.primary-btn:hover:not(:disabled) { transform: translateY(-2px); background: #d3fa61; }
.primary-btn:active:not(:disabled) { transform: scale(.99); }
.primary-btn:disabled { border-color: var(--border); background: var(--border); color: var(--muted); cursor: wait; }
.ghost-btn {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  border: 1px solid var(--primary);
  border-radius: 999px;
  background: transparent;
  color: var(--primary);
  padding: 0 20px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: background .2s ease, color .2s ease;
}
.ghost-btn:hover { background: var(--primary); color: #fff; }

.empty { padding: 60px 0; text-align: center; color: #8a958f; font-size: 14px; }
.empty p { margin: 0 0 16px; }

.success-mask { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 20px; background: rgba(8, 18, 15, .72); }
.success-card { width: min(380px, 100%); padding: 34px 26px; border: 1px solid var(--border); border-radius: 20px; background: var(--surface); text-align: center; }
.success-icon { width: 58px; height: 58px; display: grid; place-items: center; margin: 0 auto; border-radius: 50%; background: #e6f7ef; color: #0a7a54; }
.success-icon.warn { background: #fff7e6; color: #b45309; }
.success-card h2 { margin: 16px 0 8px; color: var(--ink); font-size: 22px; }
.success-card p { margin: 0 0 22px; color: var(--muted); font-size: 14px; line-height: 1.7; }
.success-actions { display: grid; gap: 10px; }
.success-actions .primary-btn, .success-actions .ghost-btn { width: 100%; }

.back-link:focus-visible,
.primary-btn:focus-visible,
.ghost-btn:focus-visible,
.cat-picker button:focus-visible,
.upload-add:focus-visible,
.remove-btn:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 3px;
  box-shadow: 0 0 0 1px var(--ink);
}

@media (min-width: 720px) {
  .cat-picker { grid-template-columns: repeat(2, 1fr); }
  .upload-grid { grid-template-columns: repeat(3, 1fr); }
}

@media (prefers-reduced-motion: reduce) {
  .back-link, .primary-btn, .ghost-btn, .cat-picker button, .upload-add,
  .field input, .field textarea, .field select { transition: none; }
  .primary-btn:hover:not(:disabled) { transform: none; }
}
</style>
