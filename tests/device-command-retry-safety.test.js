'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createDeviceCommandGateway}=require('../lib/device-command-gateway');

const project='123e4567-e89b-42d3-a456-426614174000';
const commandId='123e4567-e89b-42d3-a456-426614174001';
const device={authenticated:true,device_id:'ABCDEFGH'};
const claimToken='a'.repeat(64);

function harness(){
 let state='queued';
 let storedProof=null;
 let reportCount=0;
 let acceptedReports=0;
 let claimCount=0;
 const call=async(action,payload)=>{
  if(action==='deviceCommandClaimAtomic'){
   claimCount++;
   if(state!=='queued')return {command:null};
   state='claimed';
   storedProof=payload.claim_token;
   return {command:{command_id:commandId,project_id:project,
    device_id:device.device_id,action:'unlock',status:'claimed',deadline_at:Date.now()+15000}};
  }
  if(action==='deviceCommandReportAtomic'){
   reportCount++;
   if(payload.claim_token!==storedProof)throw Error('CLAIM_PROOF_MISMATCH');
   if(state==='claimed'){state=payload.status;acceptedReports++;return {success:true,command:{command_id:commandId}};}
   if(state===payload.status)return {success:true,command:{command_id:commandId},duplicate:true};
   throw Error('TERMINAL_STATE_CONFLICT');
  }
  throw Error('UNEXPECTED_ACTION');
 };
 const gateway=createDeviceCommandGateway({call,verifyActor:async()=>true,
  verifyDeviceBinding:async()=>true,createClaimToken:()=>claimToken});
 return {gateway,stats:()=>({state,reportCount,acceptedReports,claimCount})};
}
test('a claimed command is not issued twice',async()=>{
 const h=harness();
 const first=await h.gateway.claim({device,project_id:project});
 assert.equal(first.command_id,commandId);
 assert.equal(await h.gateway.claim({device,project_id:project}),null);
 assert.equal(h.stats().claimCount,2);
});
test('repeated report is reconciled without another execution',async()=>{
 const h=harness();
 await h.gateway.claim({device,project_id:project});
 const input={device,project_id:project,command_id:commandId,claim_token:claimToken,
  status:'failed',feedback_observed:false};
 assert.equal((await h.gateway.report(input)).success,true);
 assert.equal((await h.gateway.report(input)).duplicate,true);
 assert.equal(h.stats().acceptedReports,1);
});
test('a terminal command cannot be changed to success on retry',async()=>{
 const h=harness();
 await h.gateway.claim({device,project_id:project});
 const input={device,project_id:project,command_id:commandId,claim_token:claimToken,
  status:'failed',feedback_observed:false};
 await h.gateway.report(input);
 await assert.rejects(h.gateway.report({...input,status:'succeeded',feedback_observed:true}),/TERMINAL_STATE_CONFLICT/);
 assert.equal(h.stats().state,'failed');
});
test('invalid proof cannot report a claimed command',async()=>{
 const h=harness();
 await h.gateway.claim({device,project_id:project});
 await assert.rejects(h.gateway.report({device,project_id:project,command_id:commandId,
  claim_token:'b'.repeat(64),status:'failed',feedback_observed:false}),/CLAIM_PROOF_MISMATCH/);
 assert.equal(h.stats().state,'claimed');
});
