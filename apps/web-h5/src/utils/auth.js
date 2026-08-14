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
  // Hash 路由下 window.location.pathname 通常只有 “/”，应从路由实例读取完整地址。
  const currentPath = router.currentRoute.value.fullPath
  const back = redirect || (currentPath === '/signin' ? '/' : currentPath)
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
    const response = await request('/auth/me', 'GET', null, { cacheBust: true })
    const data = response?.data || {}
    const unauthorized = response?.status === 401
      || response?.status === 403
      || data?.code === 1

    if (unauthorized) {
      clearToken()
      localStorage.removeItem(USERINFO_KEY)
      goSignin(redirect)
      return null
    }

    if (!response?.ok || data?.code !== 0) {
      console.warn('[getUserInfo] request failed:', data?.message || response?.status || 'NETWORK_ERROR')
      return null
    }

    const userInfo = data?.userInfo || data?.data?.userInfo || null
    if (!userInfo) return null
    const old = JSON.parse(localStorage.getItem(USERINFO_KEY) || '{}')
    localStorage.setItem(USERINFO_KEY, JSON.stringify({ ...old, ...userInfo }))
    return userInfo
  } catch (e) {
    console.error('[getUserInfo] error:', e)
    return null
  }
}

// 同时导出默认对象，便于 `import auth from '@/utils/auth'`
export default { isLoggedIn, getUserInfo, setToken, getToken, clearToken }
