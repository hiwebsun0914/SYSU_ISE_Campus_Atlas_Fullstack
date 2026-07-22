// Web-H5 版图片缓存：Cache Storage + localStorage
// - getOrNet：命中本地则返回 blob:，未命中立即返回原 URL 并后台缓存（适合首屏秒显）
// - get：等待缓存完成再返回（关键图必本地）
// - warmup：批量预热
// 依赖：浏览器支持 CacheStorage；图片域名需允许 CORS GET，便于生成 blob:

const CACHE_NAME = 'img-cache-v3';
const META_KEY   = 'IMG_CACHE_META_V3';
const FAIL_KEY   = 'IMG_CACHE_FAILMAP_V1';
const MAX_ENTRIES = 400;
const DEFAULT_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000; // 2 天
const DEFAULT_TIMEOUT = 8000;
const MAX_CONCURRENCY = 4;

let DEBUG = false;
const hasCacheAPI = typeof window !== 'undefined' && 'caches' in window;

// 当前会话的 blob: URL 表
const objUrlMap = new Map(); // url => { objUrl, createdAt }
const queue = [];
let running = 0;

const now  = () => Date.now();
const log  = (...a) => { if (DEBUG) console.info('[imgCache]', ...a); };
const warn = (...a) => { if (DEBUG) console.warn('[imgCache]', ...a); };

function runQueue() {
  while (running < MAX_CONCURRENCY && queue.length) {
    const task = queue.shift(); running++;
    task().finally(() => { running--; runQueue(); });
  }
}
function enqueue(fn) {
  return new Promise((resolve, reject) => {
    queue.push(() => fn().then(resolve).catch(reject));
    runQueue();
  });
}
const getMeta = () => { try { return JSON.parse(localStorage.getItem(META_KEY) || '{}'); } catch { return {}; } };
const setMeta = (m)  => { try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch(e){ warn('setMeta fail', e); } };
const getFail = () => { try { return JSON.parse(localStorage.getItem(FAIL_KEY) || '{}'); } catch { return {}; } };
const setFail = (m)  => { try { localStorage.setItem(FAIL_KEY, JSON.stringify(m)); } catch {} };

const versionFromUrl = (u) => { const m = /[?&]v=([^&]+)/.exec(u); return m ? decodeURIComponent(m[1]) : ''; };
const isExpired = (meta, age) => !meta || (now() - (meta.savedAt || 0)) > age;
const isLocalPath = (p) => typeof p === 'string' && p.startsWith('blob:');

async function openCache(){ if (!hasCacheAPI) return null; return caches.open(CACHE_NAME); }
async function cacheMatch(url){ if (!hasCacheAPI) return null; const c = await openCache(); return c.match(url); }
async function cachePut(url, resp){ if (!hasCacheAPI) return; const c = await openCache(); await c.put(url, resp); }

function setObjUrl(url, blob){
  const old = objUrlMap.get(url);
  if (old?.objUrl) URL.revokeObjectURL(old.objUrl);
  const objUrl = URL.createObjectURL(blob);
  objUrlMap.set(url, { objUrl, createdAt: now() });
  return objUrl;
}

// 失败负缓存
const shouldSkip = (url) => { const f = getFail()[url]; return f && now() < f.banUntil; };
const markFail   = (url, minutes=30) => { const fm=getFail(); fm[url]={banUntil:now()+minutes*60*1000}; setFail(fm); log('markFail', url); };
const clearFail  = (url) => { const fm=getFail(); if(fm[url]){ delete fm[url]; setFail(fm);} };

// 仅尝试“会话级命中”
function tryLocal(url, opts={}){
  const version = opts.version || versionFromUrl(url);
  const maxAgeMs = ('maxAgeMs' in opts) ? opts.maxAgeMs : DEFAULT_MAX_AGE_MS;
  const meta = getMeta()[url];
  if (meta && !isExpired(meta, maxAgeMs) && meta.version === version) {
    const hit = objUrlMap.get(url);
    if (hit?.objUrl) {
      const age = Math.round((now() - (meta.savedAt||0))/1000);
      log('HIT(local)', { url, path: hit.objUrl, version, age_s: age });
      const m = getMeta(); if (m[url]) { m[url].lastUsed = now(); setMeta(m); }
      return hit.objUrl;
    }
  }
  log('MISS(local)', { url, reason: meta ? `verOk=${meta.version===version} expired=${isExpired(meta,maxAgeMs)} session=${!!objUrlMap.get(url)}` : 'no-meta' });
  return null;
}

async function readBlobUrl(url){
  const resp = await cacheMatch(url);
  if (!resp) return null;
  try {
    const blob = await resp.clone().blob();
    return setObjUrl(url, blob);
  } catch(e){
    warn('readBlobUrl fail (opaque/CORS?)', url, e);
    return null;
  }
}

function warmOne(url, opts={}){
  const version = opts.version || versionFromUrl(url);
  const timeout = opts.timeout || DEFAULT_TIMEOUT;
  const maxAgeMs = ('maxAgeMs' in opts) ? opts.maxAgeMs : DEFAULT_MAX_AGE_MS;

  const hit = tryLocal(url, { version, maxAgeMs });
  if (hit) return Promise.resolve(hit);
  if (shouldSkip(url)){ log('SKIP(failed recently)', url); return Promise.resolve(url); }

  return enqueue(async () => {
    const again = tryLocal(url, { version, maxAgeMs });
    if (again) return again;

    const existing = await cacheMatch(url);
    if (existing) {
      const m = getMeta(); if (m[url]) { m[url].lastUsed = now(); setMeta(m); }
      const obj = await readBlobUrl(url);
      if (obj) return obj;
    }

    log('DOWNLOAD(start)', url);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      const resp = await fetch(url, { signal: controller.signal, mode: 'cors' });
      clearTimeout(timer);

      if (!resp.ok) {
        markFail(url);
        warn('DOWNLOAD(non-200)', resp.status, url);
        return url;
      }

      const cloneForCache = resp.clone();
      const cloneForBlob  = resp.clone();
      const [_, blob] = await Promise.all([ cachePut(url, cloneForCache), cloneForBlob.blob() ]);
      const objUrl = setObjUrl(url, blob);

      const m = getMeta();
      m[url] = { version, savedAt: now(), lastUsed: now(), size: blob.size };
      setMeta(m); prune();

      clearFail(url);
      log('DOWNLOAD(ok)+SAVE', { url, size: blob.size, version });
      return objUrl;
    } catch(e){
      markFail(url);
      warn('DOWNLOAD(fail)', url, e);
      return url;
    }
  });
}

function warmup(urls=[], opts={}) {
  if (!Array.isArray(urls) || urls.length===0) return Promise.resolve([]);
  log('WARMUP(batch)', urls.length);
  return Promise.all(urls.map(u => warmOne(u, opts)));
}

function getOrNet(url, opts={}) {
  const local = tryLocal(url, opts);
  if (local) return Promise.resolve(local);
  log('GETORNET(use-net, warm)', url);
  warmOne(url, opts).catch(()=>{});
  return Promise.resolve(url);
}

function get(url, opts={}) {
  const local = tryLocal(url, opts);
  if (local && !opts.force) return Promise.resolve(local);
  return warmOne(url, opts);
}

function prune(max=MAX_ENTRIES){
  const m = getMeta();
  const entries = Object.entries(m);
  if (entries.length <= max) return;
  entries.sort((a,b)=>(a[1].lastUsed||0)-(b[1].lastUsed||0));
  const toDel = entries.slice(0, entries.length - max);
  enqueue(async () => {
    const c = await openCache();
    for (const [url] of toDel) {
      try { if (c) await c.delete(url); } catch {}
      delete m[url];
      const cur = objUrlMap.get(url);
      if (cur?.objUrl) { try { URL.revokeObjectURL(cur.objUrl); } catch {} objUrlMap.delete(url); }
    }
    setMeta(m);
    log('prune done, remain:', Object.keys(m).length);
  });
}

function cleanupByAge(maxIdleDays=45){
  const idle = maxIdleDays*24*60*60*1000;
  const m = getMeta(); let changed=false;
  Object.entries(m).forEach(([url,meta])=>{
    const last = meta.lastUsed||meta.savedAt||0;
    if (now()-last>idle) {
      enqueue(async ()=>{ try{ const c=await openCache(); if(c) await c.delete(url);}catch{} });
      delete m[url]; changed=true;
      const cur = objUrlMap.get(url);
      if (cur?.objUrl) { try { URL.revokeObjectURL(cur.objUrl); } catch {} objUrlMap.delete(url); }
    }
  });
  if (changed) setMeta(m);
  log('cleanupByAge done');
}

async function stats(){
  const m = getMeta();
  const keys = Object.keys(m);
  let total = 0; keys.forEach(k => total += (m[k].size||0));
  const info = {
    entries_in_meta: keys.length,
    approx_total_size_MB: (total/1048576).toFixed(2),
    sample_keys: keys.slice(0,5)
  };
  log('STATS', info);
  return info;
}

function enableDebug(flag=true){ DEBUG = !!flag; log('DEBUG=', DEBUG); }

export {
  tryLocal, getOrNet, get, warmup,
  enableDebug, stats, cleanupByAge,
  versionFromUrl, isLocalPath
};
export default {
  tryLocal, getOrNet, get, warmup,
  enableDebug, stats, cleanupByAge,
  versionFromUrl, isLocalPath
};
