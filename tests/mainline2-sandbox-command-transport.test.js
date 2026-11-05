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

function makeNetwork(overrides={},handler){
 const env={...base,...overrides};
 const calls=[];
 const box={exports:{}};
 const cryptoStub={};
 vm.runInNewContext(source,{
   module:box,require:(name)=>{
     if(name==='../lib/command-trust-assertion')return {signCommandAssertion:()=> 'test.assertion'};
     throw Error('UNEXPECTED_REQUIRE');
   },
   process:{env},URL,AbortController,Buffer,setTimeout,clearTimeout,
   console:{warn(){},info(){}},
   fetch:async(url,opts)=>{
     calls.push({url:String(url),method:opts.method,redirect:opts.redirect});
     return handler(url,opts,calls.length);
   }
 });
 return {store:box.exports.createSheetsStore(),calls};
}
test('valid sandbox command uses only isolated URL and explicit redirect policy',async()=>{
 const {store,calls}=makeNetwork({},async()=>({ok:true,status:200,json:async()=>({ok:true,result:{status:'pending'}})}));
 const result=await store.commandCall('deviceCommandGet',args[1]);
 assert.equal(result.status,'pending');
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,base.IKEY_SANDBOX_COMMAND_GAS_URL);
 assert.equal(calls[0].method,'POST');
 assert.equal(calls[0].redirect,'manual');
});
test('malicious redirect is rejected without second request',async()=>{
 const {store,calls}=makeNetwork({},async()=>({
   ok:false,status:302,headers:{get:()=> 'https://evil.example/steal'}
 }));
 await assert.rejects(store.commandCall('deviceCommandGet',args[1]),/SANDBOX_COMMAND_REDIRECT_REJECTED/);
 assert.equal(calls.length,1);
});
test('network failure never retries against GEN3 storage URL',async()=>{
 const {store,calls}=makeNetwork({},async()=>{throw Error('SANDBOX_NETWORK_DOWN')});
 await assert.rejects(store.commandCall('deviceCommandGet',args[1]),/SANDBOX_NETWORK_DOWN/);
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,base.IKEY_SANDBOX_COMMAND_GAS_URL);
});
test('valid Googleusercontent redirect follows with GET and no credential body',async()=>{
 const destination='https://script.googleusercontent.com/macros/echo?user_content_key=example';
 const {store,calls}=makeNetwork({},async(_url,_opts,count)=>{
   if(count===1)return {ok:false,status:302,headers:{get:()=>destination}};
   return {ok:true,status:200,json:async()=>({ok:true,result:{status:'claimed'}})};
 });
 const result=await store.commandCall('deviceCommandGet',args[1]);
 assert.equal(result.status,'claimed');
 assert.equal(calls.length,2);
 assert.equal(calls[1].url,destination);
 assert.equal(calls[1].method,'GET');
});
