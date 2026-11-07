'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {validateDeviceLogin,validateCommandEnvelope,validateDeviceReport,verifyBearerToken}=require('../gen3-auth/device-bridge-contract');
const command_id='11111111-1111-4111-8111-111111111111';
const project_id='22222222-2222-4222-8222-222222222222';
test('device login requires exact device id and password fields',()=>{
 assert.deepEqual(validateDeviceLogin({device_id:'Y8R69EXB',password:'long-secret'}),{device_id:'Y8R69EXB',password:'long-secret'});
 for(const payload of [null,{},[],{device_id:'Y8R69EXB',password:'bad'},{device_id:'Y8R69EXB',password:'long-secret',admin:true},{device_id:'bad',password:'long-secret'}])
  assert.equal(validateDeviceLogin(payload),null);
});
test('only non-actuating ping command envelopes pass',()=>{
 const base={command_id,project_id,device_id:'Y8R69EXB',action:'ping',payload:null};
 assert.equal(validateCommandEnvelope(base),true);
 assert.equal(validateCommandEnvelope({...base,action:'unlock'}),false);
 assert.equal(validateCommandEnvelope({...base,payload:{pin:1}}),false);
 assert.equal(validateCommandEnvelope({...base,device_id:'OTHER'}),false);
});
test('device reports accept fixed results and reject arbitrary fields',()=>{
 assert.equal(validateDeviceReport({command_id,result:'completed'}),true);
 assert.equal(validateDeviceReport({command_id,result:'unlock'}),false);
 assert.equal(validateDeviceReport({command_id,result:'completed',device_id:'Y8R69EXB'}),false);
});
test('bearer token comparison requires correct SHA256 digest',()=>{
 const token=crypto.randomBytes(32).toString('hex');
 const hash=crypto.createHash('sha256').update(token).digest('hex');
 assert.equal(verifyBearerToken(token,hash),true);
 assert.equal(verifyBearerToken(crypto.randomBytes(32).toString('hex'),hash),false);
 assert.equal(verifyBearerToken(token,'invalid'),false);
});
