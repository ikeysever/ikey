'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {createSignedPingStore}=require('../gen3-auth/signed-ping-store');
const project_id='11111111-1111-4111-8111-111111111111';
const device_id='Y8R69EXB';
const command_id='22222222-2222-4222-8222-222222222222';
const secret='s'.repeat(64);
function claimsFrom(assertion){return JSON.parse(Buffer.from(assertion.split('.')[0],'base64url').toString('utf8'))}
test('web actor signed for create/status; device principal signed for claim/report',async()=>{
 const calls=[];
 const bridge=createSignedPingStore({secret,call:async(action,payload)=>{calls.push({action,payload});return {ok:true}}});
 await bridge.execute('create',{project_id,device_id,actor_user_id:'web-owner'});
 await bridge.execute('status',{project_id,device_id,command_id,actor_user_id:'web-owner'});
 await bridge.execute('claim',{project_id,device_id,device_authenticated:true});
 await bridge.execute('report',{project_id,device_id,command_id,result:'completed',device_authenticated:true});
 assert.deepEqual(calls.map(x=>x.action),['devicePingCreate','devicePingStatus','devicePingClaim','devicePingReport']);
 assert.deepEqual(calls.map(x=>claimsFrom(x.payload.command_assertion).actor_user_id),['web-owner','web-owner',null,null]);
 for(const {action,payload} of calls){
  const [body,signature]=payload.command_assertion.split('.');
  const expected=crypto.createHmac('sha256',secret).update(body).digest('base64url');
  assert.equal(signature,expected);
  const claims=claimsFrom(payload.command_assertion);
  assert.equal(claims.action,action);
  const clean={...payload};delete clean.command_assertion;
  const canonical=JSON.stringify(Object.fromEntries(Object.keys(clean).sort().map(k=>[k,clean[k]])));
  assert.equal(claims.payload_sha256,crypto.createHash('sha256').update(canonical).digest('hex'));
 }
});
test('rejects device impersonating Web actor and Web actor impersonating device',async()=>{
 let calls=0;
 const bridge=createSignedPingStore({secret,call:async()=>{calls++;return {ok:true}}});
 await assert.rejects(bridge.execute('create',{project_id,device_id,device_authenticated:true}));
 await assert.rejects(bridge.execute('claim',{project_id,device_id,actor_user_id:'web-owner'}));
 await assert.rejects(bridge.execute('report',{project_id,device_id,command_id,result:'completed',actor_user_id:'web-owner',device_authenticated:true}));
 assert.equal(calls,0);
});
