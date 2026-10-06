import { seasons } from './seasons'
import { computed, ref } from 'vue'
import { activityDeadline } from './activityDeadline'
import { request } from '@/utils/request'

export const REVEAL_AT = '2026-09-19T18:00:00+08:00'
const START_AT = Date.parse('2026-09-17T00:00:00+08:00')
const END_AT = Date.parse(REVEAL_AT)
const role = ref('visitor')
const roleReady = ref(false)
const allowedPreview = new Set(['live', 'sealed', 'owner', 'revealed'])
const initialPreview = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('resultPreview') : ''
const preview = ref(import.meta.env.DEV ? (allowedPreview.has(initialPreview) ? initialPreview : 'live') : '')
let rolePromise = null

export const previewMode = preview
export const resultEmbargoed = computed(() => {
  if (import.meta.env.DEV && preview.value !== 'live') return preview.value === 'sealed'
  const now = activityDeadline.now.value
  return now >= Date.parse(seasons.config?.deadline || '2026-09-17T00:00:00+08:00') && now < Date.parse(seasons.config?.revealAt || REVEAL_AT) && (!roleReady.value || role.value !== 'owner')
})

export async function refreshResultRole() {
  if (rolePromise) return rolePromise
  roleReady.value = false
  rolePromise = (async () => {
    if (!localStorage.getItem('token')) {
      role.value = 'visitor'
      return
    }
    const response = await request('/auth/me', 'GET', null, { cacheBust: true })
    role.value = response?.ok && response?.data?.code === 0 ? response.data.userInfo?.role || 'visitor' : 'visitor'
  })().catch(() => { role.value = 'visitor' }).finally(() => {
    roleReady.value = true
    rolePromise = null
  })
  return rolePromise
}

export function setPreviewMode(value) {
  if (import.meta.env.DEV && allowedPreview.has(value)) {
    preview.value = value
    const url = new URL(window.location.href)
    if (value === 'live') url.searchParams.delete('resultPreview')
    else url.searchParams.set('resultPreview', value)
    window.history.replaceState(null, '', url)
  }
}

export const EMBARGO_MESSAGE = '结果将于 9 月 19 日 18:00 公布'
