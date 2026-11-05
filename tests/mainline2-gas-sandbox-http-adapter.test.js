'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('staging/gas/ikey-command-dopost-router.candidate.gs','utf8');
const key='S'.repeat(40);
function setup(props={},handler=()=>({command_id:'test'})){
 const calls=[];
 const context={
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>({...{
   IKEY_SANDBOX_COMMAND_HTTP_ENABLED:'true',
   IKEY_SANDBOX_COMMAND_GAS_KEY:key
  },...props})[k]})},
  Utilities:{newBlob:s=>({getBytes:()=>Buffer.from(s,'utf8')})},
  ikeyCommandEqual_:(a,b)=>typeof a==='string'&&typeof b==='string'&&a===b,
  ikeyCommandDispatchCandidate_:(action,payload)=>{calls.push(['command',action]);return handler(action,payload)}
 };
 vm.createContext(context);vm.runInContext(source,context);
 const legacy=(action,payload)=>{calls.push(['legacy',action]);return {legacy:true}};
 return {run:req=>context.ikeySandboxCommandHttpCandidate_(req,legacy),calls};
}
const valid={api_key:key,action:'deviceCommandGet',payload:{command_assertion:'mock'}};
test('valid sandbox request dispatches command after key check',()=>{
 const {run,calls}=setup();
 assert.equal(run(valid).ok,true);
 assert.deepEqual(calls,[['command','deviceCommandGet']]);
});
test('sandbox credentials cannot access legacy GAS routes',()=>{
 const {run,calls}=setup();
 for(const action of ['health','db.get','login','deviceCommandUnknown']){
  const response=run({...valid,action});
  assert.equal(response.ok,false);
  assert.equal(response.error,'SANDBOX_COMMAND_ACTION_NOT_ALLOWED');
 }
 assert.deepEqual(calls,[]);
});
for(const [name,props,request,expected] of [
 ['disabled',{IKEY_SANDBOX_COMMAND_HTTP_ENABLED:'false'},valid,'SANDBOX_COMMAND_DISABLED'],
 ['missing key',{IKEY_SANDBOX_COMMAND_GAS_KEY:''},valid,'SANDBOX_COMMAND_KEY_NOT_CONFIGURED'],
 ['wrong key',{}, {...valid,api_key:'WRONG'},'UNAUTHORIZED'],
 ['missing key input',{}, {...valid,api_key:undefined},'UNAUTHORIZED'],
 ['invalid payload',{}, {...valid,payload:[]},'INVALID_PAYLOAD'],
 ['invalid action',{}, {...valid,action:''},'INVALID_ACTION']
]){
 test(name+' fails before dispatch',()=>{
  const {run,calls}=setup(props);
  const result=run(request);
  assert.equal(result.ok,false);
  assert.equal(result.error,expected);
  assert.equal(calls.length,0);
 });
}
test('command action succeeds without a legacy dispatch handler',()=>{
 const {run,calls}=setup();
 assert.equal(run(valid).ok,true);
 assert.deepEqual(calls,[['command','deviceCommandGet']]);
});
test('dispatcher errors are sanitized',()=>{
 const {run}=setup({},()=>{throw Error('INTERNAL_SECRET_DETAIL')});
 const result=run(valid);
 assert.equal(result.ok,false);
 assert.equal(result.error,'SANDBOX_COMMAND_FAILED');
});
test('no doPost function is replaced in staging candidate',()=>{
 assert.doesNotMatch(source,/function\s+doPost\s*\(/);
});
