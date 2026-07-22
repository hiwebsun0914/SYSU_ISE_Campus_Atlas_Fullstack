// pages/rank/rank.js
import { request } from '../../utils/request';

const DEFAULT_AVATAR = 'https://img.yzcdn.cn/vant/user-active.png';

// 安全数值化
const n = (v, d = 0) => {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string' && /^\d+$/.test(v)) return Number(v);
  return d;
};

Page({
  data: {
    loading: true,
    list: [] // [{userId, username, avatar, unlocked, locking, count, createdAt, updatedAt, rank, rankClass, me}]
  },

  onShow() {
    this.fetchRank();
  },

  onPullDownRefresh() {
    this.fetchRank().finally(() => wx.stopPullDownRefresh());
  },

  async fetchRank() {
    this.setData({ loading: true });

    try {
      // 1) 优先从后端拿
      const resp = await request('/rank/list', 'GET');
      let list = (resp.statusCode === 200 && resp.data?.code === 0 && Array.isArray(resp.data.list))
        ? resp.data.list
        : null;

      // 3) 统一字段 & 计算 count；补齐时间戳
      list = list.map(it => {
        const unlocked = n(it.unlocked, 0);
        const locking  = n(it.locking, 0);
        const count    = ('count' in it) ? n(it.count, unlocked + locking) : (unlocked + locking);
        return {
          ...it,
          avatar   : it.avatar || DEFAULT_AVATAR,
          unlocked,
          locking,
          count,
          createdAt: it.createdAt,
          updatedAt: it.updatedAt,
        };
      });

      // 4) 排序逻辑：
      //    ① 打卡总计(count) — 降序
      //    ② 上次打卡时间(updatedAt) — 升序
      //    ③ 注册时间(createdAt) — 升序
      //    ④ 用户名稳定排序，避免抖动
      list.sort((a, b) =>
        (b.count - a.count) ||
        (a.updatedAt - b.updatedAt) ||
        (a.createdAt - b.createdAt) ||
        String(a.username || '').localeCompare(String(b.username || ''), 'zh')
      );

      // 5) 标注 Top3 样式 + 高亮“我”
      const myId = (wx.getStorageSync('userInfo') || {}).id;
      list = list.map((it, idx) => ({
        ...it,
        rank: idx + 1,
        rankClass: idx === 0 ? 'first' : idx === 1 ? 'second' : idx === 2 ? 'third' : '',
        me: myId && it.userId === myId
      }));

      this.setData({ list, loading: false });
    } catch (e) {
      console.error('[rank] fetch error', e);
      wx.showToast({ icon: 'none', title: '加载失败' });
      this.setData({ loading: false });
    }
  }
});
