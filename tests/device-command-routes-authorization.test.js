'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {buildCommandGateway}=require('../lib/device-command-routes');
test('gateway requires both storage methods',()=>{
 assert.throws(()=>buildCommandGateway(null),/COMMAND_STORAGE_REQUIRED/);
 assert.throws(()=>buildCommandGateway({dbCall:async()=>null}),/COMMAND_STORAGE_REQUIRED/);
});
test('device without explicit project binding cannot claim a command',async()=>{
 let calls=0;
 const store={
  dbCall:async(_action,payload)=>{
   if(payload.table==='Devices')return {rows:[{device_id:'ABCDEFGH',status:'pre_registered'}]};
   if(payload.table==='Project_Devices')return {rows:[]};
   return {rows:[]};
  },
  commandCall:async()=>{calls++;return null;}
 };
 const gateway=buildCommandGateway(store);
 await assert.rejects(gateway.claim({
  device:{authenticated:true,device_id:'ABCDEFGH'},
  project_id:'22222222-2222-4222-8222-222222222222'
 }),/DEVICE_BINDING_REQUIRED/);
 assert.equal(calls,0);
});
