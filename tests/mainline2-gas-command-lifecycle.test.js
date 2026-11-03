'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('staging/gas/ikey-device-command-dispatch.candidate.gs','utf8');
const project='123e4567-e89b-42d3-a456-426614174000';
const actor='123e4567-e89b-42d3-a456-426614174001';
const device='ABCDEFGH';
const headers=['command_id','project_id','device_id','actor_user_id','action','status','idempotency_key','created_at','expires_at','claim_token','claimed_at','result_status','feedback_observed','reported_at'];
function harness(){
 const rows=[headers];let nonceCalls=0;
 const sheet={
  getLastColumn:()=>14,getLastRow:()=>rows.length,
  getRange:(r,c,n=1,w=1)=>({
   getDisplayValue:()=>String(rows[r-1][c-1]),
   getDisplayValues:()=>rows.slice(r-1,r-1+n).map(row=>row.slice(c-1,c-1+w).map(String)),
   setValue:v=>{rows[r-1][c-1]=v;}
  }),
  appendRow:r=>rows.push(r)
 };
 const context={
  Date,
  PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'sandbox-only'})},
  SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),flush:()=>{}},
  LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},
  Utilities:{getUuid:()=> '123e4567-e89b-42d3-a456-426614174099'},
  ikeyCommandAuthorizeCandidate_:()=>{nonceCalls++;},
  ikeyCommandDigest_:v=>'hash:'+v.claim_token
 };
 vm.createContext(context);vm.runInContext(source,context);
 return {dispatch:context.ikeyCommandDispatchCandidate_,rows,nonceCalls:()=>nonceCalls};
}
test('GAS create -> claim -> report -> get lifecycle executes on mock sheet',()=>{
 const h=harness();
 const p={project_id:project,device_id:device,actor_user_id:actor,action:'unlock',idempotency_key:'test-key-123',timeout_ms:60000};
 const created=h.dispatch('deviceCommandCreateAtomic',p);
 assert.equal(created.command.status,'pending');
 assert.equal(h.rows.length,2);
 assert.equal(h.dispatch('deviceCommandCreateAtomic',p).duplicate,true);
 const proof='a'.repeat(64);
 const claim=h.dispatch('deviceCommandClaimAtomic',{project_id:project,device_id:device,claim_token:proof});
 assert.equal(claim.command.status,'claimed');
 assert.equal(h.rows[1][9],'hash:'+proof);
 const report=h.dispatch('deviceCommandReportAtomic',{project_id:project,device_id:device,command_id:created.command.command_id,claim_token:proof,status:'failed',feedback_observed:false});
 assert.equal(report.status,'failed');
 const got=h.dispatch('deviceCommandGet',{project_id:project,device_id:device,actor_user_id:actor,command_id:created.command.command_id});
 assert.equal(got.status,'failed');
 assert.equal(h.nonceCalls(),5);
});
test('GAS report rejects incorrect claim token and double report',()=>{
 const h=harness();
 const p={project_id:project,device_id:device,actor_user_id:actor,action:'unlock',idempotency_key:'test-key-456',timeout_ms:60000};
 const id=h.dispatch('deviceCommandCreateAtomic',p).command.command_id;
 h.dispatch('deviceCommandClaimAtomic',{project_id:project,device_id:device,claim_token:'b'.repeat(64)});
 const base={project_id:project,device_id:device,command_id:id,status:'failed',feedback_observed:false};
 assert.throws(()=>h.dispatch('deviceCommandReportAtomic',{...base,claim_token:'c'.repeat(64)}),/COMMAND_CLAIM_MISMATCH/);
 h.dispatch('deviceCommandReportAtomic',{...base,claim_token:'b'.repeat(64)});
 assert.throws(()=>h.dispatch('deviceCommandReportAtomic',{...base,claim_token:'b'.repeat(64)}),/COMMAND_ALREADY_REPORTED/);
});
test('GAS refuses actor idempotency collision',()=>{
 const h=harness();
 const p={project_id:project,device_id:device,actor_user_id:actor,action:'unlock',idempotency_key:'test-key-789',timeout_ms:60000};
 h.dispatch('deviceCommandCreateAtomic',p);
 assert.throws(()=>h.dispatch('deviceCommandCreateAtomic',{...p,actor_user_id:'123e4567-e89b-42d3-a456-426614174002'}),/COMMAND_IDEMPOTENCY_CONFLICT/);
});
