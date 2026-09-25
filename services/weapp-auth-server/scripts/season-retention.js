#!/usr/bin/env node
'use strict';
// Preview only. Referenced objects, legacy photos and unspecified policies are protected.
const fs = require('fs');
const path = require('path');
const store = require('../lib/seasonStore');
const { mediaReferences } = require('./season-backup');
function preview(mediaDir, now=Date.now()) {
  const registry=store.registry(), states=registry.seasons.map(id=>store.state(id)), refs=new Set();
  mediaReferences(store.readAccounts(),refs);states.forEach(s=>mediaReferences(s,refs));
  for(const [name,env] of [['future_cards.json','FUTURE_CARDS_FILE'],['feedback.json','FEEDBACK_FILE']]){
    const file=store.legacy(name,env);if(fs.existsSync(file))mediaReferences(store.read(file),refs);
  }
  const inventory=JSON.parse(fs.readFileSync(path.join(mediaDir,'cos-inventory.json'),'utf8'));
  const candidates=[],protectedObjects=[];
  for(const item of inventory.objects){
    if(refs.has(item.key)){protectedObjects.push({key:item.key,reason:'业务记录或未来寄语仍在引用'});continue;}
    const match=item.key.match(/^seasons\/([^/]+)\/(checkin-temp|checkin|Award)\//);
    const legacyTemp=item.key.startsWith('checkin-temp/');
    const s=match?states.find(s=>s.seasonId===match[1]):legacyTemp?states.find(s=>s.legacyMedia):null;
    const category=legacyTemp || match?.[2]==='checkin-temp'?'temporaryUploadsDays':'failedUploadsDays';
    const days=s?.config.retention?.[category],updated=Date.parse(item.lastModified);
    if(!days || !Number.isFinite(updated) || now-updated<days*86400000){protectedObjects.push({key:item.key,reason:'未配置期限、时间未知或尚未到期'});continue;}
    candidates.push({key:item.key,seasonId:s.seasonId,category,retentionDays:days,lastModified:item.lastModified});
  }
  return {previewOnly:true,generatedAt:new Date(now).toISOString(),candidates,protectedObjects,note:'不执行删除。已引用的反馈附件与未来寄语图片始终保留；日志与反馈个人数据的删除需单独审计。'};
}
if(require.main===module){try{const i=process.argv.indexOf('--media-dir');if(i<0 || !process.argv[i+1])throw new Error('用法：node scripts/season-retention.js --media-dir DIR');console.log(JSON.stringify(preview(path.resolve(process.argv[i+1])),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={preview};
