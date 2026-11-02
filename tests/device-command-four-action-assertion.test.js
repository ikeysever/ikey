'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createDeviceCommandGateway}=require('../lib/device-command-gateway');
const {signCommandAssertion,commandPayloadDigest}=require('../lib/command-trust-assertion');
const secret='s'.repeat(48),actor={user_id:'123e4567-e89b-42d3-a456-426614174000'};
const project_id='123e4567-e89b-42d3-a456-426614174001',device_id='ABCDEFGH';
const decode=token=>JSON.parse(Buffer.from(token.split('.')[0],'base64url').toString());
test('Create/Get sign authenticated actor; Claim/Report sign device-only context',async()=>{
 const calls=[];
 const gateway=createDeviceCommandGateway({
  call:async(action,payload)=>{calls.push({action,payload});if(action==='deviceCommandClaimAtomic')return null;if(action==='deviceCommandCreateAtomic')return {command:{command_id:project_id}};return {};},
  verifyActor:async()=>true,verifyDeviceBinding:async()=>true
 });
 await gateway.create({actor,project_id,device_id,idempotency_key:'idempotency-001',action:'unlock',timeout_ms:15000});
 await gateway.get({actor,project_id,device_id,command_id:project_id});
 await gateway.claim({device:{authenticated:true,device_id},project_id});
 await gateway.report({device:{authenticated:true,device_id},project_id,command_id:project_id,claim_token:'a'.repeat(64),status:'failed',feedback_observed:false});
 assert.deepEqual(calls.map(x=>x.action),['deviceCommandCreateAtomic','deviceCommandGet','deviceCommandClaimAtomic','deviceCommandReportAtomic']);
 for(const {action,payload} of calls){
  const admin=['deviceCommandCreateAtomic','deviceCommandGet'].includes(action);
  assert.equal(payload.actor_user_id,admin?actor.user_id:undefined);
  const claims=decode(signCommandAssertion({secret,action,project_id,device_id,actor_user_id:payload.actor_user_id,payload}));
  assert.equal(claims.action,action);
  assert.equal(claims.project_id,project_id);
  assert.equal(claims.device_id,device_id);
  assert.equal(claims.actor_user_id,admin?actor.user_id:null);
  assert.equal(claims.payload_sha256,commandPayloadDigest(payload));
 }
});
test('device actions reject missing authenticated device before signing',async()=>{
 const gateway=createDeviceCommandGateway({call:async()=>{throw Error('MUST_NOT_CALL');},verifyActor:async()=>true,verifyDeviceBinding:async()=>true});
 await assert.rejects(gateway.claim({device:{authenticated:false,device_id},project_id}),/DEVICE_NOT_VERIFIED/);
 await assert.rejects(gateway.report({device:null,project_id}),/DEVICE_NOT_VERIFIED/);
});
