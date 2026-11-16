'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {payload,createTimeHandler}=require('../lib/device-signed-time');
function invoke(handler,nonce){
 const out={status:200,headers:{},body:null};
 const res={set(k,v){out.headers[k]=v;return this;},status(n){out.status=n;return this;},json(b){out.body=b;return this;}};
 handler({query:{nonce}},res);return out;
}
test('signed time rejects malformed nonce and missing key',()=>{
 const handler=createTimeHandler(()=>undefined);
 assert.equal(invoke(handler,'bad').status,400);
 assert.equal(invoke(handler,'a'.repeat(32)).status,503);
});
test('signed time verifies with public key, rejects tampering and replay with new nonce',()=>{
 const {privateKey,publicKey}=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 const handler=createTimeHandler(()=>privateKey.export({type:'pkcs8',format:'pem'}));
 const nonce=crypto.randomBytes(16).toString('hex');
 const response=invoke(handler,nonce);
 assert.equal(response.status,200);
 assert.equal(response.headers['Cache-Control'],'no-store');
 const {unix,signature}=response.body;
 const sig=Buffer.from(signature,'base64');
 assert.equal(crypto.verify('sha256',Buffer.from(payload(nonce,unix)),publicKey,sig),true);
 assert.equal(crypto.verify('sha256',Buffer.from(payload(nonce,unix+1)),publicKey,sig),false);
 assert.equal(crypto.verify('sha256',Buffer.from(payload('f'.repeat(32),unix)),publicKey,sig),false);
 assert.ok(Math.abs(Date.now()/1000-unix)<5);
});
