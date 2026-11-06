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
 // CacheService replay marker is not a durable atomic nonce ledger.
 // Dispatcher must use a durable, atomic replay store before production.
 const cache=CacheService.getScriptCache(),key='ikey_ping_nonce_'+claims.nonce;
 if(cache.get(key))throw Error('PING_ASSERTION_REPLAY');
 cache.put(key,'1',60);
 return {actor_user_id:claims.actor_user_id,project_id:claims.project_id,
  device_id:claims.device_id,action:claims.action};
}
