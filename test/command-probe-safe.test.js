'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createSheetsStore}=require('../gen3-auth/sheets-store');
const PROJECT='00000000-0000-4000-8000-000000000001';
const ACTOR='00000000-0000-4000-8000-000000000002';
const COMMAND='00000000-0000-4000-8000-000000000003';
const payload={project_id:PROJECT,device_id:'Y8R69EXB',actor_user_id:ACTOR,command_id:COMMAND};
const original={...process.env};
test.after(()=>{process.env=original;});
test('probe is disabled by default and does not send network requests',async()=>{
 delete process.env.IKEY_COMMAND_PROBE_ENABLED;
 const store=createSheetsStoreWithDummyConfiguration();
 await assert.rejects(store.commandProbe(payload),/COMMAND_PROBE_DISABLED/);
});
test('probe rejects any extra or malformed fields before network',async()=>{
 process.env.IKEY_COMMAND_PROBE_ENABLED='true';
 const store=createSheetsStoreWithDummyConfiguration();
 await assert.rejects(store.commandProbe({...payload,action:'unlock'}),/INVALID_COMMAND_PROBE/);
 await assert.rejects(store.commandProbe({...payload,device_id:'invalid'}),/INVALID_COMMAND_PROBE/);
});
test('probe sends signed get-only request, never unlock',async()=>{
 process.env.IKEY_COMMAND_PROBE_ENABLED='true';
 process.env.IKEY_COMMAND_TRUST_SECRET='test-only-32-character-secret-0123456789';
 const store=createSheetsStoreWithDummyConfiguration();
 const previousFetch=global.fetch;let captured;
 global.fetch=async(_url,opts)=>{
  captured=JSON.parse(opts.body);
  return {ok:true,json:async()=>({ok:true,result:null})};
 };
 try{
  assert.equal(await store.commandProbe({...payload,device_id:'ABCDEFGH'}),null);
  assert.equal(captured.action,'deviceCommandGet');
  assert.equal(captured.payload.command_assertion.split('.').length,2);
  assert.equal(captured.payload.action,undefined);
 }finally{global.fetch=previousFetch;}
});
function createSheetsStoreWithDummyConfiguration(){
 process.env.GEN3_APPS_SCRIPT_URL='https://script.google.com/macros/s/test/exec';
 process.env.GEN3_APPS_SCRIPT_KEY='test-only-32-character-api-key-0123456789';
 return createSheetsStore();
}
