'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const {signCommandAssertion}=require('../lib/command-trust-assertion');
const source=fs.readFileSync(path.join(__dirname,'../gas-staging/ikey-ping-trust-verifier.gs'),'utf8');
const SECRET='staging-only-cross-language-test-secret-123456';
const PROJECT='123e4567-e89b-42d3-a456-426614174000',DEVICE='Y8R69EXB',ACTOR='123e4567-e89b-42d3-a456-426614174001';
function verifier(){
 const consumed=new Set();
 const ctx={
  Date,Number,Object,JSON,Error,
  PropertiesService:{getScriptProperties:()=>({getProperty:()=>SECRET})},
  Utilities:{
   base64EncodeWebSafe:bytes=>Buffer.from(bytes.map(n=>n&255)).toString('base64url'),
   base64DecodeWebSafe:s=>[...Buffer.from(s,'base64url')].map(n=>n>127?n-256:n),
   newBlob:bytes=>({getDataAsString:()=>Buffer.from(bytes.map(n=>n&255)).toString('utf8')}),
   computeHmacSha256Signature:(value,key)=>[...crypto.createHmac('sha256',key).update(value).digest()].map(n=>n>127?n-256:n),
   computeDigest:(_alg,value)=>[...crypto.createHash('sha256').update(value).digest()].map(n=>n>127?n-256:n),
   DigestAlgorithm:{SHA_256:'sha256'}
  },
  ikeyPingConsumeNonce_:(nonce)=>{if(consumed.has(nonce))throw Error('PING_ASSERTION_REPLAY');consumed.add(nonce)}
 };
 vm.createContext(ctx);vm.runInContext(source,ctx);
 return ctx.ikeyPingVerifyAssertion_;
}
function signed(action,payload,actor=ACTOR){
 return {...payload,command_assertion:signCommandAssertion({
  secret:SECRET,action,project_id:PROJECT,device_id:DEVICE,
  actor_user_id:actor,payload
 })};
}
test('real Render signer interoperates with GAS HMAC verifier and rejects replay',()=>{
 const verify=verifier(),action='devicePingCreate',payload={project_id:PROJECT,device_id:DEVICE};
 const p=signed(action,payload);
 const identity=verify(action,p);
 assert.equal(identity.actor_user_id,ACTOR);
 assert.equal(identity.project_id,PROJECT);
 assert.throws(()=>verify(action,p),/PING_ASSERTION_REPLAY/);
});
test('GAS verifier denies tampered scope and payload',()=>{
 const verify=verifier(),action='devicePingCreate',payload={project_id:PROJECT,device_id:DEVICE};
 assert.throws(()=>verify(action,{...signed(action,payload),device_id:'ABCDEFGH'}),/PING_SCOPE_MISMATCH/);
 assert.throws(()=>verify(action,{...signed(action,payload),extra:'x'}),/PING_PAYLOAD_MISMATCH/);
});
test('GAS verifier accepts device principal only without actor',()=>{
 const verify=verifier(),action='devicePingClaim',payload={project_id:PROJECT,device_id:DEVICE};
 const p=signed(action,payload,null);
 assert.equal(verify(action,p).actor_user_id,null);
 assert.throws(()=>verify(action,signed(action,payload,ACTOR)),/PING_PRINCIPAL_INVALID/);
});
