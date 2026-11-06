'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const nonceSource=fs.readFileSync(path.join(__dirname,'../gas-staging/ikey-ping-nonce-ledger.gs'),'utf8');
const dispatcherSource=fs.readFileSync(path.join(__dirname,'../gas-staging/ikey-ping-dispatcher.gs'),'utf8');
test('durable nonce ledger rejects duplicate nonce under lock',()=>{
 const rows=[['nonce','expires_at']];
 let locked=false;
 const sheet={
  getLastRow:()=>rows.length,
  getRange(r,c,n=1){return {getValues:()=>rows.slice(r-1,r-1+n).map(row=>row.slice(c-1,c+1))}},
  appendRow:row=>rows.push(row)
 };
 const ctx={
  Date,Error,Number,
  PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'staging-sheet'})},
  SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet})},
  LockService:{getScriptLock:()=>({
   tryLock:()=>{if(locked)return false;locked=true;return true},
   releaseLock:()=>{locked=false}
  })}
 };
 vm.createContext(ctx);vm.runInContext(nonceSource,ctx);
 const nonce='a'.repeat(32),expiry=Date.now()+30000;
 ctx.ikeyPingConsumeNonce_(nonce,expiry);
 assert.equal(rows.length,2);
 assert.throws(()=>ctx.ikeyPingConsumeNonce_(nonce,expiry),/PING_ASSERTION_REPLAY/);
 assert.equal(locked,false);
});
test('dispatcher requires independent Web or device authorization',()=>{
 const calls=[];
 const ctx={
  ikeyPingVerifyAssertion_:(action,p)=>({actor_user_id:action==='devicePingCreate'?'owner':null,project_id:p.project_id,device_id:p.device_id}),
  ikeyPingCommandAction_:(action,p)=>{calls.push(action);return {ok:true}}
 };
 vm.createContext(ctx);vm.runInContext(dispatcherSource,ctx);
 const p={project_id:'project',device_id:'device'};
 assert.throws(()=>ctx.ikeyPingDispatchAuthorized_('devicePingCreate',p,{}),/PING_AUTHORIZATION_NOT_CONFIGURED/);
 const deny={verifyWebOwner:()=>false,verifyDeviceBinding:()=>false};
 assert.throws(()=>ctx.ikeyPingDispatchAuthorized_('devicePingCreate',p,deny),/PING_PROJECT_ACCESS_DENIED/);
 assert.throws(()=>ctx.ikeyPingDispatchAuthorized_('devicePingClaim',p,deny),/PING_DEVICE_ACCESS_DENIED/);
 const allow={verifyWebOwner:()=>true,verifyDeviceBinding:()=>true};
 assert.equal(ctx.ikeyPingDispatchAuthorized_('devicePingCreate',p,allow).ok,true);
 assert.equal(ctx.ikeyPingDispatchAuthorized_('devicePingClaim',p,allow).ok,true);
 assert.deepEqual(calls,['devicePingCreate','devicePingClaim']);
});
