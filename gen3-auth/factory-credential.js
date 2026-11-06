'use strict';
const crypto=require('node:crypto');

// Verify GAS factory credential records. Never log or return these fields to browsers.
function verifyFactoryCredential(password,credential){
 if(typeof password!=='string'||password.length<8||password.length>128)return false;
 if(credential?.credential_kdf!=='scrypt-n16384-r8-p1'||
   !/^[a-f0-9]{64}$/.test(String(credential.credential_salt||''))||
   !/^[a-f0-9]{128}$/.test(String(credential.credential_hash||'')))return false;
 try{
  const actual=crypto.scryptSync(password,Buffer.from(credential.credential_salt,'hex'),64,
   {N:16384,r:8,p:1,maxmem:64*1024*1024});
  return crypto.timingSafeEqual(actual,Buffer.from(credential.credential_hash,'hex'));
 }catch{return false;}
}
module.exports={verifyFactoryCredential};
