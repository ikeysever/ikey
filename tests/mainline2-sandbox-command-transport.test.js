'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('gen3-auth/sheets-store.js','utf8');
const moduleObj={exports:{}};
vm.runInNewContext(source,{module:moduleObj,require,process:{env:{}},URL,AbortController,Buffer,setTimeout,clearTimeout,console,fetch:async()=>{throw Error('UNEXPECTED_NETWORK');}});
const {createSheetsStore}=moduleObj.exports;
const base={
 GEN3_APPS_SCRIPT_URL:'https://script.google.com/macros/s/PRODUCTIONEXAMPLEDEPLOYMENT123456/exec',
 GEN3_APPS_SCRIPT_KEY:'P'.repeat(40),
 IKEY_COMMAND_TRUST_SECRET:'T'.repeat(40),
 IKEY_SANDBOX_COMMAND_TEST_ENABLED:'true',
 IKEY_PHYSICAL_UNLOCK_ENABLED:'false',
 IKEY_SANDBOX_COMMAND_GAS_DEPLOYMENT_ID:'SANDBOXEXAMPLEDEPLOYMENT123456',
 IKEY_SANDBOX_COMMAND_GAS_URL:'https://script.google.com/macros/s/SANDBOXEXAMPLEDEPLOYMENT123456/exec',
 IKEY_SANDBOX_COMMAND_GAS_KEY:'S'.repeat(40),
 IKEY_SANDBOX_COMMAND_TRUST_SECRET:'X'.repeat(40)
};
function make(overrides={}){
 const env={...base,...overrides};
 let count=0;
 const box={exports:{}};
 vm.runInNewContext(source,{
   module:box,require,process:{env},URL,AbortController,Buffer,setTimeout,clearTimeout,
   console:{warn(){},info(){}},fetch:async()=>{count++;throw Error('NETWORK_MUST_NOT_BE_CALLED');}
 });
 return {store:box.exports.createSheetsStore(),calls:()=>count};
}
const args=['deviceCommandGet',{project_id:'p',device_id:'d',actor_user_id:'a',command_id:'c'}];
for(const [name,override] of [
 ['missing URL',{IKEY_SANDBOX_COMMAND_GAS_URL:''}],
 ['missing key',{IKEY_SANDBOX_COMMAND_GAS_KEY:''}],
 ['missing deployment',{IKEY_SANDBOX_COMMAND_GAS_DEPLOYMENT_ID:''}],
 ['same key',{IKEY_SANDBOX_COMMAND_GAS_KEY:base.GEN3_APPS_SCRIPT_KEY}],
 ['same trust secret',{IKEY_SANDBOX_COMMAND_TRUST_SECRET:base.IKEY_COMMAND_TRUST_SECRET}],
 ['production URL',{IKEY_SANDBOX_COMMAND_GAS_URL:base.GEN3_APPS_SCRIPT_URL}],
 ['invalid host',{IKEY_SANDBOX_COMMAND_GAS_URL:'https://evil.example/macros/s/SANDBOXEXAMPLEDEPLOYMENT123456/exec'}],
 ['query string',{IKEY_SANDBOX_COMMAND_GAS_URL:base.IKEY_SANDBOX_COMMAND_GAS_URL+'?x=1'}],
 ['wrong deployment',{IKEY_SANDBOX_COMMAND_GAS_URL:'https://script.google.com/macros/s/DIFFERENTDEPLOYMENT123456789/exec'}],
 ['test disabled',{IKEY_SANDBOX_COMMAND_TEST_ENABLED:'false'}],
 ['physical enabled',{IKEY_PHYSICAL_UNLOCK_ENABLED:'true'}]
]){
 test('sandbox command rejects '+name+' without network',async()=>{
   const {store,calls}=make(override);
   await assert.rejects(store.commandCall(...args));
   assert.equal(calls(),0);
 });
}
test('sandbox commands never use shared GEN3 call fallback',()=>{
 assert.match(source,/return sandboxCommandCall\(action,/);
 assert.doesNotMatch(source,/return call\(action,\{\.\.\.payload,command_assertion:assertion\}\)/);
});
