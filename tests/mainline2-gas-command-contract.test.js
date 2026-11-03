'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const gas=fs.readFileSync('staging/gas/ikey-device-command-dispatch.candidate.gs','utf8');
const gateway=fs.readFileSync('lib/device-command-gateway.js','utf8');
test('GAS command candidate has all four gateway actions',()=>{
 for(const a of ['deviceCommandCreateAtomic','deviceCommandClaimAtomic','deviceCommandReportAtomic','deviceCommandGet']){
  assert.ok(gas.includes(a));assert.ok(gateway.includes(a));
 }
});
test('create and claim response contract matches Render gateway',()=>{
 assert.match(gas,/command:\{command_id:old\.r\[0\]/);
 assert.match(gas,/command:\{command_id,status:'pending'/);
 assert.match(gas,/status:'claimed'/);
 assert.match(gas,/deadline_at:Number\(pending\.r\[8\]\)/);
});
test('GAS never stores plaintext claim token',()=>{
 assert.match(gas,/tokenHash=ikeyCommandDigest_/);
 assert.match(gas,/write\(pending,10,tokenHash\)/);
 assert.doesNotMatch(gas,/write\(pending,10,payload\.claim_token\)/);
});
test('GAS command candidate verifies signed assertion and nonce before mutation',()=>{
 assert.match(gas,/ikeyCommandAuthorizeCandidate_\(action,payload\)/);
 assert.match(gas,/LockService\.getScriptLock/);
 assert.match(gas,/COMMAND_STORE_NOT_CONFIGURED/);
});
