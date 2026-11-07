'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createGasPingBridge}=require('../gen3-auth/gas-ping-bridge');
const {createHmac}=require('node:crypto');
const project_id='11111111-1111-4111-8111-111111111111';
const device_id='Y8R69EXB';
const secret='x'.repeat(40);
test('GAS ping bridge is disabled by default',()=>{
 const before=process.env.IKEY_GAS_PING_ENABLED;
 delete process.env.IKEY_GAS_PING_ENABLED;
 try{assert.throws(()=>createGasPingBridge({store:{pingCall:()=>{}}}),/GAS_PING_DISABLED/)}
 finally{if(before!==undefined)process.env.IKEY_GAS_PING_ENABLED=before}
});
test('GAS ping bridge signs and forwards Web and device actions',async()=>{
 const before=process.env.IKEY_GAS_PING_ENABLED;
 process.env.IKEY_GAS_PING_ENABLED='true';
 try{
  const seen=[];
  const bridge=createGasPingBridge({secret,store:{pingCall:async(action,payload)=>{
   const [body,signature]=payload.command_assertion.split('.');
   assert.equal(createHmac('sha256',secret).update(body).digest('base64url'),signature);
   const claims=JSON.parse(Buffer.from(body,'base64url').toString());
   assert.equal(claims.action,action);
   assert.equal(claims.project_id,project_id);
   assert.equal(claims.device_id,device_id);
   seen.push(action);
   return {ok:true};
  }}});
  await bridge.execute('create',{project_id,device_id,actor_user_id:'owner'});
  await bridge.execute('claim',{project_id,device_id,device_authenticated:true});
  assert.deepEqual(seen,['devicePingCreate','devicePingClaim']);
  await assert.rejects(bridge.execute('claim',{project_id,device_id,actor_user_id:'owner'}),/PING_DEVICE_PRINCIPAL_REQUIRED/);
 }finally{if(before===undefined)delete process.env.IKEY_GAS_PING_ENABLED;else process.env.IKEY_GAS_PING_ENABLED=before}
});
