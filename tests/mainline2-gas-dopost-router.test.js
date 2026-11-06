'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const router=fs.readFileSync('staging/gas/ikey-command-dopost-router.candidate.gs','utf8');
test('sandbox GAS adapter delegates allowlisted commands and rejects legacy actions',()=>{
 const calls=[];
 const key='K'.repeat(40);
 const context={
  ikeyCommandDispatchCandidate_:(action,payload)=>{calls.push(['command',action,payload]);return {ok:true};},
  PropertiesService:{getScriptProperties:()=>({getProperty:name=>({IKEY_SANDBOX_COMMAND_HTTP_ENABLED:'true',IKEY_SANDBOX_COMMAND_GAS_KEY:key})[name]})},
  Utilities:{newBlob:value=>({getBytes:()=>Buffer.from(value)})},
  ikeyCommandEqual_:(a,b)=>a===b
 };
 vm.createContext(context);vm.runInContext(router,context);
 const result=context.ikeySandboxCommandHttpCandidate_({api_key:key,action:'deviceCommandGet',payload:{device_id:'ABCDEFGH'}});
 assert.equal(result.ok,true);
 assert.equal(calls.length,1);
 const denied=context.ikeySandboxCommandHttpCandidate_({api_key:key,action:'health',payload:{}});
 assert.equal(denied.ok,false);
 assert.equal(denied.error,'SANDBOX_COMMAND_ACTION_NOT_ALLOWED');
 assert.equal(calls.length,1);
});
test('all signed command actions are explicitly routed',()=>{
 const signer=fs.readFileSync('lib/command-trust-assertion.js','utf8');
 const verifier=fs.readFileSync('staging/gas/ikey-command-trust-verifier.candidate.gs','utf8');
 for(const action of ['deviceCommandCreateAtomic','deviceCommandGet','deviceCommandClaimAtomic','deviceCommandReportAtomic','deviceCommandExpireAtomic']){
  assert.ok(router.includes(action));assert.ok(signer.includes(action));assert.ok(verifier.includes(action));
 }
});
