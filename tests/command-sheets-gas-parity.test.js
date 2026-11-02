'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const {EXISTING,NEW,planCommandSheets}=require('../scripts/plan-command-sheets-offline');
const actions=fs.readFileSync(path.join(root,'gas/device-command-actions.gs'),'utf8');
const trust=fs.readFileSync(path.join(root,'gas/device-command-trust.gs'),'utf8');
const ctx={};vm.createContext(ctx);vm.runInContext(actions+'\n'+trust,ctx);
test('offline planned command and event headers exactly match GAS runtime constants',()=>{
 const plan=planCommandSheets([...EXISTING]);
 for(const [name,constant] of [['DeviceCommands','IKEY_COMMAND_HEADERS'],['DeviceCommandEvents','IKEY_COMMAND_EVENT_HEADERS']]){
  assert.deepEqual(plan.find(s=>s.name===name).headers,Array.from(vm.runInContext(constant,ctx)));
 }
});
test('offline planned project binding headers match the actual GAS binding lookup',()=>{
 const expected=NEW.Project_Devices;
 const match=actions.match(/ikeyCmdSheet_\('Project_Devices',\s*\[([\s\S]*?)\]\)/);
 assert.ok(match,'binding sheet schema declaration missing');
 const actual=Array.from(match[1].matchAll(/'([^']+)'/g),m=>m[1]);
 assert.deepEqual(expected,actual);
});
test('offline nonce schema matches GAS ledger verifier',()=>{
 assert.deepEqual(NEW.DeviceCommandNonces,['nonce','expires_at']);
 assert.match(trust,/headers\[0\]!=='nonce'\|\|headers\[1\]!=='expires_at'/);
});
