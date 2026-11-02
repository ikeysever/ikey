'use strict';
// Offline, no-network security smoke tests for Render's command assertion signer.
// Does not contact GAS, mutate Sheets, or enable physical unlock.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {signCommandAssertion,commandPayloadDigest}=require('../lib/command-trust-assertion');
const secret=crypto.randomBytes(32).toString('base64');
const action='deviceCommandGet';
const payload={project_id:'00000000-0000-4000-8000-000000000001',device_id:'Y8R69EXB',actor_user_id:'00000000-0000-4000-8000-000000000002',command_id:'00000000-0000-4000-8000-000000000003'};
function verifyLocal(token,expected,now){
 const parts=token.split('.');
 if(parts.length!==2)return false;
 const mac=crypto.createHmac('sha256',secret).update(parts[0]).digest('base64url');
 const a=Buffer.from(mac),b=Buffer.from(parts[1]);
 if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return false;
 const claims=JSON.parse(Buffer.from(parts[0],'base64url').toString());
 return claims.aud==='ikey-gas-command'&&claims.action===action&&
  claims.project_id===payload.project_id&&claims.device_id===payload.device_id&&
  claims.actor_user_id===payload.actor_user_id&&
  claims.payload_sha256===commandPayloadDigest(expected)&&
  claims.iat<=now&&claims.exp>now;
}
const now=Date.now();
const token=signCommandAssertion({secret,action,...payload,payload,now});
assert.equal(verifyLocal(token,payload,now),true,'valid assertion');
assert.equal(verifyLocal(token.slice(0,-1)+(token.endsWith('A')?'B':'A'),payload,now),false,'tampered signature');
assert.equal(verifyLocal(token,{...payload,command_id:'changed'},now),false,'modified payload');
assert.equal(verifyLocal(token,payload,now+31000),false,'expired assertion');
const second=signCommandAssertion({secret,action,...payload,payload,now});
assert.notEqual(token,second,'unique nonce per assertion');
assert.throws(()=>signCommandAssertion({secret:'weak',action,...payload,payload,now}),/COMMAND_TRUST_NOT_CONFIGURED/);
process.stdout.write(JSON.stringify({check:'command_signer_offline',ok:true,tests:6,gas_called:false,physical_unlock:false})+'\n');
// Replay prevention requires deployed GAS nonce persistence and is NOT verified here.
