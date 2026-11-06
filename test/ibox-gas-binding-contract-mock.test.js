'use strict';
// Isolated mock of the user-supplied GAS factoryDeviceBind contract.
// This does NOT invoke or attest the deployed Apps Script project.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const DEVICE='Y8R69EXB';
const P1='11111111-1111-4111-8111-111111111111';
const P2='22222222-2222-4222-8222-222222222222';
function sandbox({factoryActive=true,initial=[],authorized=()=>true}={}){
 const rows=initial.map(row=>({...row}));
 let lock=Promise.resolve();
 async function bind({actor_user_id,project_id,device_id}){
  if(!authorized(actor_user_id,project_id))throw Error('DEVICE_AUTH_NOT_READY');
  // Mock serialized GAS ScriptLock; hold across check and append.
  const previous=lock;
  let release;
  lock=new Promise(resolve=>{release=resolve});
  await previous;
  try{
   if(!factoryActive)return {bound:false};
   if(rows.some(row=>row.device_id===device_id))return {bound:false};
   await Promise.resolve(); // force interleaving opportunity
   rows.push({binding_id:randomUUID(),project_id,device_id,actor_user_id});
   return {bound:true};
  }finally{release()}
 }
 return {rows,bind};
}
test('isolated GAS contract mock: concurrent cross-project binding has one winner',async()=>{
 const env=sandbox();
 const results=await Promise.all([
  env.bind({actor_user_id:'owner-1',project_id:P1,device_id:DEVICE}),
  env.bind({actor_user_id:'owner-2',project_id:P2,device_id:DEVICE})
 ]);
 assert.deepEqual(results.map(x=>x.bound).sort(),[false,true]);
 assert.equal(env.rows.length,1);
});
test('isolated GAS contract mock: legacy UUID binding id still prevents rebind',async()=>{
 const env=sandbox({initial:[{binding_id:randomUUID(),project_id:P1,device_id:DEVICE}]});
 assert.deepEqual(await env.bind({actor_user_id:'owner-2',project_id:P2,device_id:DEVICE}),{bound:false});
 assert.equal(env.rows.length,1);
});
test('isolated GAS contract mock: unauthorized actor never writes',async()=>{
 const env=sandbox({authorized:()=>false});
 await assert.rejects(env.bind({actor_user_id:'guest',project_id:P1,device_id:DEVICE}),/DEVICE_AUTH_NOT_READY/);
 assert.equal(env.rows.length,0);
});
test('isolated GAS contract mock: inactive factory device never binds',async()=>{
 const env=sandbox({factoryActive:false});
 assert.deepEqual(await env.bind({actor_user_id:'owner',project_id:P1,device_id:DEVICE}),{bound:false});
 assert.equal(env.rows.length,0);
});
