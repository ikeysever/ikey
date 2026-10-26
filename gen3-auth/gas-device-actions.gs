/** iKey Gen3 dedicated device actions. Merge into the authenticated GAS dispatcher.
 * Never expose these actions to a public unauthenticated doPost endpoint.
 * Requires existing doPost to verify GEN3 shared API key BEFORE dispatch.
 * Script Property GEN3_SPREADSHEET_ID is mandatory.
 */
const IKEY_FACTORY_HEADERS=['device_id','credential_kdf','credential_salt','credential_hash','registration_status','registered_by','registered_at','updated_at'];
const IKEY_BIND_HEADERS=['binding_id','project_id','device_id','display_name','lock_mode','heartbeat_interval_minutes','auto_firmware_update','bound_by','bound_at','updated_at'];
function ikeyDeviceSheet_(name,headers){
 const id=PropertiesService.getScriptProperties().getProperty('GEN3_SPREADSHEET_ID');
 if(!id)throw Error('DEVICE_STORAGE_NOT_CONFIGURED');
 const book=SpreadsheetApp.openById(id),sheet=book.getSheetByName(name);
 if(!sheet)throw Error('DEVICE_SHEET_NOT_READY');
 const actual=sheet.getRange(1,1,1,headers.length).getDisplayValues()[0];
 if(actual.join('\u001f')!==headers.join('\u001f'))throw Error('DEVICE_SCHEMA_MISMATCH');
 return sheet;
}
function ikeyDeviceRows_(sheet){
 if(sheet.getLastRow()<2)return [];
 return sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues();
}
// Deployment gate: existing authenticated GAS dispatcher must provide a trusted
// authorization function, never trust actor_user_id supplied in a payload alone.
// The function must return true only after verifying the actor against persisted
// account/session state and project ownership. Absent verifier = deny.
function ikeyDeviceAuthorized_(action,p){
 if(typeof ikeyVerifyDeviceActor_!=='function')return false;
 return ikeyVerifyDeviceActor_(action,p)===true;
}
function ikeyFactoryDeviceAction(action,p){
 if(!p||typeof p!=='object')throw Error('BAD_REQUEST');
 if(!ikeyDeviceAuthorized_(action,p))throw Error('DEVICE_AUTH_NOT_READY');
 if(action==='factoryDeviceList'){
  if(!/^[0-9a-f-]{36}$/i.test(String(p.project_id||'')))throw Error('BAD_PROJECT_ID');
  const sheet=ikeyDeviceSheet_('Project_Devices',IKEY_BIND_HEADERS);
  const devices=ikeyDeviceRows_(sheet).filter(row=>String(row[1])===String(p.project_id)).map(row=>({
   device_id:String(row[2]),display_name:String(row[3]),lock_mode:String(row[4]),
   heartbeat_interval_minutes:Number(row[5]),auto_firmware_update:row[6]===true,
   bound_at:String(row[8])
  }));
  return {devices};
 }
 const id=String(p.device_id||'');
 if(!/^[A-Za-z0-9_-]{6,64}$/.test(id))throw Error('BAD_DEVICE_ID');
 if(action==='factoryDeviceCredentialGet'){
  const sheet=ikeyDeviceSheet_('Factory_Devices',IKEY_FACTORY_HEADERS);
  const row=ikeyDeviceRows_(sheet).find(x=>String(x[0])===id&&String(x[4])==='active');
  if(!row)return null;
  return {credential_kdf:String(row[1]),credential_salt:String(row[2]),credential_hash:String(row[3])};
 }
 if(action==='factoryDeviceRegister'){
  if(p.credential_kdf!=='scrypt-n16384-r8-p1'||!/^[a-f0-9]{64}$/.test(p.credential_salt||'')||!/^[a-f0-9]{128}$/.test(p.credential_hash||''))throw Error('BAD_CREDENTIAL');
  const lock=LockService.getScriptLock();if(!lock.tryLock(15000))throw Error('DEVICE_BUSY');
  try{
   const sheet=ikeyDeviceSheet_('Factory_Devices',IKEY_FACTORY_HEADERS);
   if(ikeyDeviceRows_(sheet).some(x=>String(x[0])===id))return {registered:false};
   const now=new Date().toISOString();
   sheet.appendRow([id,p.credential_kdf,p.credential_salt,p.credential_hash,'active',String(p.actor_user_id||''),now,now]);
   return {registered:true};
  }finally{lock.releaseLock();}
 }
 if(action==='factoryDeviceUpdate'){
  if(!/^[0-9a-f-]{36}$/i.test(String(p.project_id||'')))throw Error('BAD_PROJECT_ID');
  if(typeof p.display_name!=='string'||!p.display_name.trim()||p.display_name.length>64||
    !['locked','open'].includes(p.lock_mode)||!Number.isInteger(p.heartbeat_interval_minutes)||
    p.heartbeat_interval_minutes<1||p.heartbeat_interval_minutes>1440||typeof p.auto_firmware_update!=='boolean')throw Error('BAD_DEVICE_SETTINGS');
  const lock=LockService.getScriptLock();if(!lock.tryLock(15000))throw Error('DEVICE_BUSY');
  try{
   const sheet=ikeyDeviceSheet_('Project_Devices',IKEY_BIND_HEADERS);
   const rows=ikeyDeviceRows_(sheet);
   const index=rows.findIndex(row=>String(row[1])===String(p.project_id)&&String(row[2])===id);
   if(index<0)return {updated:false};
   const rowIndex=index+2;
   sheet.getRange(rowIndex,4,1,4).setValues([[p.display_name.trim(),p.lock_mode,p.heartbeat_interval_minutes,p.auto_firmware_update]]);
   sheet.getRange(rowIndex,10).setValue(new Date().toISOString());
   return {updated:true};
  }finally{lock.releaseLock();}
 }
 if(action==='factoryDeviceBind'){
  if(!/^[0-9a-f-]{36}$/i.test(String(p.project_id||'')))throw Error('BAD_PROJECT_ID');
  const lock=LockService.getScriptLock();if(!lock.tryLock(15000))throw Error('DEVICE_BUSY');
  try{
   const factory=ikeyDeviceSheet_('Factory_Devices',IKEY_FACTORY_HEADERS);
   const bindings=ikeyDeviceSheet_('Project_Devices',IKEY_BIND_HEADERS);
   if(!ikeyDeviceRows_(factory).some(x=>String(x[0])===id&&String(x[4])==='active'))return {bound:false};
   if(ikeyDeviceRows_(bindings).some(x=>String(x[2])===id))return {bound:false};
   // Existing project membership/role must also be checked in the trusted GAS dispatcher.
   const now=new Date().toISOString();
   bindings.appendRow([Utilities.getUuid(),p.project_id,id,id,'locked',5,false,String(p.actor_user_id||''),now,now]);
   return {bound:true};
  }finally{lock.releaseLock();}
 }
 throw Error('DEVICE_ACTION_NOT_ALLOWED');
}
