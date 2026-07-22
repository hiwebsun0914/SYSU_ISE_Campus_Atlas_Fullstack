import { request } from './utils/request';
App({
  onLaunch() {
    const token = wx.getStorageSync('token');
    if (!token) return;                    // 没 token 不去自检
    request('/auth/me','GET').then(res=>{
      if(res.data?.code===0){
        wx.setStorageSync('userInfo',res.data.userInfo);
      }else{
        wx.clearStorageSync();             // 401 时清缓存
      }
    }).catch(()=>wx.clearStorageSync());
  }
});
