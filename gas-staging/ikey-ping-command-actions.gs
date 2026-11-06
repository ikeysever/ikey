/* iKey 3.1 — STAGING ONLY, non-actuating ping command storage.
 * This file is NOT deployed or connected to the live GAS dispatcher.
 * Required Script Properties: GEN3_SPREADSHEET_ID.
 * Integration requires trusted dispatcher authentication and actor authorization.
 * Never expose these actions directly to browsers or ESP32.
 */
const IKEY_PING_COLUMNS_=[
 'command_id','project_id','device_id','action','status',
 'created_at','claimed_at','reported_at','result'
];
function ikeyPingSheet_(){
 const id=PropertiesService.getScriptProperties().getProperty('GEN3_SPREADSHEET_ID');
 if(!id)throw Error('PING_STORAGE_NOT_CONFIGURED');
 const sheet=SpreadsheetApp.openById(id).getSheetByName('Device_Ping_Commands');
 if(!sheet)throw Error('PING_SHEET_MISSING');
 const headers=sheet.getRange(1,1,1,IKEY_PING_COLUMNS_.length).getValues()[0];
 if(headers.join('|')!==IKEY_PING_COLUMNS_.join('|'))throw Error('PING_SCHEMA_MISMATCH');
 return sheet;
}
function ikeyPingUUID_(s){
 return typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}
function ikeyPingDevice_(s){return typeof s==='string'&&/^[A-HJ-NP-Z2-9]{8}$/.test(s)}
function ikeyPingLocked_(fn){
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(15000))throw Error('PING_LOCK_TIMEOUT');
 try{return fn()}finally{lock.releaseLock()}
}
function ikeyPingRows_(sheet){
 const last=sheet.getLastRow();
 return last<2?[]:sheet.getRange(2,1,last-1,IKEY_PING_COLUMNS_.length).getValues();
}
/* Must only be invoked after the dispatcher has independently authenticated
 * the caller and authorized project/device access. This function is storage,
 * not an authorization boundary. */
function ikeyPingCommandAction_(action,p){
 if(!p||typeof p!=='object'||Array.isArray(p))throw Error('PING_INVALID_PAYLOAD');
 if(!ikeyPingUUID_(p.project_id)||!ikeyPingDevice_(p.device_id))
  throw Error('PING_INVALID_SCOPE');
 if(!['devicePingCreate','devicePingClaim','devicePingReport','devicePingStatus'].includes(action))
  throw Error('PING_ACTION_NOT_ALLOWED');
 return ikeyPingLocked_(function(){
  const sheet=ikeyPingSheet_();
  const rows=ikeyPingRows_(sheet);
  const now=new Date().toISOString();
  if(action==='devicePingCreate'){
   const id=Utilities.getUuid();
   sheet.appendRow([id,p.project_id,p.device_id,'ping','pending',now,'','','']);
   return {command_id:id,status:'pending'};
  }
  if(!ikeyPingUUID_(p.command_id)&&action!=='devicePingClaim')
   throw Error('PING_INVALID_COMMAND_ID');
  if(action==='devicePingClaim'){
   for(let i=0;i<rows.length;i++){
    const r=rows[i];
    if(r[1]===p.project_id&&r[2]===p.device_id&&r[3]==='ping'&&r[4]==='pending'){
     sheet.getRange(i+2,5,1,3).setValues([['delivered',r[5],now]]);
     return {command:{command_id:r[0],project_id:r[1],device_id:r[2],action:'ping',payload:null}};
    }
   }
   return {command:null};
  }
  const index=rows.findIndex(r=>r[0]===p.command_id&&r[1]===p.project_id&&r[2]===p.device_id);
  if(index<0)return {found:false};
  const row=rows[index];
  if(action==='devicePingStatus')return {found:true,command:{command_id:row[0],project_id:row[1],device_id:row[2],action:row[3],status:row[4],result:row[8]}};
  if(!['completed','failed'].includes(p.result))throw Error('PING_INVALID_RESULT');
  if(row[4]===p.result)return {found:true,recorded:true,duplicate:true};
  if(row[4]!=='delivered')return {found:true,recorded:false,code:'PING_INVALID_TRANSITION'};
  sheet.getRange(index+2,5).setValue(p.result);
  sheet.getRange(index+2,8,1,2).setValues([[now,p.result]]);
  return {found:true,recorded:true};
 });
}
