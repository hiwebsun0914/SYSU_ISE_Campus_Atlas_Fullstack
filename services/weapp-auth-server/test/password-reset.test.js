const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const test = require('node:test');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'password-reset-test-'));
const file = path.join(dir, 'users.json');
process.env.USERS_FILE = file;
process.env.FEEDBACK_FILE = path.join(dir, 'feedback.json');
process.env.SUBMISSIONS_FILE = path.join(dir, 'submissions.json');
process.env.JWT_SECRET = 'password-reset-test-secret-long-enough';
process.env.DEV_BYPASS_AUTH = 'false';
process.env.ADMIN_OWNER_IDS = '1';
process.env.ADMIN_OWNER_USERNAMES = '';
process.env.PASSWORD_RESET_PUBLIC_URL = 'https://example.com';
const seed = [1,2,3,4].map(id => ({id, username:'user'+id, role:id===2?'admin':'visitor', realName:'Test', password:bcrypt.hashSync('old-password',8),points:0}));
const save = users => fs.writeFileSync(file, JSON.stringify(users));
const read = () => JSON.parse(fs.readFileSync(file));
save(seed);
const app = require('../app');
const server = app.listen(0,'127.0.0.1');
let base;
const tokens = Object.fromEntries(seed.map(u=>[u.id,jwt.sign({id:u.id},process.env.JWT_SECRET)]));
async function api(url, method='GET', data, actor) {
  const response = await fetch(base+url,{method,headers:{'Content-Type':'application/json',...(actor?{Authorization:'Bearer '+(tokens[actor]||actor)}:{})},body:data===undefined?undefined:JSON.stringify(data)});
  return {status:response.status,body:await response.json()};
}
const apply = username => api('/password-reset/requests','POST',{username,realName:'Test',studentId:'12345',note:'微信核实'});
const decide = (id, action='approve',actor=1) => api(`/password-reset/requests/${id}/decision`,'POST',{action,note:'通过已有微信会话与线下身份核实'},actor);
const tokenOf = r => new URLSearchParams(r.body.link.split('?')[1]).get('token');
test.before(async()=>{if(!server.listening)await once(server,'listening');base='http://127.0.0.1:'+server.address().port});
test.after(async()=>{server.close();await once(server,'close');fs.rmSync(dir,{recursive:true,force:true})});

test('request, owner approval, reissue and reset invalidate old credentials and consume token',async()=>{
  const submitted = await apply('user3');
  assert.equal(submitted.status,200);
  const id=submitted.body.id;
  await apply('user3');
  assert.equal(read().find(u=>u.id===3).passwordResetRequests.length,1);
  for(const actor of [undefined,2,3]){
    assert.ok([401,403].includes((await api('/password-reset/requests','GET',undefined,actor)).status));
    assert.ok([401,403].includes((await decide(id,'approve',actor||'invalid')).status));
  }
  assert.equal((await api(`/password-reset/requests/${id}/decision`,'POST',{action:'approve',note:''},1)).status,400);
  const approved=await decide(id);assert.equal(approved.status,200);
  assert.equal((await decide(id)).status,409);
  const original=tokenOf(approved);
  const issued=await decide(id,'reissue');assert.equal(issued.status,200);
  const token=tokenOf(issued);
  assert.notEqual(token,original);
  const listing=await api('/password-reset/requests','GET',undefined,1);
  assert.ok(!JSON.stringify(listing.body).includes('tokenHash'));
  assert.ok(!fs.readFileSync(file,'utf8').includes(token));
  assert.equal((await api('/password-reset/complete','POST',{token:original,password:'new-password'})).status,400);
  assert.equal((await api('/password-reset/complete','POST',{token,password:'short'})).status,400);
  assert.equal((await api('/password-reset/complete','POST',{token,password:'中'.repeat(25)})).status,400);
  const done=await api('/password-reset/complete','POST',{token,password:'new-password'});assert.equal(done.status,200);
  assert.equal((await api('/password-reset/complete','POST',{token,password:'another-password'})).status,400);
  assert.equal((await api('/auth/me','GET',undefined,3)).status,401);
  const old=await api('/auth/login','POST',{username:'user3',password:'old-password'});assert.notEqual(old.body.code,0);
  const login=await api('/auth/login','POST',{username:'user3',password:'new-password'});assert.equal(login.body.code,0);
  assert.equal((await api('/auth/me','GET',undefined,login.body.token)).status,200);
  assert.equal(read().find(u=>u.id===3).passwordResetRequests[0].status,'completed');
});

test('expiry, rejection and protected owner rules are enforced',async()=>{
  const owner=await apply('user1');assert.equal(owner.status,200);assert.equal(read()[0].passwordResetRequests,undefined);
  const missing=await apply('unknown');assert.equal(missing.status,200);
  const r=await apply('user4');const id=r.body.id;
  let users=read();users.find(u=>u.id===4).passwordResetRequests[0].expiresAt=Date.now()-1;save(users);
  assert.equal((await decide(id)).status,409);
  // Move the expired request outside the cooldown, then submit a new application.
  users=read();users.find(u=>u.id===4).passwordResetRequests[0].createdAt-=700000;save(users);
  const next=await apply('user4');assert.equal((await decide(next.body.id,'reject')).status,200);
  assert.equal((await decide(next.body.id)).status,409);
  users=read();users.find(u=>u.id===4).passwordResetRequests.forEach(r=>r.createdAt-=700000);save(users);
  const last=await apply('user4');const approval=await decide(last.body.id);assert.equal(approval.status,200);
  users=read();users.find(u=>u.id===4).passwordResetRequests.at(-1).expiresAt=Date.now()-1;save(users);
  assert.equal((await api('/password-reset/complete','POST',{token:tokenOf(approval),password:'new-password'})).status,400);
  assert.equal((await decide(last.body.id,'reissue')).status,200);
});

test('public endpoint limits repeated requests',async()=>{
  let response;
  for(let i=0;i<22;i++)response=await apply('unknown');
  assert.equal(response.status,429);
  const spoofed = await fetch(base+'/password-reset/requests', {method:'POST', headers:{'Content-Type':'application/json','X-Forwarded-For':'198.51.100.99'}, body:JSON.stringify({username:'unknown',realName:'Test',studentId:'12345',note:'Test'})});
  assert.equal(spoofed.status,429);
});
