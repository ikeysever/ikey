'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../gas/staging-cache-sync.gs'),'utf8');
function fixture(){
 const tables={
  System_Announcements:[['announcement_id','title'],['a','A'],['b','B'],['c','C']],
  Cache_Change_Log:[['sequence','record_id','version','deleted','payload_json','occurred_at']],
  Cache_Sync_State:[['name','value'],['revision',0]]
 };
 const getSheetByName=name=>tables[name]?{
  getDataRange:()=>({getValues:()=>tables[name].map(r=>r.slice())}),
  getRange:(r,c,n=1,w=1)=>({getDisplayValues:()=>tables[name].slice(r-1,r-1+n).map(row=>row.slice(c-1,c-1+w).map(String)),setValue:v=>{tables[name][r-1][c-1]=v}}),
  appendRow:r=>tables[name].push(r.slice())
 }:null;
 const ctx={PropertiesService:{getScriptProperties:()=>({getProperty:k=>({IKEY_SYNC_STAGING_ONLY:'true',GEN3_SPREADSHEET_ID:'staging',IKEY_SYNC_STAGING_SHEET_ID:'staging'})[k]})},SpreadsheetApp:{openById:id=>({getSheetByName}),flush:()=>{}},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},Date,JSON,Number,String,Error};
 vm.createContext(ctx);vm.runInContext(src,ctx);return {ctx,tables};
}
test('snapshot paginates 3 rows and cursor is pinned',()=>{
 const {ctx}=fixture(),a=ctx.ikeySyncRead_({action:'snapshot.page',limit:2}),b=ctx.ikeySyncRead_({action:'snapshot.page',limit:2,pageToken:a.nextPageToken});
 assert.deepEqual(a.rows.map(x=>x.id),['a','b']);assert.equal(b.rows[0].id,'c');assert.equal(b.nextPageToken,null);assert.equal(a.revision,'0');
});
test('incremental journal emits tombstone and monotonic cursor',()=>{
 const {ctx}=fixture();ctx.ikeySyncRecordChange_('a',{},true);
 const r=ctx.ikeySyncRead_({action:'changes.page',cursor:'0',limit:100});
 assert.equal(r.rows.length,1);assert.equal(r.rows[0].deleted,true);assert.equal(r.nextCursor,'1');
});
test('revision change between pages fails closed',()=>{
 const {ctx}=fixture();const first=ctx.ikeySyncRead_({action:'snapshot.page',limit:1});
 ctx.ikeySyncRecordChange_('a',{title:'updated'},false);
 assert.throws(()=>ctx.ikeySyncRead_({action:'snapshot.page',limit:1,pageToken:first.nextPageToken,revision:first.revision}),/SYNC_REVISION_CHANGED/);
});
test('staging gate rejects production id',()=>{
 const {ctx}=fixture();ctx.PropertiesService.getScriptProperties=()=>({getProperty:k=>({IKEY_SYNC_STAGING_ONLY:'true',GEN3_SPREADSHEET_ID:'production',IKEY_SYNC_STAGING_SHEET_ID:'staging'})[k]});
 assert.throws(()=>ctx.ikeySyncRead_({action:'snapshot.page'}),/SYNC_STAGING_SHEET_MISMATCH/);
});
test('invalid page limit and action fail closed',()=>{
 const {ctx}=fixture();assert.throws(()=>ctx.ikeySyncRead_({action:'snapshot.page',limit:101}),/SYNC_LIMIT_INVALID/);
 assert.throws(()=>ctx.ikeySyncRead_({action:'db.select'}),/SYNC_ACTION_DENIED/);
});
