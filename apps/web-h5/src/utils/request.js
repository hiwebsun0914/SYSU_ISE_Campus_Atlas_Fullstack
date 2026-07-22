// utils/request.js

// 统一基地址：开发用 /api（交给 Vite 代理），线上用环境变量
const BASE = import.meta.env.VITE_API_BASE || '/api'
const DEFAULT_TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT || 10000)
const DEFAULT_RETRY   = Number(import.meta.env.VITE_API_RETRY   || 0) // 0/1/2...

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
  // 绝对 / 协议相对地址：直接返回（用于 COS 预签名等）
  if (/^https?:\/\//i.test(url) || url.startsWith('//')) return url
  // 其它与 base 合并，去重斜杠
  return `${String(base || '').replace(/\/+$/,'')}/${String(url).replace(/^\/+/,'')}`
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
      // 网关错误页大多是 text/html
      let txt = await resp.text()
      // 尝试解析为 JSON（若本就是 JSON 字符串）
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

export async function request(url, method = 'GET', data = null, options = {}) {
  const {
    headers: extraHeaders,
    timeout      = DEFAULT_TIMEOUT,
    credentials  = 'include',        // ✅ 默认带 Cookie，会话与小程序一致
    cacheBust    = false,
    responseType,                    // 'json' | 'text' | 'blob' | 'response'
    base         = BASE,
    retry        = DEFAULT_RETRY,    // 网络错误/超时重试次数
    rawResponse  = false,
  } = options

  const token = localStorage.getItem('token') || ''
  const headers = {
    'Accept': 'application/json, text/plain, */*',
    'X-Requested-With': 'XMLHttpRequest',
    ...(extraHeaders || {})
  }
  const init = { method: String(method || 'GET').toUpperCase(), headers, credentials }

  // GET -> query；其它 -> JSON body / FormData
  if (init.method === 'GET') {
    if (data) url += qs(data)
    if (cacheBust) url += (url.includes('?') ? '&' : '?') + `_=${Date.now()}`
  } else if (data !== null && data !== undefined && !(data instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(data)
  } else if (data instanceof FormData) {
    // 让浏览器自动设置 multipart 边界
    init.body = data
  }

  if (token) headers['Authorization'] = `Bearer ${token}`

  const finalUrl = joinURL(base, url)

  // 简单重试：仅对网络错误/超时，HTTP 4xx/5xx 不重试
  let attempts = 0
  /* eslint-disable no-constant-condition */
  while (true) {
    attempts++
    try {
      const res = await doFetch(finalUrl, init, { timeout, responseType, rawResponse })
      return res
    } catch (e) {
      if (attempts > retry) {
        return {
          ok: false,
          status: 0,
          statusCode: 0,
          data: { code: -1, message: 'NETWORK_ERROR', error: String(e) }
        }
      }
      // 继续下一次
    }
  }
}

export default request
