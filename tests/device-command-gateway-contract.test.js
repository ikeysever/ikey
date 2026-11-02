'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createDeviceCommandGateway}=require('../lib/device-command-gateway');
const project='123e4567-e89b-42d3-a456-426614174000';
const id='123e4567-e89b-42d3-a456-426614174001';
const device={authenticated:true,device_id:'ABCDEFGH'};
const proof='a'.repeat(64);
const base={command_id:id,project_id:project,device_id:device.device_id,action:'unlock',status:'claimed',deadline_at:Date.now()+15000};
function gateway(response,reportResponse={success:true}){
 return createDeviceCommandGateway({
  call:async(action)=>action==='deviceCommandClaimAtomic'?response:reportResponse,
  verifyActor:async()=>true,
  verifyDeviceBinding:async()=>true,
  createClaimToken:()=>proof
 });
}
test('claim only returns bound, unexpired command',async()=>{
 const result=await gateway({command:base}).claim({device,project_id:project});
 assert.equal(result.command_id,id);
 assert.equal(result.claim_token,proof);
});
for(const [name,change] of [
 ['foreign project',{project_id:'123e4567-e89b-42d3-a456-426614174099'}],
 ['foreign device',{device_id:'BCDEFGHJ'}],
 ['expired',{deadline_at:Date.now()-1000}],
 ['implausible deadline',{deadline_at:Date.now()+120000}],
 ['malformed ID',{command_id:'bad'}],
 ['wrong action',{action:'lock'}]
]){
 test('rejects '+name,async()=>{
  await assert.rejects(gateway({command:{...base,...change}}).claim({device,project_id:project}),/INVALID_CLAIM_RESPONSE/);
 });
}
test('rejects malformed report proof',async()=>{
 await assert.rejects(gateway(null).report({device,project_id:project,command_id:id,claim_token:'bad',status:'failed',feedback_observed:false}),/INVALID_CLAIM_TOKEN/);
});
test('rejects negative GAS acknowledgement',async()=>{
 await assert.rejects(gateway(null,{success:false}).report({device,project_id:project,command_id:id,claim_token:proof,status:'failed',feedback_observed:false}),/INVALID_REPORT_RESPONSE/);
});
test('rejects report acknowledgement for another command',async()=>{
 await assert.rejects(gateway(null,{command:{command_id:'123e4567-e89b-42d3-a456-426614174099'}}).report({device,project_id:project,command_id:id,claim_token:proof,status:'failed',feedback_observed:false}),/INVALID_REPORT_RESPONSE/);
});
