import { CapacitorHttp } from '@capacitor/core'

function isNativeApp() {
  if (typeof window === 'undefined') return false
  const cap = window.Capacitor
  if (cap?.isNativePlatform) return cap.isNativePlatform()
  const protocol = window.location?.protocol || ''
  const host = window.location?.hostname || ''
  return protocol === 'capacitor:' || (protocol === 'https:' && host === 'localhost')
}

function resolveBase() {
  const envBase = String(import.meta.env.VITE_API_BASE || '/api').trim()
  const nativeBase = String(
    import.meta.env.VITE_NATIVE_API_BASE || import.meta.env.VITE_ANDROID_API_BASE || ''
  ).trim()

  if (isNativeApp() && envBase.startsWith('/')) {
    return nativeBase || 'https://hiwebsun.top/api'
  }
  return envBase
}

function isEnvOn(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase())
}

const BASE = resolveBase()
const IS_NATIVE_APP = isNativeApp()
const DEFAULT_TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT || 10000)
const DEFAULT_RETRY = Number(import.meta.env.VITE_API_RETRY || 0)
const DEFAULT_NATIVE_CREDENTIALS =
  String(import.meta.env.VITE_NATIVE_API_CREDENTIALS || 'omit').trim() || 'omit'
const API_DEBUG = isEnvOn(import.meta.env.VITE_API_DEBUG)
const FORCE_X_REQUESTED_WITH = isEnvOn(import.meta.env.VITE_API_FORCE_X_REQUESTED_WITH)

function qs(params = {}) {
  const s = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return
    s.append(k, v)
  })
  const str = s.toString()
  return str ? `?${str}` : ''
}

function joinURL(base, url) {
  if (/^https?:\/\//i.test(url) || url.startsWith('//')) return url
  return `${String(base || '').replace(/\/+$/, '')}/${String(url).replace(/^\/+/, '')}`
}

async function doFetch(finalUrl, init, { timeout, responseType, rawResponse } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('TIMEOUT')), timeout)
  init.signal = controller.signal

  let resp
  try {
    resp = await fetch(finalUrl, init)
  } finally {
    clearTimeout(timer)
  }

  if (rawResponse || responseType === 'response') return resp

  const ct = (resp.headers.get('content-type') || '').toLowerCase()
  let body
  try {
    if (responseType === 'blob') {
      body = await resp.blob()
    } else if (responseType === 'text') {
      body = await resp.text()
    } else if (ct.includes('application/json')) {
      body = await resp.json()
    } else if (resp.status === 204) {
      body = {}
    } else {
      const txt = await resp.text()
      try { body = JSON.parse(txt) } catch { body = txt }
    }
  } catch {
    body = null
  }

  return {
    ok: resp.ok,
    status: resp.status,
    statusCode: resp.status,
    data: body,
    raw: body,
    headers: resp.headers
  }
}

function normalizeNativeBody(data, headers, responseType) {
  if (responseType === 'blob') return data
  if (responseType === 'text') return typeof data === 'string' ? data : JSON.stringify(data ?? '')
  if (data == null) return data
  if (typeof data === 'object') return data

  const ct = String(headers?.['content-type'] || headers?.['Content-Type'] || '').toLowerCase()
  if (ct.includes('application/json') && typeof data === 'string') {
    try { return JSON.parse(data) } catch { return data }
  }
  return data
}

async function doNativeHttp(finalUrl, init, { responseType } = {}) {
  const headers = { ...(init.headers || {}) }
  const method = String(init.method || 'GET').toUpperCase()
  const req = {
    url: finalUrl,
    method,
    headers,
    responseType: responseType === 'blob' ? 'blob' : (responseType === 'text' ? 'text' : 'json'),
  }

  if (method !== 'GET' && init.body !== undefined) {
    if (typeof init.body === 'string') {
      const ct = String(headers['Content-Type'] || headers['content-type'] || '').toLowerCase()
      if (ct.includes('application/json')) {
        try { req.data = JSON.parse(init.body) } catch { req.data = init.body }
      } else {
        req.data = init.body
      }
    } else {
      req.data = init.body
    }
  }

  const resp = await CapacitorHttp.request(req)
  const body = normalizeNativeBody(resp?.data, resp?.headers, responseType)
  const status = Number(resp?.status || 0)

  return {
    ok: status >= 200 && status < 300,
    status,
    statusCode: status,
    data: body,
    raw: body,
    headers: resp?.headers || {}
  }
}

export async function request(url, method = 'GET', data = null, options = {}) {
  const {
    headers: extraHeaders,
    timeout = DEFAULT_TIMEOUT,
    credentials = (IS_NATIVE_APP ? DEFAULT_NATIVE_CREDENTIALS : 'include'),
    cacheBust = false,
    responseType,
    base = BASE,
    retry = DEFAULT_RETRY,
    rawResponse = false,
    debug = API_DEBUG,
    sendRequestedWith = FORCE_X_REQUESTED_WITH || !IS_NATIVE_APP,
  } = options

  const token = localStorage.getItem('token') || ''
  const headers = {
    Accept: 'application/json, text/plain, */*',
    ...(extraHeaders || {})
  }
  if (sendRequestedWith && !headers['X-Requested-With'] && !headers['x-requested-with']) {
    headers['X-Requested-With'] = 'XMLHttpRequest'
  }

  const init = { method: String(method || 'GET').toUpperCase(), headers, credentials }
  const isFormData = data instanceof FormData

  if (init.method === 'GET') {
    if (data) url += qs(data)
    if (cacheBust) url += (url.includes('?') ? '&' : '?') + `_=${Date.now()}`
  } else if (data !== null && data !== undefined && !isFormData) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(data)
  } else if (isFormData) {
    init.body = data
  }

  if (token) headers.Authorization = `Bearer ${token}`

  const finalUrl = joinURL(base, url)

  if (debug) {
    console.info('[request]', {
      method: init.method,
      url: finalUrl,
      native: IS_NATIVE_APP,
      credentials: init.credentials,
      hasAuth: !!token,
      headerKeys: Object.keys(headers),
      hasBody: !!init.body
    })
  }

  let attempts = 0
  while (true) {
    attempts += 1
    try {
      const useNativeHttp =
        IS_NATIVE_APP &&
        !!CapacitorHttp &&
        !rawResponse &&
        !isFormData &&
        responseType !== 'response'

      const res = useNativeHttp
        ? await doNativeHttp(finalUrl, init, { responseType })
        : await doFetch(finalUrl, init, { timeout, responseType, rawResponse })

      if (debug) {
        console.info('[request:response]', {
          method: init.method,
          url: finalUrl,
          status: res?.statusCode,
          ok: res?.ok,
          transport: useNativeHttp ? 'capacitor-http' : 'fetch'
        })
      }
      return res
    } catch (e) {
      if (debug) {
        console.warn('[request:error]', {
          method: init.method,
          url: finalUrl,
          attempt: attempts,
          retry,
          name: e?.name,
          message: e?.message || String(e)
        })
      }
      if (attempts > retry) {
        return {
          ok: false,
          status: 0,
          statusCode: 0,
          data: { code: -1, message: 'NETWORK_ERROR', error: String(e) }
        }
      }
    }
  }
}

export default request
