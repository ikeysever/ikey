'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createDeviceCommandGateway}=require('../lib/device-command-gateway');
const actor={user_id:'11111111-1111-4111-8111-111111111111'};
const device={authenticated:true,device_id:'ABCDEFGH'};
const project_id='22222222-2222-4222-8222-222222222222';
function gateway({admin=true,bound=true}={}){
 const calls=[];
 const api=createDeviceCommandGateway({
  call:async(action,payload)=>{calls.push({action,payload});return {ok:true};},
  verifyActor:async()=>admin,verifyDeviceBinding:async()=>bound
 });
 return {api,calls};
}
test('gateway fails closed when security dependencies absent',()=>assert.throws(()=>createDeviceCommandGateway({}),/DEPENDENCIES/));
test('browser-supplied actor ID cannot bypass verified actor requirement',async()=>{
 const {api,calls}=gateway();
 await assert.rejects(api.create({actor:null,project_id,device_id:device.device_id,idempotency_key:'12345678'}),/ACTOR_NOT_VERIFIED/);
 assert.equal(calls.length,0);
});
test('non-admin and unbound device never dispatch command',async()=>{
 for(const options of [{admin:false},{bound:false}]){
  const {api,calls}=gateway(options);
  await assert.rejects(api.create({actor,project_id,device_id:device.device_id,idempotency_key:'12345678'}));
  assert.equal(calls.length,0);
 }
});
test('create forwards only trusted actor identity to dedicated action',async()=>{
 const {api,calls}=gateway();
 await api.create({actor,project_id,device_id:device.device_id,idempotency_key:'12345678'});
 assert.equal(calls[0].action,'deviceCommandCreateAtomic');
 assert.equal(calls[0].payload.actor_user_id,actor.user_id);
});
test('device must be authenticated to claim and report',async()=>{
 const {api,calls}=gateway();
 await assert.rejects(api.claim({device:{authenticated:false,device_id:device.device_id},project_id}),/DEVICE_NOT_VERIFIED/);
 await assert.rejects(api.report({device:{authenticated:false,device_id:device.device_id},project_id,command_id:'abc',claim_token:'x',status:'failed',feedback_observed:false}),/DEVICE_NOT_VERIFIED/);
 assert.equal(calls.length,0);
});
test('success without lock feedback is never forwarded',async()=>{
 const {api,calls}=gateway();
 await assert.rejects(api.report({device,project_id,command_id:'abc',claim_token:'x',status:'succeeded',feedback_observed:false}),/INVALID_RESULT/);
 assert.equal(calls.length,0);
});
test('authenticated device may claim through dedicated action',async()=>{
 const {api,calls}=gateway();await api.claim({device,project_id});
 assert.equal(calls[0].action,'deviceCommandClaimAtomic');
 assert.equal(calls[0].payload.device_id,device.device_id);
});
