// utils/request.js
const API_BASE = 'https://sysuzgxytj.top/api';

function buildUrl(url) {
  if (/^https?:\/\//i.test(url)) return url;
  return API_BASE + (url.startsWith('/') ? url : '/' + url);
}

export function request(url, method = 'GET', data = {}, header = {}) {
  const token = wx.getStorageSync?.('token'); // 小程序环境下可用，H5 可自行替换
  return new Promise((resolve, reject) => {
    wx.request({
      url: buildUrl(url),
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...header
      },
      success: res => resolve(res),
      fail: err => reject(err)
    });
  });
}

export default request;
