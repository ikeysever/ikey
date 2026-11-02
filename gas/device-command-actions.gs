/**
 * iKey 3.1 command actions — STAGING CANDIDATE ONLY.
 * NOT deployed, NOT exposed via doPost/db.*. Integrate only after reviewing
 * actual deployed GAS and provisioning isolated test Sheets.
 * Caller must pass verified server context through trusted dispatcher.
 * Never trust actor_user_id or device_id from public payload alone.
 */
const IKEY_COMMAND_HEADERS=[
 'command_id','project_id','device_id','actor_user_id','action',
 'idempotency_key','fingerprint','status','created_at','deadline_at',
 'claimed_at','finished_at','claim_token_hash','feedback_observed','result'
];
const IKEY_COMMAND_EVENT_HEADERS=[
 'event_id','command_id','device_id','event_type','occurred_at','details'
];
function ikeyCmdFail_(code){throw Error(code);}
function ikeyCmdUuid_(x){return typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);}
function ikeyCmdDeviceId_(x){return typeof x==='string'&&/^[A-Za-z0-9_-]{6,64}$/.test(x);}
function ikeyCmdSheet_(name,headers){
 const id=PropertiesService.getScriptProperties().getProperty('GEN3_SPREADSHEET_ID');
 if(!id)ikeyCmdFail_('DEVICE_STORAGE_NOT_CONFIGURED');
 const sheet=SpreadsheetApp.openById(id).getSheetByName(name);
 if(!sheet)ikeyCmdFail_('DEVICE_SHEET_NOT_READY');
 const actual=sheet.getRange(1,1,1,headers.length).getDisplayValues()[0];
 if(actual.join('\u001f')!==headers.join('\u001f'))ikeyCmdFail_('DEVICE_SCHEMA_MISMATCH');
 return sheet;
}
function ikeyCmdRows_(sheet){
 const n=sheet.getLastRow()-1;
 return n>0?sheet.getRange(2,1,n,IKEY_COMMAND_HEADERS.length).getValues():[];
}
function ikeyCmdHash_(token){
 const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,token,Utilities.Charset.UTF_8);
 return bytes.map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');
}
function ikeyCmdSafe_(r){
 return {command_id:String(r[0]),project_id:String(r[1]),device_id:String(r[2]),
  actor_user_id:String(r[3]),action:String(r[4]),status:String(r[7]),
  created_at:Number(r[8]),deadline_at:Number(r[9]),
  claimed_at:r[10]===''?null:Number(r[10]),
  finished_at:r[11]===''?null:Number(r[11]),
  feedback_observed:r[13]===''?null:r[13]===true,
  result:r[14]===''?null:String(r[14])};
}
function ikeyCmdEvent_(sheet,commandId,deviceId,type,now){
 sheet.appendRow([Utilities.getUuid(),commandId,deviceId,type,now,'']);
}
function ikeyCmdReconcileEvents_(events,rows){
 // Rebuild missing audit entries from durable command state under script lock.
 // This is an idempotent best-effort repair, not a multi-sheet ACID transaction.
 const n=events.getLastRow()-1;
 const existing=n>0?events.getRange(2,1,n,IKEY_COMMAND_EVENT_HEADERS.length).getValues():[];
 const seen=new Set(existing.map(r=>String(r[1])+'|'+String(r[3])));
 rows.forEach(r=>{
  const id=String(r[0]),device=String(r[2]),status=String(r[7]);
  const expected=[['created',Number(r[8])]];
  if(['claimed','succeeded','failed','timed_out'].includes(status)&&r[10]!=='')expected.push(['claimed',Number(r[10])]);
  if(['succeeded','failed'].includes(status)&&r[11]!=='')expected.push(['reported',Number(r[11])]);
  if(status==='timed_out'&&r[11]!=='')expected.push(['timed_out',Number(r[11])]);
  expected.forEach(([type,at])=>{
   const key=id+'|'+type;
   if(!seen.has(key)){ikeyCmdEvent_(events,id,device,type,at);seen.add(key);}
  });
 });
}
function ikeyCmdExpire_(commands,events,rows,now){
 let count=0;
 rows.forEach((r,i)=>{
  if(['pending','claimed'].includes(String(r[7]))&&now>=Number(r[9])){
   commands.getRange(i+2,8,1,5).setValues([['timed_out',r[8],r[9],r[10],now]]);
   r[7]='timed_out';r[11]=now;
   ikeyCmdEvent_(events,String(r[0]),String(r[2]),'timed_out',now);count++;
  }
 });
 return count;
}
function ikeyCmdRequireAdmin_(p){
 // Both checks are required: trusted Render actor binding AND GAS project admin.
 if(typeof ikeyVerifyCommandActorContext_!=='function'||
    ikeyVerifyCommandActorContext_(p)!==true)ikeyCmdFail_('ACTOR_NOT_VERIFIED');
 if(typeof ikeyVerifyDeviceActor_!=='function'||
    ikeyVerifyDeviceActor_('factoryDeviceList',p)!==true)ikeyCmdFail_('PROJECT_ADMIN_REQUIRED');
}
function ikeyCmdRequireDevice_(p){
 // Must verify device authentication and project binding on every call.
 if(typeof ikeyVerifyCommandDeviceContext_!=='function'||
    ikeyVerifyCommandDeviceContext_(p)!==true)ikeyCmdFail_('DEVICE_NOT_VERIFIED');
}
function ikeyCmdBound_(p){
 const sheet=ikeyCmdSheet_('Project_Devices',[
  'binding_id','project_id','device_id','display_name','lock_mode',
  'heartbeat_interval_minutes','auto_firmware_update','bound_by','bound_at','updated_at']);
 const n=sheet.getLastRow()-1;
 if(n<=0)ikeyCmdFail_('DEVICE_BINDING_REQUIRED');
 const rows=sheet.getRange(2,1,n,10).getValues();
 if(!rows.some(r=>String(r[1])===p.project_id&&String(r[2])===p.device_id))ikeyCmdFail_('DEVICE_BINDING_REQUIRED');
}
function ikeyDeviceCommandAction(action,p){
 if(!p||typeof p!=='object'||!ikeyCmdUuid_(p.project_id)||!ikeyCmdDeviceId_(p.device_id))ikeyCmdFail_('INVALID_REQUEST');
 const admin=['deviceCommandCreateAtomic','deviceCommandGet'].includes(action);
 const device=['deviceCommandClaimAtomic','deviceCommandReportAtomic'].includes(action);
 if(!admin&&!device)ikeyCmdFail_('COMMAND_ACTION_NOT_ALLOWED');
 if(admin)ikeyCmdRequireAdmin_(p);else ikeyCmdRequireDevice_(p);
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(15000))ikeyCmdFail_('DEVICE_BUSY');
 try{
  ikeyCmdBound_(p);
  const commands=ikeyCmdSheet_('DeviceCommands',IKEY_COMMAND_HEADERS);
  const events=ikeyCmdSheet_('DeviceCommandEvents',IKEY_COMMAND_EVENT_HEADERS);
  const rows=ikeyCmdRows_(commands),now=Date.now();
  ikeyCmdExpire_(commands,events,rows,now);
  ikeyCmdReconcileEvents_(events,rows);
  if(action==='deviceCommandCreateAtomic'){
   if(!ikeyCmdUuid_(p.actor_user_id)||p.action!=='unlock'||
      typeof p.idempotency_key!=='string'||!/^[A-Za-z0-9._:-]{8,128}$/.test(p.idempotency_key)||
      !Number.isSafeInteger(p.timeout_ms)||p.timeout_ms<1000||p.timeout_ms>60000)ikeyCmdFail_('INVALID_REQUEST');
   const fp=JSON.stringify([p.project_id,p.device_id,p.actor_user_id,p.action,p.timeout_ms]);
   const old=rows.find(r=>String(r[2])===p.device_id&&String(r[3])===p.actor_user_id&&String(r[5])===p.idempotency_key);
   if(old){
    if(String(old[6])!==fp)ikeyCmdFail_('IDEMPOTENCY_CONFLICT');
    return {duplicate:true,command:ikeyCmdSafe_(old)};
   }
   // Fail closed: never queue multiple simultaneously active unlocks for a device.
   if(rows.some(r=>String(r[2])===p.device_id&&['pending','claimed'].includes(String(r[7]))))ikeyCmdFail_('DEVICE_COMMAND_IN_PROGRESS');
   const id=Utilities.getUuid(),deadline=now+p.timeout_ms;
   const row=[id,p.project_id,p.device_id,p.actor_user_id,'unlock',p.idempotency_key,fp,'pending',now,deadline,'','','','',''];
   commands.appendRow(row);
   ikeyCmdEvent_(events,id,p.device_id,'created',now);
   return {duplicate:false,command:ikeyCmdSafe_(row)};
  }
  if(action==='deviceCommandClaimAtomic'){
   if(typeof p.claim_token!=='string'||!/^[a-f0-9]{64}$/.test(p.claim_token))ikeyCmdFail_('INVALID_CLAIM_TOKEN');
   const i=rows.findIndex(r=>String(r[1])===p.project_id&&String(r[2])===p.device_id&&String(r[7])==='pending');
   if(i<0)return null;
   const r=rows[i],hash=ikeyCmdHash_(p.claim_token);
   commands.getRange(i+2,8,1,6).setValues([['claimed',r[8],r[9],now,r[11],hash]]);
   r[7]='claimed';r[10]=now;r[12]=hash;
   ikeyCmdEvent_(events,String(r[0]),p.device_id,'claimed',now);
   return ikeyCmdSafe_(r);
  }
  if(action==='deviceCommandReportAtomic'){
   if(!ikeyCmdUuid_(p.command_id)||typeof p.claim_token!=='string'||!/^[a-f0-9]{64}$/.test(p.claim_token)||
      !['succeeded','failed'].includes(p.status)||typeof p.feedback_observed!=='boolean'||
      (p.status==='succeeded'&&!p.feedback_observed))ikeyCmdFail_('INVALID_RESULT');
   const i=rows.findIndex(r=>String(r[0])===p.command_id&&String(r[1])===p.project_id&&String(r[2])===p.device_id);
   if(i<0)ikeyCmdFail_('NOT_FOUND');
   const r=rows[i];
   if(!r[12]||ikeyCmdHash_(p.claim_token)!==String(r[12]))ikeyCmdFail_('INVALID_CLAIM');
   if(String(r[7])===p.status&&r[13]===p.feedback_observed)return {duplicate:true,status:p.status};
   if(String(r[7])!=='claimed')ikeyCmdFail_('INVALID_TRANSITION');
   commands.getRange(i+2,8,1,8).setValues([[p.status,r[8],r[9],r[10],now,r[12],p.feedback_observed,p.status]]);
   ikeyCmdEvent_(events,p.command_id,p.device_id,'reported',now);
   return {duplicate:false,status:p.status};
  }
  if(action==='deviceCommandGet'){
   if(!ikeyCmdUuid_(p.command_id))ikeyCmdFail_('INVALID_REQUEST');
   const r=rows.find(x=>String(x[0])===p.command_id&&String(x[1])===p.project_id&&String(x[2])===p.device_id);
   return r?ikeyCmdSafe_(r):null;
  }
 }finally{lock.releaseLock();}
}
