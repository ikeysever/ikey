/**
 * iKey 3.1 command actions — isolated GAS staging candidate.
 * Requires the trust verifier and nonce store candidates in this directory.
 * Must run against a SANDBOX spreadsheet (IKEY_COMMAND_SPREADSHEET_ID).
 * DeviceCommands header:
 * command_id,project_id,device_id,actor_user_id,action,status,
 * idempotency_key,created_at,expires_at,claim_token,claimed_at,
 * result_status,feedback_observed,reported_at
 * No physical GPIO control exists in this module.
 */
function ikeyCommandDispatchCandidate_(action,payload) {
  const allowed=['deviceCommandCreateAtomic','deviceCommandClaimAtomic',
    'deviceCommandReportAtomic','deviceCommandGet'];
  if(!allowed.includes(action))throw Error('COMMAND_ACTION_NOT_ALLOWED');
  // Signature and durable nonce replay protection are mandatory, including reads.
  ikeyCommandAuthorizeCandidate_(action,payload);
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(10000))throw Error('COMMAND_STORE_LOCK_BUSY');
  try {
    const id=PropertiesService.getScriptProperties().getProperty('IKEY_COMMAND_SPREADSHEET_ID');
    if(!id)throw Error('COMMAND_STORE_NOT_CONFIGURED');
    const sheet=SpreadsheetApp.openById(id).getSheetByName('DeviceCommands');
    if(!sheet)throw Error('COMMAND_SHEET_MISSING');
    const columns=['command_id','project_id','device_id','actor_user_id','action','status',
      'idempotency_key','created_at','expires_at','claim_token','claimed_at',
      'result_status','feedback_observed','reported_at'];
    if(sheet.getLastColumn()!==columns.length ||
       columns.some((c,i)=>sheet.getRange(1,i+1).getDisplayValue()!==c))
      throw Error('COMMAND_SCHEMA_MISMATCH');
    const n=sheet.getLastRow();
    const rows=n>1?sheet.getRange(2,1,n-1,columns.length).getDisplayValues():[];
    const entries=rows.map((r,i)=>({r,i:i+2}));
    const now=Date.now();
    const uid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const did=/^[A-HJ-NP-Z2-9]{8}$/;
    if(!uid.test(payload.project_id||'')||!did.test(payload.device_id||''))
      throw Error('COMMAND_INVALID_CONTEXT');
    const same=e=>e.r[1]===payload.project_id&&e.r[2]===payload.device_id;
    const write=(e,col,value)=>sheet.getRange(e.i,col).setValue(value);
    if(action==='deviceCommandCreateAtomic'){
      if(!uid.test(payload.actor_user_id||'')||payload.action!=='unlock'||
         typeof payload.idempotency_key!=='string'||
         !/^[A-Za-z0-9._:-]{8,128}$/.test(payload.idempotency_key)||
         !Number.isSafeInteger(payload.timeout_ms)||payload.timeout_ms<1000||
         payload.timeout_ms>60000)throw Error('COMMAND_INVALID_REQUEST');
      const old=entries.find(e=>same(e)&&e.r[6]===payload.idempotency_key);
      if(old)return {command:{command_id:old.r[0],status:old.r[5]},duplicate:true};
      const command_id=Utilities.getUuid();
      sheet.appendRow([command_id,payload.project_id,payload.device_id,
        payload.actor_user_id,'unlock','pending',payload.idempotency_key,
        new Date(now).toISOString(),String(now+payload.timeout_ms),'','','','','']);
      SpreadsheetApp.flush();
      return {command:{command_id,status:'pending'},duplicate:false};
    }
    if(action==='deviceCommandClaimAtomic'){
      const pending=entries.find(e=>same(e)&&e.r[5]==='pending'&&Number(e.r[8])>now);
      if(!pending)return null;
      if(typeof payload.claim_token!=='string'||!/^[0-9a-f]{64}$/.test(payload.claim_token))
        throw Error('COMMAND_INVALID_CLAIM_TOKEN');
      const tokenHash=ikeyCommandDigest_({claim_token:payload.claim_token});
      write(pending,6,'claimed');write(pending,10,tokenHash);write(pending,11,new Date(now).toISOString());
      SpreadsheetApp.flush();
      return {command:{command_id:pending.r[0],action:'unlock',status:'claimed',
        deadline_at:Number(pending.r[8])}};
    }
    if(action==='deviceCommandGet'){
      if(!uid.test(payload.command_id||'')||!uid.test(payload.actor_user_id||''))
        throw Error('COMMAND_INVALID_REQUEST');
      const found=entries.find(e=>same(e)&&e.r[0]===payload.command_id);
      if(!found)return null;
      if(found.r[3]!==payload.actor_user_id)throw Error('COMMAND_ACTOR_MISMATCH');
      return {command_id:found.r[0],status:found.r[5],
        expires_at:Number(found.r[8]),result_status:found.r[11]||null};
    }
    if(action==='deviceCommandReportAtomic'){
      if(!uid.test(payload.command_id||'')||
         typeof payload.claim_token!=='string'||!/^[0-9a-f]{64}$/.test(payload.claim_token)||
         !['succeeded','failed'].includes(payload.status)||
         typeof payload.feedback_observed!=='boolean'||
         (payload.status==='succeeded'&&!payload.feedback_observed))
        throw Error('COMMAND_INVALID_REPORT');
      const found=entries.find(e=>same(e)&&e.r[0]===payload.command_id);
      if(!found)throw Error('COMMAND_NOT_FOUND');
      if(found.r[5]==='succeeded'||found.r[5]==='failed')
        throw Error('COMMAND_ALREADY_REPORTED');
      if(found.r[5]!=='claimed'||found.r[9]!==ikeyCommandDigest_({claim_token:payload.claim_token}))
        throw Error('COMMAND_CLAIM_MISMATCH');
      if(Number(found.r[8])<=now)throw Error('COMMAND_EXPIRED');
      write(found,6,payload.status);write(found,12,payload.status);
      write(found,13,payload.feedback_observed);write(found,14,new Date(now).toISOString());
      SpreadsheetApp.flush();
      return {command_id:found.r[0],status:payload.status};
    }
    throw Error('COMMAND_ACTION_NOT_ALLOWED');
  } finally {lock.releaseLock();}
}
