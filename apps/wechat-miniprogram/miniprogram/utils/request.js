const API_BASE = 'https://sysuzgxytj.top/api';
let loading;
let loadedFor = '';
export const seasonState = { ready: false, selected: '', current: '', list: [], config: null };
function accountKey() { return String(wx.getStorageSync('userInfo')?.id || 'guest'); }
export function activityCacheKey(name) { return `${name}:${accountKey()}:${seasonState.selected}`; }
function raw(url, method, data, header = {}) {
  const token = wx.getStorageSync('token');
  return new Promise((resolve, reject) => wx.request({
    url: /^https?:\/\//i.test(url) ? url : API_BASE + (url.startsWith('/') ? url : '/' + url),
    method, data, header: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...header },
    success: resolve, fail: reject
  }));
}
export async function ensureSeasons() {
  const owner = accountKey();
  if (seasonState.ready && loadedFor === owner) return;
  if (loadedFor !== owner) seasonState.ready = false;
  if (loading) return loading;
  loading = (async () => {
    const r = await raw('/seasons', 'GET', {});
    if (r.statusCode !== 200 || r.data?.code !== 0) throw new Error(r.data?.message || '活动期读取失败');
    seasonState.current = r.data.currentSeasonId; seasonState.list = r.data.list;
    seasonState.selected = seasonState.current;
    if (!seasonState.selected || !seasonState.list.some(x => x.seasonId === seasonState.selected)) throw new Error('账号尚未绑定新生届次');
    const config = await raw('/seasons/config', 'GET', {}, { 'X-Season-Id': seasonState.selected });
    if (config.data?.code !== 0) throw new Error('活动配置读取失败');
    seasonState.config = config.data.data;
    wx.removeStorageSync('checkinRecords');
    const user = { ...(wx.getStorageSync('userInfo') || {}) };
    for (const field of ['points','pointsUpdatedAt','unlockedLocations','lockingLocations','completedRoutes','checkinRecords','pendingCheckins','checkinReviewRecords']) delete user[field];
    wx.setStorageSync('userInfo', user);
    seasonState.ready = true;
    loadedFor = owner;
  })().finally(() => { loading = null; });
  return loading;
}
export function selectSeason(id) {
  wx.setStorageSync(`selectedSeason:${accountKey()}`, { id, current: seasonState.current });
  seasonState.ready = false; seasonState.selected = id;
  wx.reLaunch({ url: '/pages/seasons/seasons' });
}
export async function request(url, method = 'GET', data = {}, header = {}) {
  await ensureSeasons();
  const scope = `${accountKey()}:${seasonState.selected}`;
  const response = await raw(url, method, data, { 'X-Season-Id': seasonState.selected, ...header });
  if (scope !== `${accountKey()}:${seasonState.selected}`) throw new Error('STALE_SEASON_RESPONSE');
  return response;
}
export default request;
