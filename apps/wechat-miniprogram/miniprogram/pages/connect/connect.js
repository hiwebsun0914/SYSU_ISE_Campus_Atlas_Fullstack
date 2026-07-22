Page({
  data: {
    systemInfo: {},
    contact: {
      email: 'sunbinhan@xxx.com',
      wechat: 'sunbinhan123'
    }
  },

  onLoad() {
    const info = wx.getSystemInfoSync();
    this.setData({ systemInfo: info });
  },

  goHome() {
    wx.reLaunch({
      url: '/pages/index/index', // ✅ 首页路径，根据你真实页面路径修改
    });
  }
});
