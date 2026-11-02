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
 // Must run under a script lock in dispatcher before processing the action.
 const cache=CacheService.getScriptCache();
 const nonceKey='ikey-cmd-nonce-'+c.nonce;
 if(cache.get(nonceKey))throw Error('COMMAND_ASSERTION_REPLAY');
 cache.put(nonceKey,'1',60);
 return true;
}
