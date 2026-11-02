'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {signCommandAssertion}=require('../lib/command-trust-assertion');
const source=fs.readFileSync(path.join(__dirname,'../gas/device-command-trust.gs'),'utf8');
const SECRET='cross-runtime-secret-'.repeat(3);
const project_id='123e4567-e89b-42d3-a456-426614174001';
const device_id='ABCDEFGH',actor_user_id='123e4567-e89b-42d3-a456-426614174000';
const samples=[
 ['deviceCommandCreateAtomic',{project_id,device_id,actor_user_id,action:'unlock',idempotency_key:'test-idempotency',timeout_ms:15000}],
 ['deviceCommandGet',{project_id,device_id,actor_user_id,command_id:project_id}],
 ['deviceCommandClaimAtomic',{project_id,device_id,claim_token:'a'.repeat(64)}],
 ['deviceCommandReportAtomic',{project_id,device_id,command_id:project_id,claim_token:'a'.repeat(64),status:'failed',feedback_observed:false}]
];
function harness(){
 const rows=[];const ledger={
  getRange:(row,col,count,width)=>({
   getDisplayValues:()=>[['nonce','expires_at']],
   getValues:()=>rows.map(x=>x.slice())
  }),
  getLastRow:()=>rows.length+1,
  appendRow:r=>rows.push([...r])
 };
 const Utilities={
  computeDigest:(_alg,s)=>[...crypto.createHash('sha256').update(s).digest()].map(x=>x>127?x-256:x),
  computeHmacSha256Signature:(msg,key)=>[...crypto.createHmac('sha256',key).update(msg).digest()],
  base64EncodeWebSafe:bytes=>Buffer.from(bytes.map(x=>x&255)).toString('base64url'),
  base64DecodeWebSafe:s=>[...Buffer.from(s,'base64url')],
  newBlob:bytes=>({getDataAsString:()=>Buffer.from(bytes).toString('utf8')}),
  DigestAlgorithm:{SHA_256:'SHA_256'}
 };
 const ctx={Utilities,PropertiesService:{getScriptProperties:()=>({getProperty:k=>k==='IKEY_COMMAND_TRUST_SECRET'?SECRET:'offline-sheet'})},
  SpreadsheetApp:{openById:()=>({getSheetByName:name=>name==='DeviceCommandNonces'?ledger:null})}};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 return {verify:(token,action,payload)=>vm.runInContext('ikeyCommandTrustVerify_',ctx)(token,action,payload),rows};
}
test('real Render signatures validate in GAS for all four actions, replay fails closed',()=>{
 for(const [action,payload] of samples){
  const h=harness();
  const token=signCommandAssertion({secret:SECRET,action,project_id,device_id,actor_user_id:payload.actor_user_id,payload});
  assert.equal(h.verify(token,action,{...payload,command_assertion:token}),true,action);
  assert.equal(h.rows.length,1);
  assert.throws(()=>h.verify(token,action,{...payload,command_assertion:token}),/COMMAND_ASSERTION_REPLAY/);
 }
});
test('GAS rejects tampered payload, wrong action and altered signature without consuming nonce',()=>{
 const [action,payload]=samples[0];const h=harness();
 const token=signCommandAssertion({secret:SECRET,action,project_id,device_id,actor_user_id,payload});
 assert.throws(()=>h.verify(token,action,{...payload,timeout_ms:16000,command_assertion:token}),/COMMAND_ASSERTION_INVALID/);
 assert.throws(()=>h.verify(token,'deviceCommandGet',{...payload,command_assertion:token}),/COMMAND_ASSERTION_INVALID/);
 const parts=token.split('.');const bad=parts[0]+'.'+(parts[1][0]==='a'?'b':'a')+parts[1].slice(1);
 assert.throws(()=>h.verify(bad,action,{...payload,command_assertion:bad}),/COMMAND_ASSERTION_INVALID/);
 assert.equal(h.rows.length,0);
});
