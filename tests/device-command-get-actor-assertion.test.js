'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createDeviceCommandGateway}=require('../lib/device-command-gateway');
const ACTOR={user_id:'123e4567-e89b-42d3-a456-426614174000'};
test('GET binds verified actor user ID into signed GAS payload',async()=>{
 const calls=[];
 const gateway=createDeviceCommandGateway({
  call:async(action,payload)=>{calls.push({action,payload});return null;},
  verifyActor:async()=>true,
  verifyDeviceBinding:async()=>true
 });
 await gateway.get({actor:ACTOR,project_id:'123e4567-e89b-42d3-a456-426614174001',device_id:'ABCDEFGH',command_id:'123e4567-e89b-42d3-a456-426614174002'});
 assert.equal(calls.length,1);
 assert.equal(calls[0].action,'deviceCommandGet');
 assert.equal(calls[0].payload.actor_user_id,ACTOR.user_id);
});
