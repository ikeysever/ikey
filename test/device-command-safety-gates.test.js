'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {createDeviceCommandGateway} = require('../lib/device-command-gateway');

const PROJECT='123e4567-e89b-42d3-a456-426614174000';
const DEVICE='Y8R69EXB';
const ACTOR={user_id:'123e4567-e89b-42d3-a456-426614174001'};
const DEVICE_ACTOR={authenticated:true,device_id:DEVICE};
const PROOF='a'.repeat(64);
function fixture({actorAllowed=true,bound=true,response}={}){
 const calls=[];
 const gateway=createDeviceCommandGateway({
  call:async(action,payload)=>{calls.push({action,payload});return response?.(action,payload)??null;},
  verifyActor:async()=>actorAllowed,
  verifyDeviceBinding:async()=>bound,
  createClaimToken:()=>PROOF
 });
 return {gateway,calls};
}
test('rejects unauthenticated website actor without writing a command',async()=>{
 const {gateway,calls}=fixture();
 await assert.rejects(gateway.create({actor:null,project_id:PROJECT,device_id:DEVICE,idempotency_key:'test-key-123'}),/ACTOR_NOT_VERIFIED/);
 assert.equal(calls.length,0);
});
test('rejects website actor without project permission',async()=>{
 const {gateway,calls}=fixture({actorAllowed:false});
 await assert.rejects(gateway.create({actor:ACTOR,project_id:PROJECT,device_id:DEVICE,idempotency_key:'test-key-123'}),/PROJECT_ADMIN_REQUIRED/);
 assert.equal(calls.length,0);
});
test('rejects unbound devices for website and ESP32',async()=>{
 const {gateway,calls}=fixture({bound:false});
 await assert.rejects(gateway.create({actor:ACTOR,project_id:PROJECT,device_id:DEVICE,idempotency_key:'test-key-123'}),/DEVICE_BINDING_REQUIRED/);
 await assert.rejects(gateway.claim({device:DEVICE_ACTOR,project_id:PROJECT}),/DEVICE_BINDING_REQUIRED/);
 assert.equal(calls.length,0);
});
test('rejects unauthenticated ESP32 before claiming',async()=>{
 const {gateway,calls}=fixture();
 await assert.rejects(gateway.claim({device:{device_id:DEVICE},project_id:PROJECT}),/DEVICE_NOT_VERIFIED/);
 assert.equal(calls.length,0);
});
test('claim returns only approved fields and does not forward GAS secrets',async()=>{
 const {gateway,calls}=fixture({response:(action)=>action==='deviceCommandClaimAtomic'?{
  command_id:'123e4567-e89b-42d3-a456-426614174002',
  status:'claimed',action:'unlock',deadline_at:Date.now()+10000,
  private_key:'MUST_NOT_LEAK'
 }:null});
 const result=await gateway.claim({device:DEVICE_ACTOR,project_id:PROJECT});
 assert.equal(result.claim_token,PROOF);
 assert.equal(result.private_key,undefined);
 assert.equal(result.device_id,DEVICE);
 assert.equal(calls[0].action,'deviceCommandClaimAtomic');
});
test('rejects success report without observed feedback',async()=>{
 const {gateway,calls}=fixture();
 await assert.rejects(gateway.report({device:DEVICE_ACTOR,project_id:PROJECT,command_id:'x',claim_token:PROOF,status:'succeeded',feedback_observed:false}),/INVALID_RESULT/);
 assert.equal(calls.length,0);
});
