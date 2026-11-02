'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {signCommandAssertion}=require('../lib/command-trust-assertion');
const secret='a'.repeat(48);
const project_id='22222222-2222-4222-8222-222222222222';
test('command assertions bind action and device with short expiry',()=>{
 const token=signCommandAssertion({secret,action:'deviceCommandClaimAtomic',project_id,device_id:'ABCDEFGH'});
 const claims=JSON.parse(Buffer.from(token.split('.')[0],'base64url').toString());
 assert.equal(claims.aud,'ikey-gas-command');
 assert.equal(claims.action,'deviceCommandClaimAtomic');
 assert.equal(claims.device_id,'ABCDEFGH');
 assert.equal(claims.exp-claims.iat,30000);
 assert.match(claims.nonce,/^[a-f0-9]{32}$/);
});
test('command assertion refuses weak secret and unknown action',()=>{
 assert.throws(()=>signCommandAssertion({secret:'short',action:'deviceCommandGet',project_id,device_id:'ABCDEFGH'}),/COMMAND_TRUST_NOT_CONFIGURED/);
 assert.throws(()=>signCommandAssertion({secret,action:'db.delete',project_id,device_id:'ABCDEFGH'}),/COMMAND_ACTION_NOT_ALLOWED/);
});
