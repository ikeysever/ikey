'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../gas-staging/ikey-ping-command-actions.gs'),'utf8');
const project_id='11111111-1111-4111-8111-111111111111',device_id='Y8R69EXB';
function harness(){
 const rows=[['command_id','project_id','device_id','action','status','created_at','claimed_at','reported_at','result']];
 let serial=0,locked=false;
 const sheet={
  getLastRow:()=>rows.length,
  getRange(r,c,rs=1,cs=1){return {
   getValues:()=>Array.from({length:rs},(_,i)=>rows[r-1+i].slice(c-1,c-1+cs)),
   setValue(v){rows[r-1][c-1]=v},
   setValues(v){for(let i=0;i<rs;i++)for(let j=0;j<cs;j++)rows[r-1+i][c-1+j]=v[i][j]}
  }},
  appendRow(row){rows.push(row)}
 };
 const ctx={
  PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'test-sheet'})},
  SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet})},
  LockService:{getScriptLock:()=>({
   tryLock(){if(locked)return false;locked=true;return true},
   releaseLock(){locked=false}
  })},
  Utilities:{getUuid:()=> '22222222-2222-4222-8222-'+String(++serial).padStart(12,'0')},
  Date,Error
 };
 vm.createContext(ctx);vm.runInContext(source,ctx);
 return {action:(name,p)=>ctx.ikeyPingCommandAction_(name,p),rows};
}
test('GAS ping storage executes create claim status report end-to-end',()=>{
 const {action,rows}=harness();
 const scope={project_id,device_id};
 const created=action('devicePingCreate',scope);
 assert.equal(created.status,'pending');
 assert.equal(rows.length,2);
 const claimed=action('devicePingClaim',scope);
 assert.equal(claimed.command.command_id,created.command_id);
 assert.equal(rows[1][4],'delivered');
 assert.ok(rows[1][5]);assert.ok(rows[1][6]);
 assert.equal(action('devicePingClaim',scope).command,null);
 const status=action('devicePingStatus',{...scope,command_id:created.command_id});
 assert.equal(status.command.status,'delivered');
 const report=action('devicePingReport',{...scope,command_id:created.command_id,result:'completed'});
 assert.equal(report.recorded,true);
 assert.equal(action('devicePingReport',{...scope,command_id:created.command_id,result:'completed'}).duplicate,true);
 assert.equal(action('devicePingStatus',{...scope,command_id:created.command_id}).command.status,'completed');
});
test('GAS ping storage refuses wrong scope and invalid transitions',()=>{
 const {action}=harness();
 const scope={project_id,device_id};
 const created=action('devicePingCreate',scope);
 assert.equal(action('devicePingReport',{...scope,command_id:created.command_id,result:'completed'}).recorded,false);
 assert.equal(action('devicePingStatus',{...scope,device_id:'ABCDEF23',command_id:created.command_id}).found,false);
 assert.throws(()=>action('devicePingReport',{...scope,command_id:created.command_id,result:'unlock'}),/PING_INVALID_RESULT/);
});
