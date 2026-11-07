/* iKey Gen3 STAGING PING BUNDLE — generated from PR #101 staging files.
 * Install as ONE .gs file in the isolated Apps Script staging project.
 * Do not install alongside individual ikey-ping-*.gs files (duplicate globals).
 * Requires actual existing gas-device-actions.gs, gas-device-authorization.gs and verified doPost dispatcher.
 * NO doPost defined, NO live route enabled, NO production credentials included.
 */

// ===== BEGIN ikey-ping-command-actions.gs =====
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
  if(action!=='devicePingClaim'&&action!=='devicePingCreate'&&!ikeyPingUUID_(p.command_id))
   throw Error('PING_INVALID_COMMAND_ID');
  if(action==='devicePingClaim'){
   for(let i=0;i<rows.length;i++){
    const r=rows[i];
    if(r[1]===p.project_id&&r[2]===p.device_id&&r[3]==='ping'&&r[4]==='pending'){
     sheet.getRange(i+2,5).setValue('delivered');
     sheet.getRange(i+2,7).setValue(now);
     return {command:{command_id:r[0],project_id:r[1],device_id:r[2],action:'ping',payload:null}};
    }
   }
   return {command:null};
  }
  const index=rows.findIndex(r=>r[0]===p.command_id&&r[1]===p.project_id&&r[2]===p.device_id);
  if(index<0)return {found:false};
  const row=rows[index];
  if(action==='devicePingStatus')return {found:true,command:{command_id:row[0],project_id:row[1],device_id:row[2],action:row[3],status:row[4],result:row[8]}};
  if(action!=='devicePingReport')throw Error('PING_ACTION_NOT_ALLOWED');
  if(!['completed','failed'].includes(p.result))throw Error('PING_INVALID_RESULT');
  if(row[4]===p.result)return {found:true,recorded:true,duplicate:true};
  if(row[4]!=='delivered')return {found:true,recorded:false,code:'PING_INVALID_TRANSITION'};
  sheet.getRange(index+2,5).setValue(p.result);
  sheet.getRange(index+2,8,1,2).setValues([[now,p.result]]);
  return {found:true,recorded:true};
 });
}

// ===== END ikey-ping-command-actions.gs =====

// ===== BEGIN ikey-ping-trust-verifier.gs =====
/* Staging-only GAS verifier for Render's command-trust-assertion.js.
 * Must be called by an authenticated dispatcher, not directly from doPost.
 * After verification, caller MUST enforce project owner for Web actions and
 * authenticated device binding for device actions before queue mutation.
 */
function ikeyPingVerifyAssertion_(action,payload){
 const secret=PropertiesService.getScriptProperties().getProperty('IKEY_COMMAND_TRUST_SECRET');
 if(!secret||secret.length<32)throw Error('PING_TRUST_NOT_CONFIGURED');
 const token=payload&&payload.command_assertion;
 if(typeof token!=='string'||token.length>4096)throw Error('PING_ASSERTION_MISSING');
 const parts=token.split('.');
 if(parts.length!==2||!/^[A-Za-z0-9_-]+$/.test(parts[0])||!/^[A-Za-z0-9_-]+$/.test(parts[1]))
  throw Error('PING_ASSERTION_INVALID');
 const sig=Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(parts[0],secret)).replace(/=+$/,'');
 if(sig.length!==parts[1].length)throw Error('PING_SIGNATURE_INVALID');
 let diff=0;for(let i=0;i<sig.length;i++)diff|=sig.charCodeAt(i)^parts[1].charCodeAt(i);
 if(diff!==0)throw Error('PING_SIGNATURE_INVALID');
 let claims;
 try{claims=JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString())}
 catch(_){throw Error('PING_CLAIMS_INVALID')}
 const now=Date.now();
 if(claims.v!==1||claims.aud!=='ikey-gas-command'||claims.action!==action||
    !Number.isFinite(claims.iat)||!Number.isFinite(claims.exp)||
    claims.iat>now+5000||claims.exp<=now||claims.exp-claims.iat>30000||
    typeof claims.nonce!=='string'||!/^[0-9a-f]{32}$/.test(claims.nonce))
  throw Error('PING_CLAIMS_INVALID');
 if(claims.project_id!==payload.project_id||claims.device_id!==payload.device_id)
  throw Error('PING_SCOPE_MISMATCH');
 const cleaned={};
 Object.keys(payload).filter(k=>k!=='command_assertion').sort().forEach(k=>cleaned[k]=payload[k]);
 const digest=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(cleaned))
  .map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');
 if(digest!==claims.payload_sha256)throw Error('PING_PAYLOAD_MISMATCH');
 const web=action==='devicePingCreate'||action==='devicePingStatus';
 if(web?!(typeof claims.actor_user_id==='string'&&claims.actor_user_id):
   claims.actor_user_id!==null)throw Error('PING_PRINCIPAL_INVALID');
 // Durable nonce ledger is checked and written under ScriptLock. It is
 // separate from the ping command lock to avoid nested lock acquisition.
 ikeyPingConsumeNonce_(claims.nonce,claims.exp);
 return {actor_user_id:claims.actor_user_id,project_id:claims.project_id,
  device_id:claims.device_id,action:claims.action};
}

// ===== END ikey-ping-trust-verifier.gs =====

// ===== BEGIN ikey-ping-nonce-ledger.gs =====
/* Staging-only durable nonce ledger. Requires a separate sheet:
 * Device_Ping_Nonces | nonce | expires_at
 * Provision the sheet manually in an isolated staging spreadsheet.
 * Never enable dispatcher routes without this file and permission checks.
 */
function ikeyPingConsumeNonce_(nonce,expiresAt){
 if(typeof nonce!=='string'||!/^[a-f0-9]{32}$/.test(nonce)||
    !Number.isFinite(expiresAt)||expiresAt<=Date.now())
  throw Error('PING_NONCE_INVALID');
 const id=PropertiesService.getScriptProperties().getProperty('GEN3_SPREADSHEET_ID');
 if(!id)throw Error('PING_NONCE_STORAGE_NOT_CONFIGURED');
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(15000))throw Error('PING_NONCE_LOCK_TIMEOUT');
 try{
  const sheet=SpreadsheetApp.openById(id).getSheetByName('Device_Ping_Nonces');
  if(!sheet)throw Error('PING_NONCE_SHEET_MISSING');
  const headers=sheet.getRange(1,1,1,2).getValues()[0];
  if(headers[0]!=='nonce'||headers[1]!=='expires_at')
   throw Error('PING_NONCE_SCHEMA_MISMATCH');
  const count=sheet.getLastRow()-1;
  if(count>0){
   const values=sheet.getRange(2,1,count,2).getValues();
   if(values.some(row=>row[0]===nonce))throw Error('PING_ASSERTION_REPLAY');
   // Expired nonce records can be removed after their signed assertion has
   // expired. Delete bottom-up to preserve sheet row indices.
   // Keep bounded cleanup work per call to avoid Apps Script timeouts.
   let removed=0;
   for(let i=values.length-1;i>=0&&removed<100;i--){
    const expiry=Number(values[i][1]);
    if(Number.isFinite(expiry)&&expiry<Date.now()-60000){
     sheet.deleteRow(i+2);
     removed++;
    }
   }
  }
  sheet.appendRow([nonce,expiresAt]);
 }finally{lock.releaseLock()}
}

// ===== END ikey-ping-nonce-ledger.gs =====

// ===== BEGIN ikey-ping-dispatcher.gs =====
/* Staging-only trusted GAS dispatcher integration seam.
 * Invoke only AFTER the existing doPost dispatcher validates GEN3_API_KEY.
 * No automatic doPost registration or production deployment.
 * Authorization callbacks MUST consult trusted GAS user/project/device records.
 */
function ikeyPingDispatchAuthorized_(action,payload,authorization){
 if(!['devicePingCreate','devicePingClaim','devicePingReport','devicePingStatus'].includes(action))
  throw Error('PING_ACTION_NOT_ALLOWED');
 if(!authorization||typeof authorization.verifyWebOwner!=='function'||
    typeof authorization.verifyDeviceBinding!=='function')
  throw Error('PING_AUTHORIZATION_NOT_CONFIGURED');
 const identity=ikeyPingVerifyAssertion_(action,payload);
 const web=action==='devicePingCreate'||action==='devicePingStatus';
 if(web){
  // Callback must validate an active actor and project owner, AND that the
  // requested device belongs to this project. A signed actor is not enough.
  if(authorization.verifyWebOwner(identity.actor_user_id,identity.project_id,identity.device_id)!==true)
   throw Error('PING_PROJECT_ACCESS_DENIED');
 }else{
  // Callback must validate active factory registration and project binding.
  // Device authentication must be independently established at Render.
  if(authorization.verifyDeviceBinding(identity.project_id,identity.device_id)!==true)
   throw Error('PING_DEVICE_ACCESS_DENIED');
 }
 return ikeyPingCommandAction_(action,payload);
}

// ===== END ikey-ping-dispatcher.gs =====

// ===== BEGIN ikey-ping-authorization-adapter.gs =====
/* Staging-only GAS authorization adapter for the existing Gen3 device tables.
 * Requires gas-device-actions.gs and gas-device-authorization.gs in same project.
 * Must only be called after GEN3_API_KEY and signed assertion validation.
 * Does not authenticate an ESP32 by itself; Render must verify the device.
 */
function ikeyPingVerifiedDeviceBinding_(projectId,deviceId){
 if(typeof projectId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)||
    typeof deviceId!=='string'||!/^[A-HJ-NP-Z2-9]{8}$/.test(deviceId))return false;
 const factory=ikeyDeviceSheet_('Factory_Devices',IKEY_FACTORY_HEADERS);
 const bindings=ikeyDeviceSheet_('Project_Devices',IKEY_BIND_HEADERS);
 const active=ikeyDeviceRows_(factory).filter(r=>String(r[0])===deviceId&&String(r[4])==='active');
 const matching=ikeyDeviceRows_(bindings).filter(r=>String(r[2])===deviceId);
 // Duplicate registrations or bindings are ambiguous: deny rather than guess.
 return active.length===1&&matching.length===1&&String(matching[0][1])===projectId;
}
function ikeyPingAuthorization_(){
 return {
  verifyWebOwner:function(actorUserId,projectId,deviceId){
   if(typeof actorUserId!=='string'||typeof projectId!=='string'||
      typeof deviceId!=='string')return false;
   if(ikeyVerifyDeviceActor_('factoryDeviceList',{
    actor_user_id:actorUserId,project_id:projectId
   })!==true)return false;
   return ikeyPingVerifiedDeviceBinding_(projectId,deviceId);
  },
  verifyDeviceBinding:function(projectId,deviceId){
   return ikeyPingVerifiedDeviceBinding_(projectId,deviceId);
  }
 };
}

// ===== END ikey-ping-authorization-adapter.gs =====

// ===== BEGIN ikey-ping-preflight.gs =====
/* iKey GAS ping staging preflight: read-only, no deployment or mutations.
 * Run manually in the SAME Apps Script project after adding all ping .gs files.
 * Does not reveal Script Property values or device credentials.
 */
function ikeyPingPreflight_(){
 const props=PropertiesService.getScriptProperties();
 const id=props.getProperty('GEN3_SPREADSHEET_ID');
 const secret=props.getProperty('IKEY_COMMAND_TRUST_SECRET');
 const apiKey=props.getProperty('GEN3_API_KEY');
 const result={
  legacy_factory_headers:typeof IKEY_FACTORY_HEADERS!=='undefined',
  legacy_binding_headers:typeof IKEY_BIND_HEADERS!=='undefined',
  spreadsheet_configured:Boolean(id),
  api_key_configured:typeof apiKey==='string'&&apiKey.length>=32,
  trust_secret_configured:typeof secret==='string'&&secret.length>=32,
  legacy_actor_verifier:typeof ikeyVerifyDeviceActor_==='function',
  factory_actions:typeof ikeyFactoryDeviceAction==='function',
  ping_dispatcher:typeof ikeyPingDispatchAuthorized_==='function',
  ping_route_seam:typeof ikeyPingTryDispatch_==='function',
  ping_authorization:typeof ikeyPingAuthorization_==='function',
  sheets:{}
 };
 if(id){
  const book=SpreadsheetApp.openById(id);
  [
   ['Factory_Devices',typeof IKEY_FACTORY_HEADERS!=='undefined'?IKEY_FACTORY_HEADERS:null],
   ['Project_Devices',typeof IKEY_BIND_HEADERS!=='undefined'?IKEY_BIND_HEADERS:null],
   ['Device_Ping_Commands',typeof IKEY_PING_COLUMNS_!=='undefined'?IKEY_PING_COLUMNS_:null],
   ['Device_Ping_Nonces',['nonce','expires_at']]
  ].forEach(function(entry){
   const tab=book.getSheetByName(entry[0]);
   result.sheets[entry[0]]=Boolean(Array.isArray(entry[1])&&tab&&tab.getLastColumn()>=entry[1].length&&
    tab.getRange(1,1,1,entry[1].length).getDisplayValues()[0].join('|')===entry[1].join('|'));
  });
 }
 result.ready=result.legacy_factory_headers&&result.legacy_binding_headers&&result.spreadsheet_configured&&result.api_key_configured&&result.trust_secret_configured&&
  result.legacy_actor_verifier&&result.factory_actions&&
  result.ping_dispatcher&&result.ping_route_seam&&result.ping_authorization&&
  Object.keys(result.sheets).length===4&&
  Object.values(result.sheets).every(Boolean);
 return result;
}

// ===== END ikey-ping-preflight.gs =====

// ===== BEGIN ikey-ping-route-seam.gs =====
/* iKey 3.1 — staging GAS ping routing seam.
 * Integrate ONLY into a verified copy of the existing doPost after GEN3_API_KEY
 * authentication, preserving all existing routing and response wrappers.
 * No doPost is declared here, so adding this file cannot activate a route.
 */
const IKEY_PING_ACTIONS_=[
 'devicePingCreate','devicePingClaim','devicePingReport','devicePingStatus'
];
function ikeyPingIsAction_(action){
 return typeof action==='string'&&IKEY_PING_ACTIONS_.indexOf(action)!==-1;
}
/* Returns {handled:false} for every non-ping action. Do not use a fallback
 * that silently dispatches an unrecognized action into the ping queue.
 */
function ikeyPingTryDispatch_(action,payload){
 if(!ikeyPingIsAction_(action))return {handled:false};
 return {
  handled:true,
  result:ikeyPingDispatchAuthorized_(action,payload,ikeyPingAuthorization_())
 };
}

// ===== END ikey-ping-route-seam.gs =====