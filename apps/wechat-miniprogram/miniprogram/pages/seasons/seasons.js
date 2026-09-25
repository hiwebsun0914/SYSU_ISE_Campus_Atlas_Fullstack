import { request, ensureSeasons, seasonState, selectSeason } from '../../utils/request';
Page({
  data: { list: [], index: 0, mine: null, records: [], routes: [], error: '', loading: true },
  onLoad() { this.load(); },
  async load() {
    try {
      await ensureSeasons();
      this.setData({ list: seasonState.list, index: seasonState.list.findIndex(x => x.seasonId === seasonState.selected) });
      const res = await request('/seasons/mine');
      if (res.data?.code !== 0) throw new Error(res.data?.message || '请先登录');
      const mine = res.data.data, p = mine.progress, config = seasonState.config;
      const records = [...p.checkinRecords.map(x => ({ ...x, status: '已通过' })), ...p.pendingCheckins.map(x => ({ ...x, status: '待审核' })), ...p.checkinReviewRecords.filter(x => x.status !== 'approved').map(x => ({ ...x, status: x.status === 'rejected' ? '已驳回' : x.status }))].map(x => ({ ...x, name: config.locations.find(l => Number(l.backendId) === Number(x.locationId))?.name || `地点 ${x.locationId}` }));
      this.setData({ mine, records, routes: p.completedRoutes.map(id => config.routes.find(r => r.id === id)?.name || id), error: '' });
    } catch (e) { this.setData({ error: e.message || '记录读取失败' }); }
    finally { this.setData({ loading: false }); }
  },
  changeSeason(e) { selectSeason(this.data.list[Number(e.detail.value)].seasonId); },
  previewPhoto(e) { const url = e.currentTarget.dataset.url; if (url) wx.previewImage({ current: url, urls: [url] }); }
});
