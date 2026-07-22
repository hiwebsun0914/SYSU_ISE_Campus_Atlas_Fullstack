// utils/imageCache.js
const KEY = 'IMG_CACHE_MAP_V3';
const FAILKEY = 'IMG_CACHE_FAILMAP_V1';
const MAX_ENTRIES = 400;
const DEFAULT_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000; // 2 天
const DEFAULT_TIMEOUT = 6000;
const MAX_CONCURRENCY = 4;

const fs = wx.getFileSystemManager();
const queue = [];
let running = 0;
let DEBUG = false;

// ======= 工具 =======
function now(){ return Date.now(); }
function log(...args){ if (DEBUG) console.info('[imgCache]', ...args); }
function warn(...args){ if (DEBUG) console.warn('[imgCache]', ...args); }

function getMap(){ try{ return wx.getStorageSync(KEY)||{} }catch{ return {} } }
function setMap(m){ try{ wx.setStorageSync(KEY,m) }catch(e){ warn('setStorageSync fail', e) } }
function getFail(){ try{ return wx.getStorageSync(FAILKEY)||{} }catch{ return {} } }
function setFail(m){ try{ wx.setStorageSync(FAILKEY,m) }catch{} }

function versionFromUrl(u){ const m=/[?&]v=([^&]+)/.exec(u); return m?decodeURIComponent(m[1]):'' }
function exists(p){ try{ fs.accessSync(p); return true }catch{ return false } }
function isExpired(meta,age){ return !meta || (now()-(meta.savedAt||0))>age }
function isLocalPath(p){ return typeof p==='string' && /^(wxfile|wdfile|file):\/\//.test(p); }

function touch(url){
  const m=getMap();
  if(m[url]){ m[url].lastUsed=now(); setMap(m); }
}

function prune(max=MAX_ENTRIES){
  const m=getMap(); const arr=Object.entries(m);
  if(arr.length<=max) return;
  arr.sort((a,b)=>(a[1].lastUsed||0)-(b[1].lastUsed||0));
  for(const [url,meta] of arr.slice(0,arr.length-max)){
    try{ if(meta.path&&exists(meta.path)) wx.removeSavedFile({filePath:meta.path}); }catch{}
    delete m[url];
  }
  setMap(m);
  log('prune done, remain:', Object.keys(getMap()).length);
}

function shouldSkip(url){ const f=getFail()[url]; return f && now()<f.banUntil; }
function markFail(url, mins=30){ const fm=getFail(); fm[url]={banUntil:now()+mins*60*1000}; setFail(fm); log('markFail', url); }
function clearFail(url){ const fm=getFail(); if(fm[url]){ delete fm[url]; setFail(fm); } }

function runQueue(){
  while(running<MAX_CONCURRENCY && queue.length){
    const task=queue.shift(); running++;
    task().finally(()=>{ running--; runQueue(); });
  }
}

function enqueue(fn){
  return new Promise((resolve,reject)=>{
    queue.push(()=>fn().then(resolve).catch(reject));
    runQueue();
  });
}

// ======= 对外：仅检测本地，不触发下载 =======
function tryLocal(url, opts={}){
  const version = opts.version || versionFromUrl(url);
  const maxAgeMs = ('maxAgeMs' in opts) ? opts.maxAgeMs : DEFAULT_MAX_AGE_MS;
  const m = getMap();
  const meta = m[url];
  if(meta && meta.path && exists(meta.path) && meta.version===version && !isExpired(meta,maxAgeMs)){
    const age = Math.round((now()-(meta.savedAt||0))/1000);
    log('HIT(local)', { url, path: meta.path, version, age_s: age });
    touch(url);
    return meta.path;
  }
  log('MISS(local)', { url, reason: meta ? `exist=${exists(meta.path)} verOk=${meta.version===version} expired=${isExpired(meta,maxAgeMs)}` : 'no-meta' });
  return null;
}

// ======= 后台下载并入缓存（用于 warmup） =======
function warmOne(url, opts={}){
  const local = tryLocal(url, opts);
  if(local) return Promise.resolve(local);
  if(shouldSkip(url)){ log('SKIP(failed recently)', url); return Promise.resolve(url); }

  const version = opts.version || versionFromUrl(url);
  const timeout = opts.timeout || DEFAULT_TIMEOUT;
  const maxAgeMs = ('maxAgeMs' in opts) ? opts.maxAgeMs : DEFAULT_MAX_AGE_MS;

  return enqueue(()=>new Promise((resolve)=>{
    // 入队后再检查一次，可能别处刚写入
    const hit = tryLocal(url, { version, maxAgeMs });
    if(hit){ resolve(hit); return; }

    log('DOWNLOAD(start)', url);
    const req = wx.downloadFile({
      url, timeout,
      success: ({ tempFilePath, statusCode })=>{
        if(statusCode!==200){
          markFail(url);
          warn('DOWNLOAD(non-200)', statusCode, url);
          resolve(url); return;
        }
        wx.getFileSystemManager().saveFile({
          tempFilePath,
          success: ({ savedFilePath })=>{
            clearFail(url);
            const mm=getMap();
            mm[url] = { path:savedFilePath, version, savedAt:now(), lastUsed:now() };
            setMap(mm); prune();
            log('DOWNLOAD(ok)+SAVE', { url, path: savedFilePath, version });
            resolve(savedFilePath);
          },
          fail: (e)=>{ markFail(url); warn('SAVE(fail)', url, e); resolve(url); }
        });
      },
      fail: (e)=>{ markFail(url); warn('DOWNLOAD(fail)', url, e); resolve(url); }
    });
  }));
}

function warmup(urls=[], opts={}){
  if(!Array.isArray(urls) || urls.length===0) return Promise.resolve([]);
  log('WARMUP(batch)', urls.length);
  return Promise.all(urls.map(u=>warmOne(u, opts)));
}

// ======= 首屏：命中则本地；未命中立即返回网络，同时后台缓存 =======
function getOrNet(url, opts={}){
  const local = tryLocal(url, opts);
  if(local){ return Promise.resolve(local); }
  log('GETORNET(use-net, warm)', url);
  warmOne(url, opts).catch(()=>{});
  return Promise.resolve(url);
}

// ======= 传统：等待下载完成后返回本地 =======
function get(url, opts={}){
  const local = tryLocal(url, opts);
  if(local && !opts.force) return Promise.resolve(local);
  return warmOne(url, opts);
}

// ======= 维护工具 =======
function cleanupByAge(maxIdleDays=45){
  const idle=maxIdleDays*24*60*60*1000;
  const m=getMap(); let ch=false;
  Object.entries(m).forEach(([url,meta])=>{
    const last = meta.lastUsed||meta.savedAt||0;
    if(now()-last>idle){
      try{ if(meta.path&&exists(meta.path)) wx.removeSavedFile({filePath:meta.path}); }catch{}
      delete m[url]; ch=true;
    }
  });
  if(ch) setMap(m);
  log('cleanupByAge done');
}

async function stats(){
  const map = getMap();
  const keys = Object.keys(map);
  let saved = 0, exist = 0, size = 0;
  const res = await new Promise(resolve=>{
    wx.getSavedFileList({
      success: r => resolve(r.fileList||[]),
      fail: () => resolve([])
    });
  });
  saved = res.length;
  res.forEach(f => { size += f.size||0; });
  // 统计 map 中仍存在的文件
  keys.forEach(k => { if(map[k].path && exists(map[k].path)) exist++; });

  const info = {
    entries_in_map: keys.length,
    files_saved: saved,
    files_existing_in_map: exist,
    total_saved_size_MB: (size/1048576).toFixed(2),
    sample_keys: keys.slice(0, 5)
  };
  log('STATS', info);
  return info;
}

function enableDebug(flag=true){ DEBUG = !!flag; log('DEBUG=', DEBUG); }

module.exports = {
  // 核心
  tryLocal, getOrNet, warmup, get,
  // 调试/维护
  enableDebug, stats, isLocalPath, cleanupByAge,
  // 内部
  _internal: { versionFromUrl }
};
