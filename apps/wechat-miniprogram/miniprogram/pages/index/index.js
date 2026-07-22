// pages/index/index.js

import reqDefault, { request as reqNamed } from '../../utils/request';
const request = typeof reqNamed === 'function' ? reqNamed
               : typeof reqDefault === 'function' ? reqDefault
               : null;
if (!request) console.error('[utils/request] 未找到可用的 request 函数');

const imgCache = require('../../utils/imageCache');

// ===== COS：缩略图 / 大图 / 原图 =====
const toThumb = (url) => `${url}${url.includes('?') ? '&' : '?'}imageMogr2/thumbnail/480x/format/webp/quality/75`;
const toFull  = (url) => `${url}${url.includes('?') ? '&' : '?'}imageMogr2/thumbnail/1440x/format/webp/quality/80`;
const stripCI = (u='') =>
  String(u)
    // 去除常见云处理参数：七牛/腾讯CI/阿里OSS
    .replace(/(\?|&)(imageMogr2|imageView2|image-process|x-oss-process|ci-process)=[^#&]*/gi, '')
    .replace(/[?&]$/, '');
const toOrigin = (url) => stripCI(url); // 去除一切图像处理参数，拿真正原图

// 批大小与批间隔（地点列表）
const BATCH_SIZE = 5;
const BATCH_GAP_MS = 200;

// 地图照片兜底（请放清晰大图）
const MAP_FALLBACK_URL = 'https://sysuzngcxy-1322240898.cos.ap-guangzhou.myqcloud.com/map.jpg';

Page({
  data: {
    // —— 顶部相册（来自 /home/gallery）——
    images: [],                 // 本地缓存路径数组（直接缓存大图/原图）
    current: 0,
    viewerVisible: false,

    // —— 侧边栏 —— 
    sidebarVisible: false,

    // —— 地点列表：文字先显 + 骨架，图片异步 —— 
    locations: [],
    showList: true,

    // —— 地图“照片”弹层（来自 /home/gallery）——
    mapVisible: false,
    mapPhotoLocal: '',          // 本地缓存（直接缓存原图）
    // 可选：如需预览远端原图，可加 mapPhotoRemote

    // —— 状态 —— 
    _inited: false,
  },

  // 非 data
  _allLocations: [],
  _nextIndex: 0,
  _observer: null,
  _prefetching: false,

  onLoad() {
    if (this.data._inited) return;
    this.setData({ _inited: true, showList: true });
    try { imgCache.enableDebug?.(false); } catch {}
    try { imgCache.cleanupByAge?.(45); } catch {}
    this.bootstrap();
  },
  onUnload() { this._destroyObserver(); },

  async bootstrap() {
    // 地点列表：先渲染文字+骨架，图片异步分批
    await this._fetchAllLocations();
    this._renderFirstBatchSkeleton();                   // 文字+骨架立显
    this._ensureObserver();                             // 进入视口再拉大图
    this._kickoffThumbDownloadsForRange(0, BATCH_SIZE); // 异步拉首批缩略图
    this._scheduleNextBatch();                          // 后台分批继续

    // 顶部相册/地图：点击再拉，不占首屏带宽；且 /home/gallery 一律拿大图/原图
  },

  /* ===================== 列表：数据与分批图片 ===================== */
  async _fetchAllLocations() {
    try {
      const resp = await request('/locations', 'GET');
      const list = resp?.data?.data?.locations || resp?.data?.locations || [];
      this._allLocations = Array.isArray(list) ? list : [];
      this._nextIndex = 0;
    } catch (e) {
      console.error('[locations] fetch error:', e);
      this._allLocations = []; this._nextIndex = 0;
    }
  },

  _wrapSkeleton(it) {
    return {
      ...it,
      imageThumbLocal: '',
      imageFullLocal: '',
      expanded: false,
      __skeleton: true,
      __isOriginFull: false, // 标记 imageFullLocal 是否为“原图”
    };
  },

  _renderFirstBatchSkeleton() {
    const first = this._allLocations.slice(0, BATCH_SIZE).map(it => this._wrapSkeleton(it));
    this.setData({ locations: first });
    this._nextIndex = Math.min(BATCH_SIZE, this._allLocations.length);
  },

  _scheduleNextBatch() {
    if (this._prefetching) return;
    if (this._nextIndex >= this._allLocations.length) return;

    this._prefetching = true;
    setTimeout(async () => {
      const from = this._nextIndex;
      const to = Math.min(this._nextIndex + BATCH_SIZE, this._allLocations.length);

      // 1) 文字+骨架先插入（不等图片）
      const skeletons = this._allLocations.slice(from, to).map(it => this._wrapSkeleton(it));
      this.setData({ locations: this.data.locations.concat(skeletons) });
      this._nextIndex = to;
      this._ensureObserver();

      // 2) 再异步拉缩略图并就地替换（地点：先缩略）
      await this._kickoffThumbDownloadsForRange(from, to);

      this._prefetching = false;
      if (this._nextIndex < this._allLocations.length) this._scheduleNextBatch();
    }, BATCH_GAP_MS);
  },

  async _kickoffThumbDownloadsForRange(from, to) {
    const slice = this._allLocations.slice(from, to);
    await Promise.allSettled(slice.map(async (it) => {
      if (!it?.image) return;
      const thumb = await imgCache.get(toThumb(it.image));
      const idx = (this.data.locations || []).findIndex(x => x.id === it.id);
      if (idx === -1) return;
      const updated = [...this.data.locations];
      const old = updated[idx];
      updated[idx] = { ...old, imageThumbLocal: thumb, __skeleton: false };
      this.setData({ locations: updated });
    }));
  },

  // 进入视口再拉“大图”（1440）——省流；点击时再拉“原图”
  async _loadFullForItem(id, url) {
    const idx = this.data.locations.findIndex(x => x.id === id);
    if (idx === -1) return;
    const item = this.data.locations[idx];
    if (!url || item.imageFullLocal || !item.imageThumbLocal) return;
    try {
      const full = await imgCache.get(toFull(url)); // 列表滚动用 1440 大图
      const updated = [...this.data.locations];
      updated[idx] = { ...item, imageFullLocal: full, __isOriginFull: false };
      this.setData({ locations: updated });
    } catch (err) { console.warn('[full] fail', id, err); }
  },

  _ensureObserver() {
    try { this._observer && this._observer.disconnect(); } catch {}
    this._observer = this.createIntersectionObserver({ thresholds: [0, 0.01, 0.2] });
    this._observer.relativeToViewport({ bottom: 200 }).observe('.js-card', (res) => {
      const id = Number(res?.dataset?.id);
      if (!id) return;
      const item = (this.data.locations || []).find(x => x.id === id);
      if (!item) return;
      if (item.image && !item.imageFullLocal && item.imageThumbLocal) {
        this._loadFullForItem(id, item.image);
      }
    });
  },
  _destroyObserver() { try { this._observer && this._observer.disconnect(); } catch {}; this._observer = null; },

  /* ===================== 点击强制拉“原图”（地点） ===================== */
  async _ensureFullLocalById(id) {
    const idx = (this.data.locations || []).findIndex(x => x.id === id);
    if (idx === -1) return '';
    const item = this.data.locations[idx];

    // 已经有原图
    if (item.imageFullLocal && item.__isOriginFull) return item.imageFullLocal;

    // 原始远端 URL（来自后端 it.image）
    const originUrl = toOrigin(item.image || '');
    if (!originUrl) return item.imageFullLocal || item.imageThumbLocal || '';

    try {
      // 拉真正原图并缓存
      const fullLocal = await imgCache.get(originUrl);
      const updated = [...this.data.locations];
      updated[idx] = { ...item, imageFullLocal: fullLocal, __isOriginFull: true };
      this.setData({ locations: updated });
      return fullLocal;
    } catch (e) {
      console.warn('[origin] 获取失败，退化到大图', e);
      // 退化：用 1440；再不行用缩略图
      try {
        const bigLocal = await imgCache.get(toFull(item.image));
        const updated = [...this.data.locations];
        updated[idx] = { ...item, imageFullLocal: bigLocal, __isOriginFull: false };
        this.setData({ locations: updated });
        return bigLocal;
      } catch {
        return item.imageThumbLocal || '';
      }
    }
  },

  /* ===================== 顶部相册：严格来自 /home/gallery，直接拿大图/原图 ===================== */
  async loadGallery() {
    try {
      const resp = await request('/home/gallery', 'GET');
      const list = resp?.data?.data?.images || resp?.data?.images || [];
      // 兼容字符串或对象（{full|url|thumb}）
      const getUrl = (x) => {
        if (!x) return '';
        if (typeof x === 'string') return x;
        return x.full || x.url || x.thumb || '';
      };
      // 直接转“原图”URL（剥掉任何缩略处理）
      const urls = (Array.isArray(list) ? list : []).slice(0, 6)
        .map(getUrl)
        .filter(Boolean)
        .map(toOrigin);

      // 直接缓存原图/大图
      const local = await Promise.all(urls.map(u => imgCache.get(u)));
      this.setData({ images: local });
      if (local.length === 0) console.warn('[gallery] 后端未返回图片或字段为空');
    } catch (e) {
      console.error('loadGallery error:', e);
      this.setData({ images: [] });
    }
  },
  async ensureGalleryLoaded() {
    if (!this.data.images || this.data.images.length === 0) {
      await this.loadGallery();
    }
  },
  async openViewer() {
    await this.ensureGalleryLoaded(); // ✅ 只用 /home/gallery 的图（原图/大图）
    const list = this.data.images || [];
    if (list.length === 0) {
      wx.showToast({ icon: 'none', title: '相册暂无图片' });
      return;
    }
    this.setData({ viewerVisible: true, current: 0 });
  },
  closeViewer() { this.setData({ viewerVisible: false }); },
  onSwiperChange(e) { this.setData({ current: e.detail.current || 0 }); },
  previewCurrent() {
    const list = this.data.images || [];
    if (list.length === 0) return;
    wx.previewImage({ current: list[this.data.current], urls: list });
  },

  /* ===================== 地图“照片”：只从 /home/gallery，直接拿大图/原图 ===================== */
  async _resolveMapPhotoUrlFromGallery() {
    try {
      const resp = await request('/home/gallery', 'GET');
      const list = resp?.data?.data?.images || resp?.data?.images || [];
      const getUrl = (x) => (typeof x === 'string' ? x : (x?.full || x?.url || x?.thumb || ''));
      if (Array.isArray(list) && list.length) {
        // 优先匹配 map / 地图 / 导览 / guide 关键字
        const hit = list.find(u => /map|地图|导览|guide/i.test(String(getUrl(u))));
        if (hit) return toOrigin(getUrl(hit)); // ✅ 直接原图
      }
    } catch (e) {
      console.warn('[map photo] /home/gallery 查询失败', e);
    }
    return toOrigin(MAP_FALLBACK_URL); // 兜底也用原图地址
  },

  async openMap() {
    try {
      if (!this.data.mapPhotoLocal) {
        const url = await this._resolveMapPhotoUrlFromGallery(); // ✅ 严格来自 /home/gallery（原图）
        const local = await imgCache.get(url);                   // ✅ 直接缓存原图
        this.setData({ mapPhotoLocal: local /*, mapPhotoRemote: url */ });
      }
      this.setData({ mapVisible: true });
    } catch (err) {
      wx.showToast({ icon: 'none', title: '地图图片加载失败' });
      console.warn('[map photo] load fail', err);
    }
  },
  closeMap() { this.setData({ mapVisible: false }); },
  previewMapPhoto() {
    const u = this.data.mapPhotoLocal;
    if (u) wx.previewImage({ urls: [u] });
    // 若想优先远端原图：wx.previewImage({ current: this.data.mapPhotoRemote || u, urls: [this.data.mapPhotoRemote || u, u].filter(Boolean) });
  },

  /* ===================== 其它交互保持不变 ===================== */
  toggleSidebar() { this.setData({ sidebarVisible: !this.data.sidebarVisible }); },
  noop() {},

  // 点击查看：优先拉“原图”，失败再回退到大图/缩略图（地点）
  async checkIn(e) {
    const id = Number(e.currentTarget.dataset.id);
    if (!id) return;

    // 1) 强制确保原图本地缓存
    const fullLocal = await this._ensureFullLocalById(id);
    if (fullLocal) {
      wx.previewImage({ current: fullLocal, urls: [fullLocal] });
      return;
    }

    // 2) 兜底：大图或缩略图
    const item = (this.data.locations || []).find(x => x.id === id);
    const fallback = item?.imageFullLocal || item?.imageThumbLocal || item?.image;
    if (fallback) wx.previewImage({ current: fallback, urls: [fallback] });
    else wx.showToast({ icon: 'none', title: '暂无图片可预览' });
  },

  toggleDescription(e) {
    const id = Number(e.currentTarget.dataset.id);
    const updated = (this.data.locations || []).map(x =>
      x.id === id ? { ...x, expanded: !x.expanded } : x
    );
    this.setData({ locations: updated });
  },

  goToRank()    { wx.navigateTo({ url: '/pages/rank/rank' }); },
  goToConnect() { wx.navigateTo({ url: '/pages/connect/connect' }); }
});
