<template>
  <div class="submit-page">
    <header class="submit-header">
      <a class="back-link" href="#/award" @click.prevent="router.push('/award')">‹ 返回投稿首页</a>
      <h1>{{ currentCategory?.name || '作品投稿' }}</h1>
      <span class="deadline" :class="{ closed }">
        {{ closed ? '投稿已截止' : `截止 ${deadlineText}` }}
      </span>
    </header>

    <main class="submit-main">
      <div v-if="notLoggedIn" class="empty">
        <p>投稿前需要先登录</p>
        <button class="primary-btn" type="button" @click="goSignin">去登录</button>
      </div>

      <form v-else-if="!closed" class="submit-form" @submit.prevent="onSubmitClick">
        <!-- 奖项 -->
        <section class="form-section">
          <h2>1. 选择奖项</h2>
          <div class="cat-picker">
            <button
              v-for="cat in categories"
              :key="cat.id"
              type="button"
              :class="{ active: form.category === cat.id }"
              @click="pickCategory(cat.id)"
            >
              <span class="cat-icon">{{ cat.icon }}</span>
              <b>{{ cat.name }}</b>
              <small>{{ cat.description }}</small>
            </button>
          </div>
        </section>

        <!-- 作品信息 -->
        <section class="form-section">
          <h2>2. 作品信息</h2>
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
              <option v-for="loc in locations" :key="loc.id" :value="Number(loc.id)">{{ loc.name }}</option>
            </select>
          </label>
        </section>

        <!-- 图片上传 -->
        <section class="form-section">
          <h2>3. 上传作品图片 <em>（{{ images.length }}/{{ maxImagesPerWork }}）</em></h2>
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
              <span class="plus">＋</span>
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
        <span class="success-icon">✓</span>
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
        <span class="success-icon warn">!</span>
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
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const sign = await request('/submissions/presign', 'POST', { ext })
  if (sign?.data?.code !== 0) throw new Error(sign?.data?.message || '获取上传地址失败')
  const { key, putUrl } = sign.data.data

  const put = await fetch(putUrl, {
    method: 'PUT',
    mode: 'cors',
    headers: { 'Content-Type': file.type || 'image/jpeg' },
    body: file
  })
  if (!put.ok) throw new Error(`图片上传失败（HTTP ${put.status}）`)

  const commit = await request('/submissions/commit', 'POST', { key, size: file.size })
  if (commit?.data?.code !== 0) throw new Error(commit?.data?.message || '确认上传失败')
  return { key, url: commit.data.data.url }
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
.submit-page { min-height: 100vh; color: #17231e; background: #f6f4ef; font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif; }
.submit-header { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 24px clamp(16px, 4vw, 52px); background: #102a2e; color: #fff; }
.back-link { color: rgba(255,255,255,.7); text-decoration: none; font-size: 13px; }
.submit-header h1 { margin: 0; font-size: 22px; flex: 1; }
.deadline { font-size: 12px; color: #c7f24a; background: rgba(199,242,74,.12); padding: 6px 12px; border-radius: 999px; }
.deadline.closed { color: rgba(255,255,255,.75); background: rgba(255,255,255,.1); }

.submit-main { max-width: 820px; margin: 0 auto; padding: 26px clamp(16px, 4vw, 52px) 100px; }
.submit-form { display: grid; gap: 20px; }
.form-section { padding: 22px; border-radius: 16px; background: #fff; border: 1px solid #e8e4da; }
.form-section h2 { margin: 0 0 16px; font-size: 17px; }
.form-section h2 em { color: #8a958f; font-size: 12px; font-style: normal; font-weight: 400; }

.cat-picker { display: grid; grid-template-columns: 1fr; gap: 10px; }
.cat-picker button { display: grid; grid-template-columns: 40px 1fr; gap: 2px 10px; align-items: center; text-align: left; padding: 14px; border: 1px solid #e2e0d8; border-radius: 12px; background: #faf9f5; color: #17231e; cursor: pointer; }
.cat-picker button.active { border-color: #0d9488; background: #f0faf7; box-shadow: inset 0 0 0 1px #0d9488; }
.cat-icon { grid-row: span 2; width: 40px; height: 40px; display: grid; place-items: center; border-radius: 12px 4px 12px 4px; background: #e9f0ec; font-size: 18px; }
.cat-picker b { font-size: 14px; }
.cat-picker small { grid-column: 2; color: #7b857f; font-size: 11px; line-height: 1.5; }

.field { display: grid; gap: 8px; margin-top: 16px; }
.field > span { color: #49584f; font-size: 13px; }
.field em { color: #8a958f; font-style: normal; font-size: 11px; }
.field input, .field textarea, .field select { width: 100%; border: 1px solid #d8d4c9; border-radius: 10px; background: #fff; padding: 12px 14px; font-size: 14px; color: #17231e; outline: none; box-sizing: border-box; font-family: inherit; }
.field input:focus, .field textarea:focus, .field select:focus { border-color: #0d9488; box-shadow: 0 0 0 3px rgba(13,148,136,.12); }
.field textarea { resize: vertical; line-height: 1.7; }

.upload-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.upload-item { position: relative; border-radius: 12px; overflow: hidden; background: #f1efe8; border: 1px solid #e2e0d8; }
.upload-item img { width: 100%; height: 150px; object-fit: cover; display: block; }
.upload-ops { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; }
.upload-ops span { font-size: 11px; color: #7b857f; max-width: 70%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.remove-btn { border: 1px solid #e2b6b1; background: transparent; color: #b42318; border-radius: 999px; padding: 4px 10px; font-size: 11px; cursor: pointer; }
.upload-add { min-height: 190px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; border: 1px dashed #b9c4bd; border-radius: 12px; background: #faf9f5; color: #49584f; cursor: pointer; }
.upload-add .plus { font-size: 30px; line-height: 1; color: #0d9488; }
.upload-add small { color: #8a958f; font-size: 11px; }
.upload-add:disabled { opacity: .6; cursor: wait; }
.tip { margin: 10px 0 0; color: #8a958f; font-size: 12px; }

.form-error { margin: 0; padding: 12px 14px; border-radius: 10px; background: #fdeeee; color: #b42318; font-size: 13px; }
.form-actions { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.hint { color: #8a958f; font-size: 12px; }
.primary-btn { border: 0; background: #0d9488; color: #fff; padding: 12px 26px; border-radius: 999px; font-size: 14px; font-weight: 800; cursor: pointer; }
.primary-btn:disabled { background: #b5c9c4; cursor: wait; }
.ghost-btn { border: 1px solid #0d9488; background: transparent; color: #0d9488; padding: 11px 20px; border-radius: 999px; font-size: 13px; cursor: pointer; }

.notice-card { padding: 26px; border-radius: 16px; background: #fff; border: 1px solid #e8e4da; text-align: center; }
.notice-card h3 { margin: 0 0 8px; font-size: 19px; }
.notice-card p { margin: 0 0 18px; color: #5f6d66; font-size: 14px; }
.notice-actions { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }

.empty { padding: 60px 0; text-align: center; color: #8a958f; }
.empty p { margin: 0 0 16px; }

.success-mask { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 20px; background: rgba(8,18,15,.72); }
.success-card { width: min(380px, 100%); padding: 34px 26px; border-radius: 20px; background: #fff; text-align: center; }
.success-icon { width: 58px; height: 58px; display: grid; place-items: center; margin: 0 auto; border-radius: 50%; background: #e6f7ef; color: #0a7a54; font-size: 26px; font-weight: 800; }
.success-icon.warn { background: #fff7e6; color: #b45309; }
.success-card h2 { margin: 16px 0 8px; font-size: 22px; }
.success-card p { margin: 0 0 22px; color: #5f6d66; font-size: 14px; }
.success-actions { display: grid; gap: 10px; }

@media (min-width: 720px) {
  .cat-picker { grid-template-columns: repeat(2, 1fr); }
  .upload-grid { grid-template-columns: repeat(3, 1fr); }
}
</style>
