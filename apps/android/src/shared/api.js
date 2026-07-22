import axios from 'axios'

function isNativeApp() {
  if (typeof window === 'undefined') return false
  const cap = window.Capacitor
  if (cap?.isNativePlatform) return cap.isNativePlatform()
  const protocol = window.location?.protocol || ''
  const host = window.location?.hostname || ''
  return protocol === 'capacitor:' || (protocol === 'https:' && host === 'localhost')
}

function isEnvOn(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase())
}

function resolveBaseURL() {
  const envBase = String(import.meta.env.VITE_API_BASE || '/api').trim()
  const nativeBase = String(
    import.meta.env.VITE_NATIVE_API_BASE || import.meta.env.VITE_ANDROID_API_BASE || ''
  ).trim()

  if (isNativeApp() && envBase.startsWith('/')) {
    return nativeBase || 'https://hiwebsun.top/api'
  }
  return envBase
}

const NATIVE = isNativeApp()
const API_DEBUG = isEnvOn(import.meta.env.VITE_API_DEBUG)
const WITH_CREDENTIALS = NATIVE
  ? isEnvOn(import.meta.env.VITE_NATIVE_API_WITH_CREDENTIALS)
  : true

const api = axios.create({
  baseURL: resolveBaseURL(),
  timeout: 15000,
  withCredentials: WITH_CREDENTIALS,
})

if (!NATIVE && !isEnvOn(import.meta.env.VITE_API_FORCE_X_REQUESTED_WITH)) {
  // no-op: keep browser defaults
}
if (NATIVE && !isEnvOn(import.meta.env.VITE_API_FORCE_X_REQUESTED_WITH)) {
  delete api.defaults.headers.common['X-Requested-With']
}

if (API_DEBUG) {
  api.interceptors.request.use((config) => {
    const method = String(config.method || 'GET').toUpperCase()
    const baseURL = config.baseURL || ''
    const url = config.url || ''
    const finalUrl = /^https?:\/\//i.test(String(url)) ? url : `${String(baseURL).replace(/\/$/, '')}/${String(url).replace(/^\//, '')}`
    console.info('[axios:request]', {
      method,
      url: finalUrl,
      native: NATIVE,
      withCredentials: !!config.withCredentials,
      hasAuth: !!(config.headers && (config.headers.Authorization || config.headers.authorization)),
      headerKeys: Object.keys(config.headers || {})
    })
    return config
  })
}

api.interceptors.response.use(
  (r) => {
    if (API_DEBUG) {
      console.info('[axios:response]', {
        status: r.status,
        url: r.config?.url,
        method: String(r.config?.method || 'GET').toUpperCase()
      })
    }
    return r.data
  },
  (e) => {
    if (API_DEBUG) {
      console.warn('[axios:error]', {
        status: e?.response?.status,
        url: e?.config?.url,
        method: String(e?.config?.method || 'GET').toUpperCase(),
        message: e?.message || String(e)
      })
    }
    return Promise.reject(e)
  }
)

export default api
