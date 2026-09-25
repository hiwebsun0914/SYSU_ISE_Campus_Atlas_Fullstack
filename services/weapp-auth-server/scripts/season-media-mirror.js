#!/usr/bin/env node
'use strict';
// Read-only COS export. The caller must stop the service and external uploaders.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const COS = require('cos-nodejs-sdk-v5');
const store = require('../lib/seasonStore');
async function mirror(out, client, bucket = process.env.COS_BUCKET, region = process.env.COS_REGION) {
  if (!bucket || !region) throw new Error('缺少 COS_BUCKET/COS_REGION');
  if (fs.existsSync(out)) throw new Error('对象镜像目标必须不存在');
  const call=(method,params)=>new Promise((resolve,reject)=>client[method]({Bucket:bucket,Region:region,...params},(e,r)=>e?reject(e):resolve(r)));
  async function inventory(){let marker='',list=[];do{const result=await call('getBucket',{Marker:marker,MaxKeys:1000});list.push(...(result.Contents || []).filter(x=>!x.Key.endsWith('/')));marker=String(result.IsTruncated)==='true' ? result.NextMarker : '';if(String(result.IsTruncated)==='true'&&!marker)throw new Error('COS 分页缺少游标');}while(marker);return list.sort((a,b)=>a.Key.localeCompare(b.Key));}
  const before=await inventory();
  fs.mkdirSync(out,{recursive:true,mode:0o700});
  const objects=[];
  for(const item of before){
    const dest=path.resolve(out,item.Key);
    if(!dest.startsWith(path.resolve(out)+path.sep))throw new Error('无效对象路径');
    const result=await call('getObject',{Key:item.Key});
    const bytes=Buffer.isBuffer(result.Body)?result.Body:Buffer.from(result.Body);
    if(bytes.length!==Number(item.Size))throw new Error('对象大小变化：'+item.Key);
    fs.mkdirSync(path.dirname(dest),{recursive:true,mode:0o700});fs.writeFileSync(dest,bytes,{mode:0o600,flag:'wx'});
    objects.push({key:item.Key,size:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),etag:item.ETag,lastModified:item.LastModified});
  }
  const after=await inventory();
  const identity=items=>JSON.stringify(items.map(x=>[x.Key,x.Size,x.ETag,x.LastModified]));
  if(identity(before)!==identity(after))throw new Error('导出期间 COS 对象发生变化，请重新导出');
  store.atomic(path.join(out,'cos-inventory.json'),{bucket,region,at:new Date().toISOString(),objects});
  return {objects:objects.length};
}
if(require.main===module){const i=process.argv.indexOf('--out');if(i<0 || !process.argv[i+1]){console.error('用法：node scripts/season-media-mirror.js --out NEW_DIR');process.exitCode=1;}else{
 const client=new COS({SecretId:process.env.TENCENT_SECRET_ID || process.env.COS_SECRET_ID,SecretKey:process.env.TENCENT_SECRET_KEY || process.env.COS_SECRET_KEY});
 const release=store.lock();mirror(path.resolve(process.argv[i+1]),client).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exitCode=1;}).finally(release);
}}
module.exports={mirror};
