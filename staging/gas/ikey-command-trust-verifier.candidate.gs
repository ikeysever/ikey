/**
 * iKey 3.1 — Render -> GAS command assertion verifier (STAGING CANDIDATE).
 * Requires Script Property IKEY_COMMAND_TRUST_SECRET (>=32 UTF-8 bytes).
 * Must be invoked BEFORE command data is read or changed; never accept
 * actor_user_id or device_id from the payload without this verification.
 * Do not deploy without integrating the command dispatcher and atomic store.
 */
function ikeyCommandB64Url_(bytes) {
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/,'');
}
function ikeyCommandBytes_(value) {
  return Utilities.base64DecodeWebSafe(value + '='.repeat((4-value.length%4)%4));
}
function ikeyCommandDigest_(payload) {
  const clean = {};
  Object.keys(payload).filter(k=>k!=='command_assertion').sort()
    .forEach(k=>{ clean[k]=payload[k]; });
  const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    JSON.stringify(clean),Utilities.Charset.UTF_8);
  return bytes.map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');
}
function ikeyCommandEqual_(a,b) {
  if(typeof a!=='string'||typeof b!=='string')return false;
  let diff=a.length^b.length;
  for(let i=0;i<Math.max(a.length,b.length);i++)
    diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);
  return diff===0;
}
function ikeyCommandVerifyAssertionCandidate_(action,payload) {
  const allowed=['deviceCommandCreateAtomic','deviceCommandGet',
    'deviceCommandClaimAtomic','deviceCommandReportAtomic'];
  if(!allowed.includes(action))throw Error('COMMAND_ACTION_NOT_ALLOWED');
  if(!payload||typeof payload!=='object'||Array.isArray(payload))
    throw Error('INVALID_COMMAND_CONTEXT');
  const token=payload.command_assertion;
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))
    throw Error('COMMAND_ASSERTION_REQUIRED');
  const secret=PropertiesService.getScriptProperties().getProperty('IKEY_COMMAND_TRUST_SECRET');
  if(!secret||Utilities.newBlob(secret).getBytes().length<32)
    throw Error('COMMAND_TRUST_NOT_CONFIGURED');
  const parts=token.split('.');
  const expected=ikeyCommandB64Url_(Utilities.computeHmacSha256Signature(
    parts[0],secret,Utilities.Charset.UTF_8));
  if(!ikeyCommandEqual_(parts[1],expected))throw Error('COMMAND_ASSERTION_INVALID');
  let claims;
  try { claims=JSON.parse(Utilities.newBlob(ikeyCommandBytes_(parts[0])).getDataAsString()); }
  catch(e){throw Error('COMMAND_ASSERTION_INVALID');}
  const now=Date.now();
  if(!claims||claims.v!==1||claims.aud!=='ikey-gas-command'||
    claims.action!==action||!Number.isSafeInteger(claims.iat)||
    !Number.isSafeInteger(claims.exp)||claims.exp<=now||
    claims.iat>now+5000||claims.exp-claims.iat!==30000||
    typeof claims.nonce!=='string'||!/^[0-9a-f]{32}$/.test(claims.nonce)||
    claims.project_id!==payload.project_id||
    claims.device_id!==payload.device_id||
    (claims.actor_user_id||null)!==(payload.actor_user_id||null)||
    claims.payload_sha256!==ikeyCommandDigest_(payload))
    throw Error('COMMAND_ASSERTION_INVALID');
  // CacheService alone cannot guarantee atomic single-use under concurrency.
  // This function is NOT sufficient to authorize mutation. Production dispatcher
  // must reserve nonce atomically in durable storage under a lock/transaction.
  return {project_id:claims.project_id,device_id:claims.device_id,
    actor_user_id:claims.actor_user_id,nonce:claims.nonce,exp:claims.exp};
}
