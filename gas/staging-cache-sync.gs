'use strict';
// Staging-only Apps Script module. No doPost override and no automatic deployment.
// Install only after verifying isolated Script Properties and independent staging Spreadsheet.
var IKEY_SYNC_TABLE_ = 'System_Announcements';
var IKEY_SYNC_LOG_ = 'Cache_Change_Log';
var IKEY_SYNC_STATE_ = 'Cache_Sync_State';
var IKEY_SYNC_PAGE_MAX_ = 100;
function ikeySyncError_(code){throw new Error(code);}
function ikeySyncStageOnly_(){
 var p=PropertiesService.getScriptProperties();
 if(p.getProperty('IKEY_SYNC_STAGING_ONLY')!=='true')ikeySyncError_('SYNC_STAGING_DISABLED');
 var id=p.getProperty('GEN3_SPREADSHEET_ID');
 var expected=p.getProperty('IKEY_SYNC_STAGING_SHEET_ID');
 if(!id||!expected||id!==expected)ikeySyncError_('SYNC_STAGING_SHEET_MISMATCH');
 return SpreadsheetApp.openById(id);
}
function ikeySyncSheets_(ss){
 var source=ss.getSheetByName(IKEY_SYNC_TABLE_);
 var log=ss.getSheetByName(IKEY_SYNC_LOG_);
 var state=ss.getSheetByName(IKEY_SYNC_STATE_);
 if(!source||!log||!state)ikeySyncError_('SYNC_SCHEMA_MISSING');
 var logHeader=log.getRange(1,1,1,6).getDisplayValues()[0].join(',');
 var stateHeader=state.getRange(1,1,1,2).getDisplayValues()[0].join(',');
 if(logHeader!=='sequence,record_id,version,deleted,payload_json,occurred_at'||stateHeader!=='name,value')ikeySyncError_('SYNC_SCHEMA_MISMATCH');
 return {source:source,log:log,state:state};
}
function ikeySyncRevision_(state){
 var values=state.getDataRange().getValues();
 var matches=values.filter(function(r){return r[0]==='revision';});
 if(matches.length!==1||!Number.isSafeInteger(Number(matches[0][1]))||Number(matches[0][1])<0)ikeySyncError_('SYNC_REVISION_INVALID');
 return Number(matches[0][1]);
}
function ikeySyncUpdateRevision_(state,number){
 var values=state.getDataRange().getValues();
 for(var i=1;i<values.length;i++)if(values[i][0]==='revision'){state.getRange(i+1,2).setValue(number);return;}
 ikeySyncError_('SYNC_REVISION_INVALID');
}
function ikeySyncJson_(s){try{return JSON.parse(String(s));}catch(e){ikeySyncError_('SYNC_JSON_INVALID');}}
function ikeySyncRead_(request){
 var ss=ikeySyncStageOnly_(),s=ikeySyncSheets_(ss),action=request&&request.action;
 if(action!=='snapshot.page'&&action!=='changes.page')ikeySyncError_('SYNC_ACTION_DENIED');
 var limit=Number(request.limit||50);
 if(!Number.isInteger(limit)||limit<1||limit>IKEY_SYNC_PAGE_MAX_)ikeySyncError_('SYNC_LIMIT_INVALID');
 var offset=request.pageToken===null||request.pageToken===undefined?0:Number(request.pageToken);
 if(!Number.isSafeInteger(offset)||offset<0)ikeySyncError_('SYNC_PAGE_TOKEN_INVALID');
 var revision=ikeySyncRevision_(s.state);
 var pinned=request.revision===null||request.revision===undefined?revision:Number(request.revision);
 if(!Number.isSafeInteger(pinned)||pinned!==revision)ikeySyncError_('SYNC_REVISION_CHANGED');
 var rows=[];
 if(action==='snapshot.page'){
  if(request.cursor!==null&&request.cursor!==undefined)ikeySyncError_('SYNC_CURSOR_INVALID');
  var grid=s.source.getDataRange().getValues(),headers=grid[0]||[],idx=headers.indexOf('announcement_id');
  if(idx<0)ikeySyncError_('SYNC_SCHEMA_MISMATCH');
  for(var i=1;i<grid.length;i++){
   var id=String(grid[i][idx]||'');if(!id)continue;
   var value={};for(var j=0;j<headers.length;j++)value[headers[j]]=grid[i][j] instanceof Date?grid[i][j].toISOString():grid[i][j];
   rows.push({id:id,version:revision,deleted:false,value:value});
  }
 }else{
  var cursor=Number(request.cursor);
  if(!Number.isSafeInteger(cursor)||cursor<0||cursor>revision)ikeySyncError_('SYNC_CURSOR_INVALID');
  var logRows=s.log.getDataRange().getValues();
  for(var k=1;k<logRows.length;k++){
   var l=logRows[k],seq=Number(l[0]);
   if(!Number.isSafeInteger(seq)||seq<1)ikeySyncError_('SYNC_LOG_CORRUPT');
   if(seq>cursor&&seq<=revision)rows.push({id:String(l[1]),version:seq,deleted:l[3]===true||l[3]==='true',value:ikeySyncJson_(l[4])});
  }
 }
 var slice=rows.slice(offset,offset+limit);
 // Source may be written outside this journal: such writes are not covered by this protocol.
 if(ikeySyncRevision_(s.state)!==revision)ikeySyncError_('SYNC_REVISION_CHANGED');
 return {rows:slice,revision:String(revision),nextCursor:String(revision),nextPageToken:offset+limit<rows.length?String(offset+limit):null,complete:true};
}
// Call from staging write-through handlers under the SAME script lock as the business write.
// All writes must journal atomically from the reader's perspective; direct Sheet edits are unsupported.
function ikeySyncRecordChange_(id,value,deleted){
 var ss=ikeySyncStageOnly_(),s=ikeySyncSheets_(ss);
 if(typeof id!=='string'||!id||id.length>200||typeof deleted!=='boolean')ikeySyncError_('SYNC_CHANGE_INVALID');
 if(!deleted&&(!value||typeof value!=='object'||Array.isArray(value)))ikeySyncError_('SYNC_CHANGE_INVALID');
 var lock=LockService.getScriptLock();
 if(!lock.tryLock(15000))ikeySyncError_('SYNC_BUSY');
 try{
  var next=ikeySyncRevision_(s.state)+1;
  s.log.appendRow([next,id,next,deleted,JSON.stringify(value||{}),new Date().toISOString()]);
  SpreadsheetApp.flush();
  ikeySyncUpdateRevision_(s.state,next);
  SpreadsheetApp.flush();
  return {sequence:next};
 }finally{lock.releaseLock();}
}
