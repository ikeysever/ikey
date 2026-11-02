'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('GAS command modules and verified dispatcher exist',()=>{
 const entry=read('gen3-auth/Code.gs');
 const actions=read('gas/device-command-actions.gs');
 const trust=read('gas/device-command-trust.gs');
 const auth=read('gas/device-command-authorization.gs');
 assert.match(entry,/function doPost\(e\)/);
 assert.match(entry,/data\.api_key!==secret/);
 assert.match(entry,/ikeyDeviceCommandAction\(action,p\)/);
 assert.match(actions,/function ikeyDeviceCommandAction\(action,p\)/);
 assert.match(trust,/function ikeyCommandTrustVerify_\(/);
 for(const fn of ['ikeyVerifyCommandActorContext_','ikeyVerifyDeviceActor_','ikeyVerifyCommandDeviceContext_'])
  assert.ok(auth.includes('function '+fn+'('));
});
test('GAS storage configuration uses existing GEN3_SPREADSHEET_ID',()=>{
 for(const p of ['gen3-auth/Code.gs','gas/device-command-actions.gs','gas/device-command-authorization.gs'])
  assert.ok(read(p).includes('GEN3_SPREADSHEET_ID'),p);
});
test('command sheet schemas are declared and fail closed if missing',()=>{
 const src=read('gas/device-command-actions.gs');
 for(const name of ['Project_Devices','DeviceCommands','DeviceCommandEvents'])
  assert.ok(src.includes("'"+name+"'"),name);
 assert.match(src,/DEVICE_SHEET_NOT_READY/);
 assert.match(src,/DEVICE_SCHEMA_MISMATCH/);
});
