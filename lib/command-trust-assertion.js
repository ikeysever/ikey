'use strict';
// Signed short-lived command identity assertions for the Render -> GAS boundary.
// The GAS verifier must independently check signature, expiry, audience, action,
// and single-use nonce before trusting any asserted actor or device identity.
const crypto=require('node:crypto');
const ACTIONS=new Set(['deviceCommandCreateAtomic','deviceCommandGet','deviceCommandClaimAtomic','deviceCommandReportAtomic','deviceCommandExpireAtomic']);
function commandPayloadDigest(payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('INVALID_COMMAND_CONTEXT');
 const clean={...payload};
 delete clean.command_assertion;
 const canonical=JSON.stringify(Object.fromEntries(Object.keys(clean).sort().map(k=>[k,clean[k]])));
 return crypto.createHash('sha256').update(canonical).digest('hex');
}
function signCommandAssertion({secret,action,project_id,device_id,actor_user_id,payload,now=Date.now()}){
 if(typeof secret!=='string'||Buffer.byteLength(secret)<32)throw Error('COMMAND_TRUST_NOT_CONFIGURED');
 if(!ACTIONS.has(action))throw Error('COMMAND_ACTION_NOT_ALLOWED');
 if(typeof project_id!=='string'||typeof device_id!=='string')throw Error('INVALID_COMMAND_CONTEXT');
 const claims={v:1,aud:'ikey-gas-command',action,project_id,device_id,
  actor_user_id:actor_user_id||null,payload_sha256:commandPayloadDigest(payload),iat:now,exp:now+30000,
  nonce:crypto.randomBytes(16).toString('hex')};
 const encodedClaims=Buffer.from(JSON.stringify(claims)).toString('base64url');
 const signature=crypto.createHmac('sha256',secret).update(encodedClaims).digest('base64url');
 return encodedClaims+'.'+signature;
}
module.exports={signCommandAssertion,commandPayloadDigest};
