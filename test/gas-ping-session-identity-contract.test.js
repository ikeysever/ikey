'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
const signer=fs.readFileSync(path.join(__dirname,'../gen3-auth/signed-ping-store.js'),'utf8');
const verifier=fs.readFileSync(path.join(__dirname,'../gas-staging/ikey-ping-trust-verifier.gs'),'utf8');
const adapter=fs.readFileSync(path.join(__dirname,'../gas-staging/ikey-ping-authorization-adapter.gs'),'utf8');
test('web actor derives from resolved server session, not browser payload',()=>{
 assert.match(server,/authStore\.resolveSession\(hashToken\(raw\)\)/);
 assert.match(server,/!active\(resolved\.user\)/);
 assert.match(server,/req\.projectUser=resolved\.user/);
 assert.match(server,/actor_user_id:req\.projectUser\.user_id/);
 assert.doesNotMatch(server,/actor_user_id:req\.body\.actor_user_id/);
});
test('signed assertion carries authenticated actor to GAS verifier',()=>{
 assert.match(signer,/actor_user_id:webOperation\?actor_user_id:null/);
 assert.match(verifier,/claims\.actor_user_id/);
 assert.match(verifier,/ikeyPingConsumeNonce_\(claims\.nonce,claims\.exp\)/);
 assert.match(adapter,/ikeyVerifyDeviceActor_\('factoryDeviceList'/);
 assert.match(adapter,/ikeyPingVerifiedDeviceBinding_\(projectId,deviceId\)/);
});
