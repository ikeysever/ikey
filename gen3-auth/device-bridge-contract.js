'use strict';
const crypto=require('node:crypto');
const ID=/^[A-HJ-NP-Z2-9]{8}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Contract-only implementation. No hardware actuation and no GAS calls.
function validateDeviceLogin(body){
 if(!body||typeof body!=='object'||Array.isArray(body))return null;
 if(Object.keys(body).sort().join(',')!=='device_id,password')return null;
 const device_id=body.device_id,password=body.password;
 if(typeof device_id!=='string'||!ID.test(device_id))return null;
 if(typeof password!=='string'||password.length<8||password.length>128)return null;
 return {device_id,password};
}
function validateCommandEnvelope(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 if(!UUID.test(String(value.command_id||''))||!UUID.test(String(value.project_id||'')))return false;
 if(!ID.test(String(value.device_id||'')))return false;
 // Only a non-actuating ping is allowed in the first integration stage.
 if(value.action!=='ping'||value.payload!==null)return false;
 return true;
}
function validateDeviceReport(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 if(Object.keys(value).sort().join(',')!=='command_id,result')return false;
 return UUID.test(String(value.command_id||''))&&['received','completed','failed'].includes(value.result);
}
function verifyBearerToken(token,expectedHash){
 if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return false;
 if(typeof expectedHash!=='string'||!/^[a-f0-9]{64}$/.test(expectedHash))return false;
 const digest=crypto.createHash('sha256').update(token).digest();
 return crypto.timingSafeEqual(digest,Buffer.from(expectedHash,'hex'));
}
module.exports={validateDeviceLogin,validateCommandEnvelope,validateDeviceReport,verifyBearerToken};
