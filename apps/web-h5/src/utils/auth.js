// src/utils/auth.js
import router from '@/router'
import { request } from '@/utils/request'

const TOKEN_KEY = 'token'
const USERINFO_KEY = 'userInfo'

// --- 本地存取 ---
export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token || '')
}
export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

// 是否已登录（有 token 即认为已登录）
export function isLoggedIn() {
  return !!getToken()
}

function goSignin(redirect) {
  // 如果没传 redirect，就用当前地址
  const back = redirect || window.location.pathname + window.location.search
  router.push({ path: '/signin', query: { redirect: back } })
}

/**
 * 获取当前用户信息；无 token 或 401 会跳登录页
 * @param {string} redirect 登录后返回的页面路径，可选
 * @returns {Promise<object|null>}
 */
export async function getUserInfo(redirect = '') {
  const token = getToken()
  if (!token) {
    goSignin(redirect)
    return null
  }

  try {
    // 结合你的后端协议调整
    const data = await request({ url: '/auth/me', method: 'GET' })
    // 约定：未登录/过期时后端返回 code === 1（可按你实际调整）
    if (data?.code === 1) {
      goSignin(redirect)
      return null
    }

    const userInfo = data?.userInfo || {}
    const old = JSON.parse(localStorage.getItem(USERINFO_KEY) || '{}')
    localStorage.setItem(USERINFO_KEY, JSON.stringify({ ...old, ...userInfo }))
    return userInfo
  } catch (e) {
    // axios 的 401
    if (e?.response?.status === 401) {
      goSignin(redirect)
      return null
    }
    console.error('[getUserInfo] error:', e)
    return null
  }
}

// 同时导出默认对象，便于 `import auth from '@/utils/auth'`
export default { isLoggedIn, getUserInfo, setToken, getToken, clearToken }
