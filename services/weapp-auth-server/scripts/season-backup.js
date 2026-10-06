#!/usr/bin/env node
'use strict';
// Offline tool. --media-dir is a full COS mirror, never merely an image index.
// Restore never overwrites an existing destination or the live data directory.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const store = require('../lib/seasonStore');
const { dataDigest } = require('../lib/seasonLifecycle');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const file = path.join(dir, e.name);
    if (e.isSymbolicLink()) throw new Error('不允许符号链接：'+file);
    return e.isDirectory() ? files(file) : [file];
  });
}
function target(root, relative) {
  const result = path.resolve(root, relative);
  if (!result.startsWith(path.resolve(root)+path.sep)) throw new Error('无效备份路径');
  return result;
}
function mediaReferences(value, keys = new Set()) {
  if (Array.isArray(value)) value.forEach(v => mediaReferences(v, keys));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([k,v]) => {
    if (typeof v === 'string' && /(?:key|photo|image|avatar|thumbnail|url)$/i.test(k)) {
      let ref = v;
      if (/^https?:\/\//i.test(v)) {
        const url = new URL(v);
        const own = ['https://sysuzngcxy-1322240898.cos.ap-guangzhou.myqcloud.com', process.env.PUBLIC_ASSET_DOMAIN, process.env.COS_BUCKET && process.env.COS_REGION && `https://${process.env.COS_BUCKET}.cos.${process.env.COS_REGION}.myqcloud.com`].filter(Boolean).map(x => new URL(x).host);
        if (!own.includes(url.host)) return;
        ref = decodeURIComponent(url.pathname.slice(1));
      }
      if (ref && !ref.startsWith('data:') && ref.includes('/') && !ref.startsWith('/')) keys.add(ref);
    } else mediaReferences(v, keys);
  });
  return keys;
}
function backup(destination, mediaDir) {
  if (!mediaDir || !fs.statSync(mediaDir).isDirectory()) throw new Error('必须提供完整对象镜像 --media-dir');
  if (fs.existsSync(destination)) throw new Error('备份目标必须不存在');
  const inventory = JSON.parse(fs.readFileSync(path.join(mediaDir, 'cos-inventory.json'), 'utf8'));
  if (!Array.isArray(inventory.objects)) throw new Error('缺少完整 COS 对象清单');
  for (const item of inventory.objects) {
    const bytes = fs.readFileSync(target(mediaDir, item.key));
    if (bytes.length !== item.size || sha(bytes) !== item.sha256) throw new Error('对象镜像校验失败：' + item.key);
  }
  const release = store.lock();
  try {
    store.recover();
    const sources = files(store.root()).filter(f => !['writer.lock','restore-proof.json'].includes(path.basename(f))).map(f=>[f,'seasons/'+path.relative(store.root(),f)]);
    for (const [name,env] of [['users.json','USERS_FILE'],['submissions.json','SUBMISSIONS_FILE'],['future_cards.json','FUTURE_CARDS_FILE'],['feedback.json','FEEDBACK_FILE'],['location-settings.json','LOCATION_SETTINGS_FILE']]) {
      const f=store.legacy(name,env);
      if (fs.existsSync(f)) sources.push([f,'legacy/'+name]);
    }
    for (const f of files(path.join(__dirname, '..', 'data')).filter(f => /\.js$/.test(f))) sources.push([f, 'code-config/'+path.basename(f)]);
    const objects = files(mediaDir).map(f=>[f,'objects/'+path.relative(mediaDir,f)]);
    const refs = new Set();
    for(const [f] of sources) if(f.endsWith('.json')) mediaReferences(JSON.parse(fs.readFileSync(f,'utf8')),refs);
    for(const key of refs) if(!fs.existsSync(target(mediaDir,key))) throw new Error('缺少图片对象：'+key);
    const manifest = { mediaInventory: inventory, schemaVersion:1, at:new Date().toISOString(), dataDigest:dataDigest(), codeRevision:process.env.CODE_REVISION || 'unknown', references:[...refs], files:[] };
    fs.mkdirSync(destination,{recursive:true,mode:0o700});
    for(const [f,name] of [...sources,...objects]) {
      const bytes=fs.readFileSync(f), out=target(destination,name);
      fs.mkdirSync(path.dirname(out),{recursive:true,mode:0o700}); fs.writeFileSync(out,bytes,{mode:0o600});
      manifest.files.push({name,size:bytes.length,sha256:sha(bytes)});
    }
    store.atomic(path.join(destination,'manifest.json'),manifest);
    return {files:manifest.files.length,objects:objects.length,dataDigest:manifest.dataDigest};
  } finally { release(); }
}
function restore(source,destination,recordProof=false) {
  if(fs.existsSync(destination)) throw new Error('恢复目标必须不存在，禁止覆盖');
  const raw=fs.readFileSync(path.join(source,'manifest.json'));
  const manifest=JSON.parse(raw);
  if(manifest.schemaVersion!==1 || !Array.isArray(manifest.files)) throw new Error('无效备份清单');
  const seen=new Set();
  for(const item of manifest.files) {
    if(seen.has(item.name)) throw new Error('重复备份路径'); seen.add(item.name);
    const f=target(source,item.name);
    if(fs.lstatSync(f).isSymbolicLink()) throw new Error('备份包含符号链接');
    const bytes=fs.readFileSync(f);
    if(bytes.length!==item.size || sha(bytes)!==item.sha256) throw new Error('备份校验失败：'+item.name);
    target(destination,item.name);
  }
  for(const item of manifest.mediaInventory.objects) if(!seen.has('objects/'+item.key)) throw new Error('对象清单缺少文件：'+item.key);
  for(const key of manifest.references) if(!seen.has('objects/'+key)) throw new Error('图片对象未备份：'+key);
  fs.mkdirSync(destination,{recursive:true,mode:0o700});
  for(const item of manifest.files) {
    const out=target(destination,item.name); fs.mkdirSync(path.dirname(out),{recursive:true,mode:0o700});
    fs.copyFileSync(target(source,item.name),out); fs.chmodSync(out,0o600);
    if(sha(fs.readFileSync(out))!==item.sha256) throw new Error('恢复校验失败');
  }
  const result={backupHash:sha(raw),dataDigest:manifest.dataDigest,objectsVerified:true,verifiedAt:new Date().toISOString(),destination};
  if(recordProof) {
    const release=store.lock();
    try {store.recover(); if(dataDigest()!==manifest.dataDigest) throw new Error('生产数据已变化，需要重新备份演练');store.atomic(path.join(store.root(),'restore-proof.json'),result);}
    finally {release();}
  }
  return result;
}
if(require.main===module) {
  const args=process.argv.slice(2),arg=name=>args[args.indexOf(name)+1];
  try {
    const result=args[0]==='backup' ? backup(path.resolve(arg('--out')),args.includes('--media-dir')?path.resolve(arg('--media-dir')):null)
      : args[0]==='restore' ? restore(path.resolve(arg('--from')),path.resolve(arg('--out')),args.includes('--record-proof')) : (()=>{throw new Error('用法：backup --out DIR --media-dir DIR | restore --from DIR --out NEW_DIR [--record-proof]');})();
    console.log(JSON.stringify(result,null,2));
  } catch(e){console.error(e.message);process.exitCode=1;}
}
module.exports={backup,restore,mediaReferences};
