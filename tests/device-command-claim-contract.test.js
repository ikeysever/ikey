'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createDeviceCommandGateway}=require('../lib/device-command-gateway');
const project_id='22222222-2222-4222-8222-222222222222';
const device={authenticated:true,device_id:'ABCDEFGH'};
const make=(call,extra={})=>createDeviceCommandGateway({call,verifyActor:async()=>true,verifyDeviceBinding:async()=>true,...extra});
test('claim forwards random proof and returns it only to authenticated device',async()=>{
 let request;
 const api=make(async(action,p)=>{request={action,p};return {command_id:'33333333-3333-4333-8333-333333333333',status:'claimed'};});
 const result=await api.claim({device,project_id});
 assert.equal(request.action,'deviceCommandClaimAtomic');
 assert.equal(request.p.claim_token.length,64);
 assert.equal(result.claim_token,request.p.claim_token);
 assert.equal(result.claim_token_hash,undefined);
});
test('claim denies unauthenticated device without calling GAS',async()=>{
 let calls=0;
 const api=make(async()=>{calls++;return null;});
 await assert.rejects(api.claim({device:{...device,authenticated:false},project_id}),/DEVICE_NOT_VERIFIED/);
 assert.equal(calls,0);
});
test('claim rejects malformed GAS response',async()=>{
 const api=make(async()=>({ok:true}));
 await assert.rejects(api.claim({device,project_id}),/INVALID_CLAIM_RESPONSE/);
});
test('claim rejects malformed token generator output',async()=>{
 let calls=0;
 const api=make(async()=>{calls++;return null;},{createClaimToken:()=> 'invalid'});
 await assert.rejects(api.claim({device,project_id}),/INVALID_CLAIM_TOKEN/);
 assert.equal(calls,0);
});
