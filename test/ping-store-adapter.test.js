'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createPingStoreAdapter}=require('../gen3-auth/ping-store-adapter');
const project_id='11111111-1111-4111-8111-111111111111';
const command_id='22222222-2222-4222-8222-222222222222';
const device_id='Y8R69EXB';
const assertion='a'.repeat(64);
test('ping adapter maps four operations to dedicated GAS actions',async()=>{
 const calls=[];
 const adapter=createPingStoreAdapter(async(action,payload)=>{calls.push({action,payload});return {ok:true}});
 for(const operation of ['create','claim','report','status']){
  await adapter.execute(operation,{project_id,device_id,command_id,result:'completed',assertion});
 }
 assert.deepEqual(calls.map(x=>x.action),['devicePingCreate','devicePingClaim','devicePingReport','devicePingStatus']);
 assert.deepEqual(Object.keys(calls[0].payload).sort(),['command_assertion','device_id','project_id']);
 assert.deepEqual(Object.keys(calls[2].payload).sort(),['command_assertion','command_id','device_id','project_id','result']);
});
test('ping adapter rejects malformed scope, missing assertion and unsafe operation',async()=>{
 let calls=0;
 const adapter=createPingStoreAdapter(async()=>{calls++;return {ok:true}});
 const base={project_id,device_id,command_id,assertion,result:'completed'};
 for(const [op,payload] of [
  ['unlock',base],['create',{...base,project_id:'bad'}],
  ['claim',{...base,device_id:'BAD'}],['create',{...base,assertion:''}],
  ['report',{...base,result:'unlocked'}],['status',{...base,command_id:'bad'}]
 ])await assert.rejects(adapter.execute(op,payload));
 assert.equal(calls,0);
});
test('ping adapter fails closed on missing or malformed GAS response',async()=>{
 const adapter=createPingStoreAdapter(async()=>null);
 await assert.rejects(adapter.execute('claim',{project_id,device_id,assertion}),/PING_RESPONSE_INVALID/);
});
