'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

test('generic DB insert writes new notification fields in sheet header order',()=>{
 const headers=['project_id','project_name','description','created_by_user_id','authorization_method','scheduled_authorization','status','created_at','updated_at','notification_theme','notification_sound_pack','notification_volume'];
 const written=[];
 const sheet={
  getLastRow:()=>1,
  getRange:(row,col,numRows,numCols)=>({setValues:values=>{written.push({row,col,numRows,numCols,values});}}),
 };
 const context={
  LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},
  SpreadsheetApp:{flush:()=>{}},
  Error,Set,Object,String,Number,
 };
 vm.createContext(context);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../gas/generic-db-engine.gs'),'utf8'),context);
 const data={project_id:'test-uuid',project_name:'測試',description:'',created_by_user_id:'test-user',authorization_method:'application',scheduled_authorization:'false',status:'active',created_at:'2026-10-25',updated_at:'2026-10-25',notification_theme:'midnight',notification_sound_pack:'pulse',notification_volume:'50'};
 const result=context.ikeyDbInsert_(sheet,headers,{data,primary_key:'project_id'});
 assert.equal(result.inserted,true);
 assert.equal(result.record.notification_theme,'midnight');
 assert.equal(result.record.notification_sound_pack,'pulse');
 assert.equal(result.record.notification_volume,'50');
 assert.equal(written.length,1);
 assert.equal(written[0].numCols,12);
 assert.deepEqual(Array.from(written[0].values[0]),headers.map(h=>data[h]));
});
test('generic DB insert rejects unknown fields before writing',()=>{
 const headers=['project_id','notification_theme'];
 let wrote=false;
 const sheet={getLastRow:()=>1,getRange:()=>({setValues:()=>{wrote=true;}})};
 const context={LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},SpreadsheetApp:{flush:()=>{}},Error,Set,Object,String,Number};
 vm.createContext(context);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../gas/generic-db-engine.gs'),'utf8'),context);
 assert.throws(()=>context.ikeyDbInsert_(sheet,headers,{data:{project_id:'x',unknown:'y'},primary_key:'project_id'}),/DB_FIELD_DENIED/);
 assert.equal(wrote,false);
});
