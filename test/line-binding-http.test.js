'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),express=require('express');
const {createLineBindingService}=require('../lib/line-binding-service');
const {mountLineBindingRoutes}=require('../lib/line-binding-router');
const {mountLineIngress}=require('../lib/line-ingress');
const {MockLineBindingStore}=require('../lib/line-binding-mock-store');
const {passwordHash}=require('../gen3-auth/core');
const env={IKEY_LINE_BINDING_ENABLED:'true',IKEY_LINE_TRUST_SECRET:'t'.repeat(32),IKEY_LINE_CODE_SECRET:'c'.repeat(32),LINE_MESSAGING_CHANNEL_SECRET:'channel-secret',LINE_MESSAGING_ACCESS_TOKEN:'test-token'};
async function fixture(t){
 const s=new MockLineBindingStore();s.seed('u');const user=s.users.get('u');user.password_hash=passwordHash('test-pass-123');let sent=0,limit=true;
 const store={lineCall:async(action,e)=>{
  assert.equal(action,'lineBindingV2');const expected=crypto.createHmac('sha256',env.IKEY_LINE_TRUST_SECRET).update(e.action+'\n'+e.timestamp+'\n'+e.nonce+'\n'+e.body).digest('hex');assert.equal(e.signature,expected);return s.invoke(e.action,JSON.parse(e.body));
 },findById:async()=>user,throttleAtomic:async()=>limit};
 const service=createLineBindingService(store,env,async()=>{sent++;return {ok:false};});
 const app=express();mountLineIngress(app,{getService:()=>service});app.use(express.json());
 mountLineBindingRoutes(app,{service,csrfSecret:env.IKEY_LINE_TRUST_SECRET,requireUser:(req,res,next)=>{if(req.get('authorization')!=='test')return res.sendStatus(401);req.projectUser=user;req.projectSessionHash='s-u';next();}});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());const url='http://127.0.0.1:'+server.address().port;
 const req=async(path,body,extra={})=>{const response=await fetch(url+path,{headers:{authorization:'test',...(body?{'content-type':'application/json',origin:url}:{}),...extra},...(body?{method:'POST',body:JSON.stringify(body)}:{})});let data;try{data=await response.json();}catch{}return {status:response.status,data};};
 const status=await req('/api/line/status');
 return {s,user,service,req,csrf:status.data.csrf_token,url,store,sent:()=>sent,setLimit:x=>{limit=x;}};
}
test('HTTP uses session identity, rejects missing/wrong Origin and CSRF, invalid Session',async t=>{
 const f=await fixture(t);assert.equal((await f.req('/api/line/bind/start',{})).status,403);
 assert.equal((await f.req('/api/line/bind/start',{}, {'x-ikey-line-csrf':f.csrf,origin:'https://evil.invalid'})).status,403);
 assert.equal((await f.req('/api/line/status',null,{authorization:'bad'})).status,401);
 const r=await f.req('/api/line/bind/start',{user_id:'someone-else'},{'x-ikey-line-csrf':f.csrf});assert.equal(r.status,201);assert.match(r.data.code,/^\d{6}$/);assert.equal(f.s.bindingRows[0].user_id,'u');
});
test('wrong password does not unbind; successful unbind survives notification failure',async t=>{
 const f=await fixture(t);const c=await f.req('/api/line/bind/start',{}, {'x-ikey-line-csrf':f.csrf});
 await f.service.event({type:'message',source:{type:'user',userId:'U'+'1'.repeat(32)},message:{type:'text',text:c.data.code},webhookEventId:'event',replyToken:'reply'});
 const binding=f.s.bindingRows[0];const headers={'x-ikey-line-csrf':f.csrf};
 assert.equal((await f.req('/api/line/unbind',{password:'wrong',binding_id:binding.binding_id},headers)).status,401);assert.equal(binding.status,'active');
 f.setLimit(false);assert.equal((await f.req('/api/line/unbind',{password:'test-pass-123',binding_id:binding.binding_id},headers)).status,429);f.setLimit(true);
 const r=await f.req('/api/line/unbind',{password:'test-pass-123',binding_id:binding.binding_id},headers);assert.equal(r.status,200);assert.equal(r.data.notification_status,'failed');assert.equal(f.s.bindingRows[0].status,'unbound');assert.equal(f.sent(),2);assert.ok(!JSON.stringify(r.data).includes('U111'));
});
test('notifications sent once; non-code text ignored; admin cannot force unbind',async t=>{
 const f=await fixture(t);assert.equal((await f.service.event({type:'message',message:{type:'text',text:'hello'}})).status,'ignored');
 const c=await f.service.start('s-u','ip');const e={type:'message',source:{type:'user',userId:'U'+'2'.repeat(32)},message:{type:'text',text:c.code},webhookEventId:'same'};
 await f.service.event(e);await f.service.event(e);assert.equal(f.sent(),1);assert.ok(f.s.auditRows.some(x=>x.event_type==='notification'&&x.result==='failed'));assert.equal((await f.req('/api/admin/line-bindings')).status,403);
 assert.equal((await f.req('/api/admin/line-bindings/unbind',{}, {'x-ikey-line-csrf':f.csrf})).status,404);
});
test('GAS failure and disabled config never return a code or success',async t=>{
 const f=await fixture(t);f.store.lineCall=async()=>{throw Error('private error');};
 const r=await f.req('/api/line/bind/start',{}, {'x-ikey-line-csrf':f.csrf});assert.equal(r.status,503);assert.ok(!r.data.code?.match(/^\d{6}$/));assert.ok(!JSON.stringify(r.data).includes('private error'));
 const disabled=createLineBindingService(f.store,{...env,IKEY_LINE_BINDING_ENABLED:'false'});assert.equal(disabled.enabled(),false);await assert.rejects(disabled.start('s-u','ip'),/DISABLED/);
});
test('signed webhook handles multiple events, rejects invalid signature and unknown outcome',async t=>{
 const f=await fixture(t);const prior=process.env.LINE_MESSAGING_CHANNEL_SECRET;process.env.LINE_MESSAGING_CHANNEL_SECRET=env.LINE_MESSAGING_CHANNEL_SECRET;t.after(()=>{if(prior===undefined)delete process.env.LINE_MESSAGING_CHANNEL_SECRET;else process.env.LINE_MESSAGING_CHANNEL_SECRET=prior;});
 const post=async(events,invalid=false)=>{const body=JSON.stringify({events});const signature=crypto.createHmac('sha256',env.LINE_MESSAGING_CHANNEL_SECRET).update(body).digest('base64');return fetch(f.url+'/api/line/webhook',{method:'POST',headers:{'content-type':'application/json','x-line-signature':invalid?'invalid':signature},body});};
 assert.equal((await post([],true)).status,401);assert.equal((await post([{type:'follow'},{type:'message',message:{type:'text',text:'hello'}}])).status,200);
 const c=await f.service.start('s-u','ip');f.s.failAt=f.s.writes+3;const event={type:'message',source:{type:'user',userId:'U'+'3'.repeat(32)},message:{type:'text',text:c.code},webhookEventId:'unknown'};
 assert.equal((await post([event])).status,503);f.s.failAt=0;assert.equal((await post([event])).status,503);assert.equal(f.sent(),0);
});
