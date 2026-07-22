import { request } from './request';

function isLoggedIn() {
  try {
    const token = wx.getStorageSync('token');
    return !!token; // 有 token 就算登录
  } catch (e) {
    return false;
  }
}

module.exports = {
  isLoggedIn: () => !!wx.getStorageSync('token')
};

/**
 * 获取当前用户信息，如果没有 token 会跳转登录
 * @param {string} redirect - 登录后返回的页面路径
 * @returns {Promise<Object|null>}
 */
async function getUserInfo(redirect = '') {
  const token = wx.getStorageSync('token');
  if (!token) {
    wx.navigateTo({
      url: `/pages/signin/signin?redirect=${encodeURIComponent(redirect)}`
    });
    return null;
  }

  try {
    const resp = await request('/auth/me', 'GET');
    if (resp.statusCode === 401 || resp.data?.code === 1) {
      wx.navigateTo({
        url: `/pages/signin/signin?redirect=${encodeURIComponent(redirect)}`
      });
      return null;
    }
    const userInfo = resp.data?.userInfo || {};
    wx.setStorageSync('userInfo', { ...(wx.getStorageSync('userInfo') || {}), ...userInfo });
    return userInfo;
  } catch (err) {
    console.error('[getUserInfo] error:', err);
    return null;
  }
}

module.exports = {
  isLoggedIn,
  getUserInfo
};