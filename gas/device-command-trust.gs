/**
 * Staging-only HMAC verifier. Dispatcher must call this before command actions.
 * A valid assertion proves Render issued the identity claim, not that the
 * claimed actor is authorized: command actions must still check permissions.
 */
function ikeyCommandPayloadDigest_(p){
 const clean=Object.assign({},p);
 delete clean.command_assertion;
 const sorted={};
 Object.keys(clean).sort().forEach(k=>sorted[k]=clean[k]);
 return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(sorted))
  .map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');
}
/**
 * Explicit maintenance only; never called in the command execution path.
 * Caller must run this while holding the same script lock as command processing.
 * Expired nonces remain until they are at least 24h past expiry.
 */
function ikeyCommandNoncePruneLocked_(ledger,now,maxRows){
 if(!ledger||!Number.isSafeInteger(now)||!Number.isSafeInteger(maxRows)||maxRows<1||maxRows>500)
  throw Error('COMMAND_REPLAY_MAINTENANCE_INVALID');
 const last=ledger.getLastRow();
 if(last<2)return 0;
 const values=ledger.getRange(2,1,last-1,2).getValues();
 const cutoff=now-86400000;
 const indexes=[];
 for(let i=0;i<values.length;i++){
  const expiry=values[i][1];
  if(typeof expiry==='number'&&Number.isSafeInteger(expiry)&&expiry<cutoff){
   indexes.push(i+2);
   if(indexes.length>=maxRows)break;
  }
 }
 for(let i=indexes.length-1;i>=0;i--)ledger.deleteRow(indexes[i]);
 return indexes.length;
}
function ikeyCommandTrustVerify_(token,action,p){
 if(typeof token!=='string'||token.length>4096||typeof p!=='object'||!p)
  throw Error('COMMAND_ASSERTION_INVALID');
 const secret=PropertiesService.getScriptProperties().getProperty('IKEY_COMMAND_TRUST_SECRET');
 if(!secret||secret.length<32)throw Error('COMMAND_TRUST_NOT_CONFIGURED');
 const parts=token.split('.');
 if(parts.length!==2||!parts.every(x=>/^[A-Za-z0-9_-]+$/.test(x)))
  throw Error('COMMAND_ASSERTION_INVALID');
 const bytes=Utilities.computeHmacSha256Signature(parts[0],secret);
 const expected=Utilities.base64EncodeWebSafe(bytes).replace(/=+$/,'');
 if(expected.length!==parts[1].length)throw Error('COMMAND_ASSERTION_INVALID');
 let mismatch=0;
 for(let i=0;i<expected.length;i++)mismatch|=expected.charCodeAt(i)^parts[1].charCodeAt(i);
 if(mismatch)throw Error('COMMAND_ASSERTION_INVALID');
 let c;
 try{c=JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());}
 catch(_e){throw Error('COMMAND_ASSERTION_INVALID');}
 const now=Date.now();
 if(c.v!==1||c.aud!=='ikey-gas-command'||c.action!==action||
   c.project_id!==p.project_id||c.device_id!==p.device_id||
   c.payload_sha256!==ikeyCommandPayloadDigest_(p)||
   !Number.isSafeInteger(c.iat)||!Number.isSafeInteger(c.exp)||
   c.iat>now+5000||c.exp<=now||c.exp-c.iat!==30000||
   typeof c.nonce!=='string'||!/^[a-f0-9]{32}$/.test(c.nonce))
  throw Error('COMMAND_ASSERTION_INVALID');
 if(['deviceCommandCreateAtomic','deviceCommandGet'].includes(action)){
  if(c.actor_user_id!==p.actor_user_id)throw Error('COMMAND_ASSERTION_INVALID');
 }else if(c.actor_user_id!==null)throw Error('COMMAND_ASSERTION_INVALID');
 // Durable replay ledger: CacheService is best-effort and cannot be trusted alone.
 // This function is called under the command action's script lock.
 const spreadsheetId=PropertiesService.getScriptProperties().getProperty('GEN3_SPREADSHEET_ID');
 if(!spreadsheetId)throw Error('COMMAND_REPLAY_STORAGE_UNAVAILABLE');
 const ledger=SpreadsheetApp.openById(spreadsheetId).getSheetByName('DeviceCommandNonces');
 if(!ledger)throw Error('COMMAND_REPLAY_STORAGE_UNAVAILABLE');
 const headers=ledger.getRange(1,1,1,2).getDisplayValues()[0];
 if(headers[0]!=='nonce'||headers[1]!=='expires_at')throw Error('COMMAND_REPLAY_SCHEMA_MISMATCH');
 const last=ledger.getLastRow();
 const values=last>1?ledger.getRange(2,1,last-1,2).getValues():[];
 if(values.some(r=>String(r[0])===c.nonce))throw Error('COMMAND_ASSERTION_REPLAY');
 // Keep used nonces until explicit retention maintenance; do not depend on cache eviction.
 ledger.appendRow([c.nonce,c.exp]);
 return true;
}
