'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createCommand,canExecute,receiptValid,MAX_TTL_MS}=require('../lib/unlock-command-contract');
const target={project_id:'123e4567-e89b-42d3-a456-426614174000',device_id:'ABCDEFGH',slot_number:1};
test('command is short lived and starts pending',()=>{
 const cmd=createCommand(target,{now:1000000,id:'123e4567-e89b-42d3-a456-426614174001'});
 assert.equal(cmd.status,'pending');
 assert.equal(Date.parse(cmd.expires_at)-Date.parse(cmd.created_at),MAX_TTL_MS);
 assert.equal(canExecute(cmd,{deviceId:target.device_id,now:1000001}),false);
});
test('invalid targets are rejected',()=>{
 for(const patch of [{slot_number:0},{slot_number:257},{device_id:'INVALID!'},{project_id:'bad'}])
  assert.throws(()=>createCommand({...target,...patch}));
});
test('only matching claimed unexpired command may execute',()=>{
 const cmd={...createCommand(target,{now:1000000,id:'123e4567-e89b-42d3-a456-426614174001'}),status:'claimed'};
 assert.equal(canExecute(cmd,{deviceId:target.device_id,now:1000001}),true);
 assert.equal(canExecute(cmd,{deviceId:'ZZZZZZZZ',now:1000001}),false);
 assert.equal(canExecute(cmd,{deviceId:target.device_id,now:1015000}),false);
 assert.equal(canExecute({...cmd,status:'completed'},{deviceId:target.device_id,now:1000001}),false);
});
test('receipts must match command and report a recognized outcome',()=>{
 const cmd=createCommand(target,{now:1000000,id:'123e4567-e89b-42d3-a456-426614174001'});
 const receipt={command_id:cmd.command_id,device_id:cmd.device_id,status:'executed',executed_at:new Date(1000001).toISOString()};
 assert.equal(receiptValid(receipt,cmd),true);
 assert.equal(receiptValid({...receipt,device_id:'ZZZZZZZZ'},cmd),false);
 assert.equal(receiptValid({...receipt,status:'pending'},cmd),false);
});
