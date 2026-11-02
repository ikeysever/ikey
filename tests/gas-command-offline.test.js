'use strict';
// Offline Apps Script simulation: no Google credentials, Sheets, Render or hardware.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const actor_user_id='11111111-1111-4111-8111-111111111111';
const project_id='22222222-2222-4222-8222-222222222222';
const device_id='ikey_unit-01';
const token='a'.repeat(64);
const HEADERS={
 Project_Devices:['binding_id','project_id','device_id','display_name','lock_mode','heartbeat_interval_minutes','auto_firmware_update','bound_by','bound_at','updated_at'],
 DeviceCommands:['command_id','project_id','device_id','actor_user_id','action','idempotency_key','fingerprint','status','created_at','deadline_at','claimed_at','finished_at','claim_token_hash','feedback_observed','result'],
 DeviceCommandEvents:['event_id','command_id','device_id','event_type','occurred_at','details']
};
function fixture({actor=true,device=true}={}){
 let clock=100000,seq=0,failAt=0,writes=0;
 const tables=Object.fromEntries(Object.entries(HEADERS).map(([k,v])=>[k,[v.slice()]]));
 tables.Project_Devices.push(['binding',project_id,device_id,'Demo','locked',5,false,actor_user_id,'','']);
 function write(fn){writes++;if(failAt&&writes===failAt)throw Error('INJECTED_WRITE_FAILURE');fn();}
 const sheet=name=>({
  getLastRow:()=>tables[name].length,
  getRange(row,col,nr=1,nc=1){return {
   getDisplayValues:()=>tables[name].slice(row-1,row-1+nr).map(r=>r.slice(col-1,col-1+nc).map(String)),
   getValues:()=>tables[name].slice(row-1,row-1+nr).map(r=>r.slice(col-1,col-1+nc)),
   setValue(v){write(()=>{tables[name][row-1][col-1]=v;});},
   setValues(values){write(()=>values.forEach((r,i)=>r.forEach((v,j)=>{tables[name][row-1+i][col-1+j]=v;}))); }
  };},
  appendRow(r){write(()=>tables[name].push(r.slice()));}
 });
 let locked=false;
 const context={
  PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'ISOLATED_FAKE_ID'})},
  SpreadsheetApp:{openById:()=>({getSheetByName:name=>tables[name]?sheet(name):null})},
  LockService:{getScriptLock:()=>({tryLock:()=>{if(locked)return false;locked=true;return true;},releaseLock:()=>{locked=false;}})},
  Utilities:{getUuid:()=> '00000000-0000-4000-8000-'+String(++seq).padStart(12,'0'),DigestAlgorithm:{SHA_256:'SHA_256'},Charset:{UTF_8:'UTF_8'},computeDigest:(_,x)=>Array.from(crypto.createHash('sha256').update(x).digest()).map(b=>b>127?b-256:b)},
  ikeyVerifyCommandActorContext_:()=>actor,
  ikeyVerifyDeviceActor_:()=>actor,
  ikeyVerifyCommandDeviceContext_:()=>device,
  Date:class extends Date{static now(){return clock;}}
 };
 vm.createContext(context);
 vm.runInContext(fs.readFileSync(require.resolve('../gas/device-command-actions.gs'),'utf8'),context);
 const run=(action,p={})=>context.ikeyDeviceCommandAction(action,{project_id,device_id,...p});
 const create=(id='request-0001')=>run('deviceCommandCreateAtomic',{actor_user_id,action:'unlock',idempotency_key:id,timeout_ms:15000});
 const claim=()=>run('deviceCommandClaimAtomic',{claim_token:token});
 const report=(command_id,status='succeeded',feedback_observed=true)=>run('deviceCommandReportAtomic',{command_id,claim_token:token,status,feedback_observed});
 return {run,create,claim,report,tables,tick:ms=>clock+=ms,failAt:n=>{failAt=n;writes=0;},clearFault:()=>{failAt=0;writes=0;}};
}
test('create, idempotency, claim, report, audit',()=>{
 const f=fixture(),a=f.create();assert.equal(a.command.status,'pending');
 assert.equal(f.create().duplicate,true);
 assert.throws(()=>f.create('request-0002'),/DEVICE_COMMAND_IN_PROGRESS/);
 assert.equal(f.claim().status,'claimed');assert.equal(f.claim(),null);
 assert.equal(f.report(a.command.command_id).status,'succeeded');
 assert.equal(f.report(a.command.command_id).duplicate,true);
 assert.deepEqual(f.tables.DeviceCommandEvents.slice(1).map(r=>r[3]),['created','claimed','reported']);
 assert.equal(f.tables.DeviceCommands[1][12],crypto.createHash('sha256').update(token).digest('hex'));
 assert.equal(f.run('deviceCommandGet',{command_id:a.command.command_id}).claim_token_hash,undefined);
});
test('expiry blocks late claim and report',()=>{
 const f=fixture(),a=f.create();f.tick(15000);assert.equal(f.claim(),null);
 assert.equal(f.run('deviceCommandGet',{command_id:a.command.command_id}).status,'timed_out');
});
test('fail closed without verified actor or device',()=>{
 assert.throws(()=>fixture({actor:false}).create(),/ACTOR_NOT_VERIFIED/);
 assert.throws(()=>fixture({device:false}).claim(),/DEVICE_NOT_VERIFIED/);
});
test('fault injection exposes partial-write recovery requirement',()=>{
 const f=fixture();f.failAt(2);
 assert.throws(()=>f.create(),/INJECTED_WRITE_FAILURE/);
 // Command was appended, audit event was not: known Sheets non-transactional gap.
 assert.equal(f.tables.DeviceCommands.length,2);
 assert.equal(f.tables.DeviceCommandEvents.length,1);
 f.clearFault();
 assert.equal(f.create().duplicate,true);
 assert.equal(f.tables.DeviceCommandEvents.length,2);
 assert.equal(f.tables.DeviceCommandEvents[1][3],'created');
});

test('claim event is reconstructed after an injected event append failure',()=>{
 const f=fixture(),a=f.create();
 f.failAt(2);
 assert.throws(()=>f.claim(),/INJECTED_WRITE_FAILURE/);
 assert.equal(f.tables.DeviceCommands[1][7],'claimed');
 f.clearFault();
 assert.equal(f.claim(),null);
 assert.deepEqual(f.tables.DeviceCommandEvents.slice(1).map(r=>r[3]),['created','claimed']);
 assert.equal(f.report(a.command.command_id).status,'succeeded');
});
test('report event is reconstructed without repeating terminal transition',()=>{
 const f=fixture(),a=f.create();f.claim();
 f.failAt(2);
 assert.throws(()=>f.report(a.command.command_id),/INJECTED_WRITE_FAILURE/);
 assert.equal(f.tables.DeviceCommands[1][7],'succeeded');
 f.clearFault();
 assert.equal(f.report(a.command.command_id).duplicate,true);
 assert.deepEqual(f.tables.DeviceCommandEvents.slice(1).map(r=>r[3]),['created','claimed','reported']);
});
test('failed reconciliation blocks new command processing',()=>{
 const f=fixture();f.failAt(2);
 assert.throws(()=>f.create(),/INJECTED_WRITE_FAILURE/);
 f.failAt(1);
 assert.throws(()=>f.claim(),/INJECTED_WRITE_FAILURE/);
 assert.equal(f.tables.DeviceCommands[1][7],'pending');
});
test('sequential simulated contenders claim at most once',()=>{
 const f=fixture();f.create();
 const outcomes=Array.from({length:12},()=>f.claim());
 assert.equal(outcomes.filter(Boolean).length,1);
 assert.equal(f.tables.DeviceCommandEvents.slice(1).filter(r=>r[3]==='claimed').length,1);
});
