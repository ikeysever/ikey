'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {verifyFactoryCredential}=require('../gen3-auth/factory-credential');
const password='correct-factory-password';
const salt=crypto.randomBytes(32);
const credential={
 credential_kdf:'scrypt-n16384-r8-p1',
 credential_salt:salt.toString('hex'),
 credential_hash:crypto.scryptSync(password,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024}).toString('hex')
};
test('factory scrypt credential accepts valid password and rejects wrong password',()=>{
 assert.equal(verifyFactoryCredential(password,credential),true);
 assert.equal(verifyFactoryCredential('incorrect-password',credential),false);
});
test('factory scrypt verifier fails closed on malformed KDF, salts and hashes',()=>{
 for(const field of ['credential_kdf','credential_salt','credential_hash']){
  assert.equal(verifyFactoryCredential(password,{...credential,[field]:'invalid'}),false);
 }
 assert.equal(verifyFactoryCredential(password,null),false);
 assert.equal(verifyFactoryCredential('',credential),false);
 assert.equal(verifyFactoryCredential(password,{...credential,credential_hash:'0'.repeat(128)}),false);
});
