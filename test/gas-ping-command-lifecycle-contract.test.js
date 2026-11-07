'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../gas-staging/ikey-ping-command-actions.gs'),'utf8');
const project='123e4567-e89b-42d3-a456-426614174000';
const otherProject='123e4567-e89b-42d3-a456-426614174001';
const device='Y8R69EXB';
const command='123e4567-e89b-42d3-a456-426614174002';
const headers=['command_id','project_id','device_id','action','status','created_at','claimed_at','reported_at','result'];
function make(){
 const data=[headers.slice()];
 const sheet={
  getLastRow:()=>data.length,
  getRange(row,col,count=1,width=1){
   return {
    getValues:()=>data.slice(row-1,row-1+count).map(r=>r.slice(col-1,col-1+width)),
    setValue:value=>{data[row-1][col-1]=value},
    setValues:values=>values.forEach((r,i)=>r.forEach((v,j)=>{data[row-1+i][col-1+j]=v}))
   };
  },
  appendRow:row=>data.push(row.slice())
 };
 const props={getProperty:name=>name==='GEN3_SPREADSHEET_ID'?'test-only-sheet':null};
 const lock={tryLock:()=>true,releaseLock:()=>{}};
 const ctx={
  PropertiesService:{getScriptProperties:()=>props},
  SpreadsheetApp:{openById:id=>{assert.equal(id,'test-only-sheet');return {getSheetByName:name=>name==='Device_Ping_Commands'?sheet:null}}},
  LockService:{getScriptLock:()=>lock},
  Utilities:{getUuid:()=>command},
  Date,Error
 };
 vm.createContext(ctx);vm.runInContext(source,ctx);
 return {act:(action,p={})=>ctx.ikeyPingCommandAction_(action,{project_id:project,device_id:device,...p}),data};
}
test('create → claim → report → status and duplicate report preserve lifecycle',()=>{
 const m=make();
 assert.equal(m.act('devicePingCreate').status,'pending');
 assert.equal(m.act('devicePingClaim').command.command_id,command);
 assert.equal(m.act('devicePingClaim').command,null);
 assert.equal(m.act('devicePingReport',{command_id:command,result:'completed'}).recorded,true);
 assert.equal(m.act('devicePingReport',{command_id:command,result:'completed'}).duplicate,true);
 const status=m.act('devicePingStatus',{command_id:command});
 assert.equal(status.command.status,'completed');
 assert.equal(m.data[1][4],'completed');
});
test('cannot report before claim, or report the opposite terminal outcome',()=>{
 const m=make();
 m.act('devicePingCreate');
 assert.equal(m.act('devicePingReport',{command_id:command,result:'completed'}).code,'PING_INVALID_TRANSITION');
 m.act('devicePingClaim');
 assert.equal(m.act('devicePingReport',{command_id:command,result:'failed'}).recorded,true);
 assert.equal(m.act('devicePingReport',{command_id:command,result:'completed'}).code,'PING_INVALID_TRANSITION');
});
test('wrong project cannot claim, status or report command',()=>{
 const m=make();
 m.act('devicePingCreate');
 assert.equal(m.act('devicePingClaim',{project_id:otherProject}).command,null);
 assert.equal(m.act('devicePingStatus',{project_id:otherProject,command_id:command}).found,false);
 assert.equal(m.act('devicePingReport',{project_id:otherProject,command_id:command,result:'completed'}).found,false);
 assert.equal(m.data[1][4],'pending');
});
test('invalid scope, command IDs, actions and outcomes are rejected',()=>{
 const m=make();
 assert.throws(()=>m.act('devicePingCreate',{device_id:'invalid'}),/PING_INVALID_SCOPE/);
 assert.throws(()=>m.act('deviceUnlock'),/PING_ACTION_NOT_ALLOWED/);
 assert.throws(()=>m.act('devicePingStatus',{command_id:'bad'}),/PING_INVALID_COMMAND_ID/);
 m.act('devicePingCreate');
 m.act('devicePingClaim');
 assert.throws(()=>m.act('devicePingReport',{command_id:command,result:'unlock'}),/PING_INVALID_RESULT/);
});
