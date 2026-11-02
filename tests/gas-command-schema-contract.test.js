'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const actions=fs.readFileSync(path.join(root,'gas/device-command-actions.gs'),'utf8');
const trust=fs.readFileSync(path.join(root,'gas/device-command-trust.gs'),'utf8');
const docs=fs.readFileSync(path.join(root,'docs/gas-command-dispatch-integration.md'),'utf8');
const ctx={};vm.createContext(ctx);vm.runInContext(actions+'\n'+trust,ctx);
const expected={
 Project_Devices:['binding_id','project_id','device_id','display_name','lock_mode','heartbeat_interval_minutes','auto_firmware_update','bound_by','bound_at','updated_at'],
 DeviceCommands:['command_id','project_id','device_id','actor_user_id','action','idempotency_key','fingerprint','status','created_at','deadline_at','claimed_at','finished_at','claim_token_hash','feedback_observed','result'],
 DeviceCommandEvents:['event_id','command_id','device_id','event_type','occurred_at','details'],
 DeviceCommandNonces:['nonce','expires_at']
};
test('command and event schemas match declared deployment contract',()=>{
 assert.deepEqual(Array.from(vm.runInContext('IKEY_COMMAND_HEADERS',ctx)),expected.DeviceCommands);
 assert.deepEqual(Array.from(vm.runInContext('IKEY_COMMAND_EVENT_HEADERS',ctx)),expected.DeviceCommandEvents);
 for(const [name,headers] of Object.entries(expected)){
  assert.ok(docs.includes('`'+name+'`'),name);
  assert.ok(docs.includes('`'+headers.join(',')+'`'),name+' documented header mismatch');
 }
});
test('GAS binding and replay code fail closed on missing or mismatched sheets',()=>{
 assert.match(actions,/ikeyCmdSheet_\('Project_Devices'/);
 assert.match(actions,/DEVICE_SHEET_NOT_READY/);
 assert.match(actions,/DEVICE_SCHEMA_MISMATCH/);
 assert.match(trust,/getSheetByName\('DeviceCommandNonces'\)/);
 assert.match(trust,/COMMAND_REPLAY_SCHEMA_MISMATCH/);
});
