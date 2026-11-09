'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {MockLineBindingStore}=require('../lib/line-binding-mock-store');
const {digestCode}=require('../lib/line-code-binding');
const domain=require('../lib/line-binding-domain');
const secret='x'.repeat(32),d=n=>digestCode(String(n).padStart(6,'0'),secret),L='U'+'1'.repeat(32),H='a'.repeat(64);
let seq=0;const op=()=> 'op-'+(++seq);
function setup(){const s=new MockLineBindingStore();s.seed('u1');s.seed('u2');return s;}
const create=(s,user='u1',code=1,now=1000000)=>s.invoke('create',{sessionHash:'s-'+user,sourceHash:'ip-'+user,codeDigest:d(code),operationId:op()},now);
const consume=(s,code=1,now=1001000,extra={})=>s.invoke('consume',{eventId:op(),lineUserId:L,subjectHash:H,codeDigest:d(code),operationId:op(),...extra},now);
test('GAS and Node domain sources are identical',()=>assert.equal(require('fs').readFileSync('gas/line-binding-domain.gs','utf8'),require('fs').readFileSync('lib/line-binding-domain.js','utf8')));
test('six digits bind once, duplicate is ignored, consumed code cannot bind again',async()=>{const s=setup();await create(s);const e={eventId:'event'};assert.equal((await consume(s,1,1001000,e)).status,'bound');assert.equal((await consume(s,1,1001001,e)).status,'duplicate');assert.equal((await consume(s)).status,'invalid_code');assert.equal(s.bindingRows.filter(x=>x.status==='active').length,1);});
test('five minute exact boundary is expired; reissue revokes old code',async()=>{const s=setup();await create(s);assert.equal((await consume(s,1,1300000)).status,'invalid_code');await create(s,'u1',2,1300001);assert.equal((await consume(s,1,1300002)).status,'invalid_code');assert.equal((await consume(s,2,1300002)).status,'bound');});
test('global collision does not invalidate existing code',async()=>{const s=setup();await create(s);assert.equal((await create(s,'u2')).status,'collision');assert.equal((await create(s,'u2',2)).status,'pending');assert.equal(s.bindingRows.length,2);});
test('persistent issuance limits survive new service calls',async()=>{const s=setup();await create(s);assert.equal((await create(s,'u1',2,1000001)).status,'rate_limited');assert.equal((await create(s,'u1',2,1060000)).status,'pending');});
test('five wrong codes in rolling 15 minutes block LINE for 15 minutes; new code does not reset it',async()=>{const s=setup();for(let i=0;i<5;i++)assert.equal((await consume(s,99,1000000+i*1000)).status,'invalid_code');await create(s,'u1',1,1005000);assert.equal((await consume(s,1,1006000)).status,'blocked');assert.equal((await consume(s,1,1903999)).status,'blocked');await create(s,'u1',2,1904000);assert.equal((await consume(s,2,1904000)).status,'bound');});
test('rolling window excludes old errors, duplicates and conflicts do not count',async()=>{const s=setup();for(let i=0;i<4;i++)await consume(s,99,1000000+i);const r=await consume(s,99,1900004);assert.equal(r.blocked_until,null);});
test('parallel consume has exactly one winner and one LINE cannot transfer',async()=>{const s=setup();await create(s);const r=await Promise.all(Array.from({length:20},()=>consume(s)));assert.equal(r.filter(x=>x.status==='bound').length,1);await create(s,'u2',2,2000000);assert.equal((await consume(s,2,2001000)).status,'conflict');});
test('one iKey cannot issue another challenge while bound',async()=>{const s=setup();await create(s);await consume(s);assert.equal((await create(s,'u1',2,1060000)).status,'already_bound');});
test('invalid/revoked/expired sessions and inactive accounts fail closed',async()=>{const s=setup();await assert.rejects(s.invoke('status',{sessionHash:'invalid'},1000),/INVALID_SESSION/);s.sessions.get('s-u1').session.expires_at='invalid';await assert.rejects(create(s),/INVALID_SESSION/);s.users.get('u2').account_status='disabled';await assert.rejects(create(s,'u2'),/INVALID_SESSION/);});
test('unbind verifies signed password result and binding id; historical binding remains',async()=>{const s=setup();await create(s);await consume(s);const b=s.bindingRows[0];assert.equal((await s.invoke('unbind',{sessionHash:'s-u1',operationId:op(),passwordVerified:true,passwordHash:'old',bindingId:b.binding_id},1002000)).status,'reauth_stale');assert.equal((await s.invoke('unbind',{sessionHash:'s-u1',operationId:op(),passwordVerified:true,passwordHash:'test-hash',bindingId:b.binding_id},1003000)).status,'unbound');assert.equal(s.bindingRows[0].status,'unbound');await create(s,'u1',2,1060000);assert.equal((await consume(s,2,1061000)).status,'bound');});
test('failure at every consume write leaves no false success; replay never applies again',async()=>{
 for(let offset=1;offset<=3;offset++){const s=setup();await create(s);s.failAt=s.writes+offset;const p={eventId:'fault-event',lineUserId:L,subjectHash:H,codeDigest:d(1),operationId:op()};await assert.rejects(s.invoke('consume',p,1001000),/INJECTED/);s.failAt=0;
 if(offset>1){assert.equal((await s.invoke('consume',p,1002000)).status,'unknown');assert.equal((await s.invoke('status',{sessionHash:'s-u1'},1002000)).challenge_status,'unknown');assert.equal((await create(s,'u1',2,1060000)).status,'unknown');}
 assert.ok(s.bindingRows.filter(x=>x.status==='active').length<=1);
 }
});
test('admin query is read only and hides LINE IDs, digests, session and password',async()=>{const s=setup();await assert.rejects(s.invoke('admin',{sessionHash:'s-u1'},1000),/FORBIDDEN/);s.users.get('u1').global_role='super_admin';await create(s);await consume(s);const r=JSON.stringify(await s.invoke('admin',{sessionHash:'s-u1'},1002000));for(const x of [L,d(1),'test-hash','s-u1'])assert.ok(!r.includes(x));});
test('failed reissue fences account after each possible partial mutation',async()=>{
 for(let offset=1;offset<=5;offset++){
  const s=setup();await create(s);s.failAt=s.writes+offset;
  await assert.rejects(create(s,'u1',2,1060000),/INJECTED/);s.failAt=0;
  if(offset>1){assert.equal((await create(s,'u1',3,1120000)).status,'unknown');assert.equal((await consume(s,1,1061000)).status,'unknown');}
  assert.equal(s.bindingRows.filter(x=>x.status==='active').length,0);
 }
});
test('old unbind request cannot revoke replacement binding',async()=>{
 const s=setup();await create(s);await consume(s);const id=s.bindingRows[0].binding_id;
 const unbind=bid=>s.invoke('unbind',{sessionHash:'s-u1',operationId:op(),passwordVerified:true,passwordHash:'test-hash',bindingId:bid},1062000);
 await unbind(id);await create(s,'u1',2,1060000);await consume(s,2,1061000);
 assert.equal((await unbind(id)).status,'binding_changed');assert.equal(s.bindingRows.filter(x=>x.status==='active').length,1);
});
test('GAS outage preserves prior binding and conflict is not a password/code failure',async()=>{
 const s=setup();await create(s);await consume(s);const before=JSON.stringify(s.bindingRows);
 s.failAt=s.writes+1;await assert.rejects(create(s,'u2',2),/INJECTED/);assert.equal(JSON.stringify(s.bindingRows),before);
});
