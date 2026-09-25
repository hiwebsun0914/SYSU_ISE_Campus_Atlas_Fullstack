const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { once } = require('events');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seasons-integration-'));
process.env.SEASONS_DIR = path.join(dir, 'seasons');
process.env.JWT_SECRET = 'season-test-secret';
process.env.DEV_BYPASS_AUTH = 'false';
for(const [key,name] of [['USERS_FILE','users.json'],['SUBMISSIONS_FILE','submissions.json'],['FUTURE_CARDS_FILE','future_cards.json'],['FEEDBACK_FILE','feedback.json'],['LOCATION_SETTINGS_FILE','location-settings.json']]) process.env[key]=path.join(dir,name);
const users=[{id:1,username:'owner',role:'owner',password:bcrypt.hashSync('password',4),points:0},{id:2,username:'student',realName:'学生',role:'visitor',password:bcrypt.hashSync('password',4),points:7,pointsUpdatedAt:1000,unlockedLocations:[1],completedRoutes:['old-route'],checkinRecords:[{locationId:1,time:1000,pointsAwarded:7,key:'checkin/2__student/1/main.webp'}]},{id:3,username:'reviewer',role:'admin',points:0}];
fs.writeFileSync(process.env.USERS_FILE,JSON.stringify(users));
fs.writeFileSync(process.env.SUBMISSIONS_FILE,JSON.stringify([{id:'old-work',userId:2,category:'photography',title:'旧照片',status:'approved',votes:[{userId:2,day:'2026-09-16'}],createdAt:1000}]));
fs.writeFileSync(process.env.FUTURE_CARDS_FILE,JSON.stringify({cards:[{id:'future',userId:2,content:'给未来的自己',revealAt:'2030-01-01'}]}));
fs.writeFileSync(process.env.FEEDBACK_FILE,'[]');fs.writeFileSync(process.env.LOCATION_SETTINGS_FILE,'{}');
const original=fs.readFileSync(process.env.USERS_FILE,'utf8'), future=fs.readFileSync(process.env.FUTURE_CARDS_FILE,'utf8');
const store=require('../lib/seasonStore');
const migration=require('../scripts/migrate-seasons');
const lifecycle=require('../lib/seasonLifecycle');
const backup=require('../scripts/season-backup');
const media=path.join(dir,'objects');fs.mkdirSync(path.join(media,'checkin/2__student/1'),{recursive:true});fs.writeFileSync(path.join(media,'checkin/2__student/1/main.webp'),'test-image');
let server,base,sequence=0;
async function api(url,{user=1,season='2026-welcome',method='GET',body}={}) {
 const headers={'Content-Type':'application/json',Authorization:'Bearer '+jwt.sign({id:user},process.env.JWT_SECRET)};
 if(season!==null)headers['X-Season-Id']=season;
 const r=await fetch(base+url,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,...await r.json()};
}
async function apiFile(url,{user=1,season,buffer,name}) {
 const headers={Authorization:'Bearer '+jwt.sign({id:user},process.env.JWT_SECRET),'X-Season-Id':season};
 const body=new FormData();body.append('file',new Blob([buffer]),name);
 const r=await fetch(base+url,{method:'POST',headers,body});return {status:r.status,...await r.json()};
}
function refreshInventory(){
  const refs = backup.mediaReferences(store.state());
  for(const key of refs){const f=path.join(media,key);fs.mkdirSync(path.dirname(f),{recursive:true});if(!fs.existsSync(f))fs.writeFileSync(f,'fixture-object');}
  const all=[];function walk(d){for(const entry of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,entry.name);if(entry.isDirectory())walk(f);else if(entry.name!=='cos-inventory.json'){const b=fs.readFileSync(f);all.push({key:path.relative(media,f),size:b.length,sha256:require('crypto').createHash('sha256').update(b).digest('hex')});}}}walk(media);store.atomic(path.join(media,'cos-inventory.json'),{objects:all});
}
function drill(){refreshInventory();const b=path.join(dir,'backup-'+sequence),r=path.join(dir,'restore-'+sequence++);backup.backup(b,media);return backup.restore(b,r,true);}
test.before(async()=>{migration.migrate(true);server=require('../app').listen(0,'127.0.0.1');await once(server,'listening');base='http://127.0.0.1:'+server.address().port;});
test.after(async()=>{server.close();await once(server,'close');fs.rmSync(dir,{recursive:true,force:true});});
test('migration is repeatable, preserves source credentials, progress and future cards',()=>{
 assert.equal(migration.migrate(true).alreadyMigrated,true);assert.equal(fs.readFileSync(process.env.USERS_FILE,'utf8'),original);assert.equal(fs.readFileSync(process.env.FUTURE_CARDS_FILE,'utf8'),future);
 assert.equal(store.readUsers().find(x=>x.id===2).points,7);assert.ok(!Object.hasOwn(store.readAccounts()[1],'points'));assert.ok(store.readAccounts().every(x=>x.participantSeasonId==='2026-welcome'));assert.ok(Object.values(store.state().eligibility).every(x=>x.capabilities.checkin&&x.capabilities.submit&&x.capabilities.vote));assert.equal(store.state().submissions[0].votes[0].seasonId,'2026-welcome');
});
test('legacy write clients are rejected; accounts still log in during settlement',async()=>{
 assert.equal((await api('/checkin/map',{user:2,method:'POST',season:null,body:{locationId:1}})).errorCode,'SEASON_REQUIRED');
 const login=await api('/auth/login',{method:'POST',body:{username:'student',password:'password'}});assert.equal(login.code,0);assert.ok(login.token);
 assert.equal((await api('/checkin/map',{user:2,method:'POST',body:{locationId:1}})).errorCode,'ACTIVITY_CLOSED');
});
test('pending records and missing restore proof block archive without losing records',async()=>{
 let s=store.state();s.progress['2'].pendingCheckins=[{locationId:2,seasonId:s.seasonId}];store.saveState(s);
 assert.equal((await api('/seasons/archive',{method:'POST',body:{}})).errorCode,'PENDING_REVIEWS');
 s=store.state();s.progress['2'].pendingCheckins=[];store.saveState(s);
 assert.equal((await api('/seasons/archive',{method:'POST',body:{}})).errorCode,'RESTORE_DRILL_REQUIRED');
 assert.equal(store.state().status,'settling');
});
test('backup restores real objects and future cards; corruption never overwrites live data',()=>{
 const proof=drill();assert.equal(proof.objectsVerified,true);assert.equal(fs.readFileSync(path.join(proof.destination,'objects/checkin/2__student/1/main.webp'),'utf8'),'test-image');assert.equal(fs.readFileSync(path.join(proof.destination,'legacy/future_cards.json'),'utf8'),future);
 const b=path.join(dir,'bad-backup');backup.backup(b,media);fs.writeFileSync(path.join(b,'seasons/accounts.json'),'broken');assert.throws(()=>backup.restore(b,path.join(dir,'bad-restore')),/校验失败/);assert.equal(store.readAccounts().length,3);
});
test('archive freezes standings and rejects all admin/participant mutations',async()=>{
 assert.equal((await api('/seasons/archive',{user:3,method:'POST',body:{}})).status,403);
 drill();assert.equal((await api('/seasons/archive',{method:'POST',body:{}})).code,0);
 assert.equal(store.state().status,'archived');const hash=lifecycle.digest(store.state());
 for(const [method,url,body] of [['POST','/admin/checkins/2_1/approve',{}],['POST','/admin/submissions/compute-winners',{}],['PATCH','/admin/locations/1',{name:'changed'}],['DELETE','/submissions/old-work',{}],['POST','/checkin/commit',{}]]) assert.equal((await api(url,{method,body})).errorCode,'SEASON_READ_ONLY',url);
 await api('/submissions/mine',{user:2});await api('/submissions/winners');await api('/admin/submissions');
 assert.equal(lifecycle.digest(store.state()),hash);
 assert.equal((await api('/seasons/mine',{user:2})).data.awards[0].winnerRank,1);
});
test('new draft remains empty, switching needs proof and exact admin review',async()=>{
 const draft={seasonId:'2027-welcome',name:'2027迎新',deadline:'2099-09-17T00:00:00Z',revealAt:'2099-09-19T00:00:00Z'};
 assert.equal((await api('/seasons',{method:'POST',body:draft})).code,0);
 assert.deepEqual(store.state('2027-welcome').progress,{});
 assert.equal((await api('/seasons/roster',{user:3,season:'2027-welcome'})).status,403);
 const workbook=new (require('exceljs').Workbook)(),sheet=workbook.addWorksheet('新生花名册');sheet.addRows([['姓名','学号','入学年份','学院'],['张三','27300001','2027','智能工程学院'],['李四','27300002','2027','智能工程学院']]);
 const rosterResult=await apiFile('/seasons/roster/import',{season:'2027-welcome',buffer:await workbook.xlsx.writeBuffer(),name:'2027级新生花名册.xlsx'});
 assert.equal(rosterResult.code,0,JSON.stringify(rosterResult));assert.equal(rosterResult.data.count,2);assert.equal(rosterResult.data.colleges[0].count,2);assert.ok(!Object.hasOwn(rosterResult.data,'records'));assert.equal(store.readRoster('2027-welcome').records[0].studentId,'27300001');
 const duplicate=Buffer.from('姓名,学号,入学年份,学院\n张三,27300001,2027,智能工程学院\n李四,27300001,2027,智能工程学院');
 assert.equal((await apiFile('/seasons/roster/import',{season:'2027-welcome',buffer:duplicate,name:'duplicate.csv'})).errorCode,'ROSTER_DUPLICATE_STUDENT_ID');assert.equal(store.readRoster('2027-welcome').count,2);assert.equal(store.state('2027-welcome').status,'draft');assert.equal(store.state('2026-welcome').status,'archived');
 const eligibilityCheck=await api('/seasons/activate',{method:'POST',season:'2027-welcome',body:{reviewedAdminIds:[1,3]}});assert.equal(eligibilityCheck.errorCode,'ELIGIBILITY_REQUIRED',JSON.stringify(eligibilityCheck));
 let next=store.state('2027-welcome');next.eligibility['1']={seasonId:'2027-welcome',userId:1,source:'roster',capabilities:{checkin:true,submit:true,vote:true}};store.saveState(next);
 assert.equal((await api('/seasons/activate',{method:'POST',season:'2027-welcome',body:{reviewedAdminIds:[1,3]}})).errorCode,'RESTORE_DRILL_REQUIRED');
 drill();assert.equal((await api('/seasons/activate',{method:'POST',season:'2027-welcome',body:{reviewedAdminIds:[1]}})).errorCode,'ADMIN_REVIEW_REQUIRED');
 assert.equal(store.registry().currentSeasonId,'2026-welcome');
 assert.equal((await api('/seasons/activate',{method:'POST',season:'2027-welcome',body:{reviewedAdminIds:[1,3]}})).code,0);
 assert.equal((await apiFile('/seasons/roster/import',{season:'2027-welcome',buffer:duplicate,name:'late.csv'})).errorCode,'ROSTER_SEASON_LOCKED');
 const blocked=await api('/auth/me',{user:2,season:null});assert.equal(blocked.errorCode,'SEASON_NOT_VISIBLE');
 const own=await api('/auth/me',{user:2});assert.equal(own.userInfo.points,7);assert.deepEqual(own.userInfo.completedRoutes,['old-route']);
 const visible=await api('/seasons',{user:2});assert.equal(visible.currentSeasonId,'2026-welcome');assert.deepEqual(visible.list.map(x=>x.seasonId),['2026-welcome']);assert.equal(fs.readFileSync(process.env.FUTURE_CARDS_FILE,'utf8'),future);
});
test('selecting the current season never grants an old account participation rights',async()=>{
 const checkin=await api('/checkin/map',{user:2,season:'2027-welcome',method:'POST',body:{locationId:2}});
 assert.equal(checkin.errorCode,'SEASON_NOT_VISIBLE');
 const submission=await api('/submissions',{user:2,season:'2027-welcome',method:'POST',body:{}});
 assert.equal(submission.errorCode,'SEASON_NOT_VISIBLE');
 const vote=await api('/submissions/any-work/vote',{user:2,season:'2027-welcome',method:'POST',body:{action:'vote'}});
 assert.equal(vote.errorCode,'SEASON_NOT_VISIBLE');
 const mine=await api('/seasons/mine',{user:2,season:'2027-welcome'});
 assert.equal(mine.errorCode,'SEASON_NOT_VISIBLE');
});
test('object ids, vote quotas, media prefixes and ranking data cannot cross seasons',async()=>{
 assert.equal((await api('/submissions/old-work',{season:'2027-welcome'})).status,404);
 assert.equal((await api('/submissions/old-work/vote',{season:'2027-welcome',method:'POST',body:{}})).status,404);
 assert.equal((await api('/submissions/commit',{season:'2027-welcome',method:'POST',body:{key:'Award/1__owner/old.webp'}})).status,400);
 assert.equal((await api('/submissions/mine',{season:'2027-welcome'})).list.length,0);
 const rank=await api('/rank/points',{season:'2027-welcome'});assert.ok(rank.list.every(x=>x.points===0));
 assert.equal((await api('/rank/points')).list.find(x=>x.userId===2).points,7);
 store.context.run({seasonId:'2027-welcome',writes:new Map()},()=>assert.equal(store.mediaRoot('checkin'),'seasons/2027-welcome/checkin/'));
});
test('concurrent reviews award once and preserve independent updates',async()=>{
 const s=store.state('2027-welcome');s.progress['2']=store.emptyProgress(2,'2027-welcome');s.progress['2'].lockingLocations=[1,2];s.progress['2'].pendingCheckins=[1,2].map(locationId=>({locationId,seasonId:s.seasonId,pointsDeferred:true,submittedAt:Date.now(),photo:'https://example.com/photo.jpg'}));store.saveState(s);
 const responses=await Promise.all([1,1,2].map(id=>api('/admin/checkins/2_'+id+'/approve',{season:'2027-welcome',method:'POST',body:{}})));
 assert.ok(responses.every(r=>r.status===200));const result=store.state('2027-welcome').progress['2'];assert.equal(result.points,3);assert.deepEqual(result.unlockedLocations.sort(),[1,2]);assert.equal(result.pendingCheckins.length,0);
});
test('conflicting season parameters and account deletion fail without data loss',async()=>{
 assert.equal((await api('/auth/me?seasonId=2027-welcome')).errorCode,'SEASON_INVALID');
 const before=lifecycle.dataDigest();const r=await api('/admin/users/2',{season:'2027-welcome',method:'DELETE'});assert.ok(r.status>=400);assert.equal(lifecycle.dataDigest(),before);
});
test('corrupt season storage returns an explicit error without replacing it',async()=>{
 const file=path.join(store.root(),'2027-welcome/state.json'),contents=fs.readFileSync(file,'utf8');fs.writeFileSync(file,'{broken');
 const res=await api('/auth/me',{season:'2027-welcome'});assert.equal(res.status,503);assert.equal(fs.readFileSync(file,'utf8'),'{broken');fs.writeFileSync(file,contents);
});
test('transaction journal replays a complete multi-file commit before reads',()=>{
 const f=path.join(store.root(),'recovery-check.json');store.atomic(path.join(store.root(),'transaction.json'),{entries:[[f,{ok:true}]]});store.recover();assert.deepEqual(store.read(f),{ok:true});assert.ok(!fs.existsSync(path.join(store.root(),'transaction.json')));
});
