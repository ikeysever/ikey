'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const router=fs.readFileSync('staging/gas/ikey-command-dopost-router.candidate.gs','utf8');
test('candidate GAS router delegates command actions only',()=>{
 const calls=[];
 const context={ikeyCommandDispatchCandidate_:(action,payload)=>{calls.push(['command',action,payload]);return {ok:true};}};
 vm.createContext(context);vm.runInContext(router,context);
 const result=context.ikeyCommandRouteCandidate_('deviceCommandGet',{device_id:'ABCDEFGH'},()=>{throw Error('unexpected legacy dispatch');});
 assert.equal(result.ok,true);
 assert.equal(calls.length,1);
 const fallback=context.ikeyCommandRouteCandidate_('health',{},()=>42);
 assert.equal(fallback,42);
});
test('all signed command actions are explicitly routed',()=>{
 const signer=fs.readFileSync('lib/command-trust-assertion.js','utf8');
 const verifier=fs.readFileSync('staging/gas/ikey-command-trust-verifier.candidate.gs','utf8');
 for(const action of ['deviceCommandCreateAtomic','deviceCommandGet','deviceCommandClaimAtomic','deviceCommandReportAtomic','deviceCommandExpireAtomic']){
  assert.ok(router.includes(action));assert.ok(signer.includes(action));assert.ok(verifier.includes(action));
 }
});
