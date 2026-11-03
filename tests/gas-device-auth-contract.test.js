'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('staging/gas/ikey-device-auth-find-by-id.candidate.gs','utf8');
const headers=['device_id','password_hash','status','created_by_user_id','created_at','updated_at'];
const hash='scrypt:v1:'+('A'.repeat(22))+':'+('B'.repeat(86));
function run(payload,rows,header=headers){
  const calls=[];
  const sheet={
    getLastColumn:()=>header.length,
    getLastRow:()=>rows.length+1,
    getRange:(r,c,n,w)=>({getDisplayValues:()=>{calls.push({r,c,n,w});return r===1?[header]:rows;}})
  };
  const context={PropertiesService:{getScriptProperties:()=>({getProperty:k=>k==='GEN3_SPREADSHEET_ID'?'mock-sheet':null})},
    SpreadsheetApp:{openById:id=>{assert.equal(id,'mock-sheet');return {getSheetByName:name=>{assert.equal(name,'Devices');return sheet;}}}}};
  vm.createContext(context);
  vm.runInContext(source,context,{timeout:1000});
  return {value:context.ikeyDeviceAuthFindByIdCandidate_(payload),calls};
}
const id='ABCDEFGH';
const row=[id,hash,'pre_registered','mock-user','2026-01-01','2026-01-01'];
test('returns one strict preregistered record',()=>{
 const {value}=run({device_id:id},[row]);
 assert.equal(value.device_id,id);assert.equal(value.password_hash,hash);assert.equal(value.status,'pre_registered');
});
test('unknown device returns null',()=>assert.equal(run({device_id:id},[]).value,null));
test('non-preregistered device fails closed',()=>assert.equal(run({device_id:id},[[id,hash,'revoked','mock-user','','']]).value,null));
test('invalid hash fails closed',()=>assert.equal(run({device_id:id},[[id,'plaintext','pre_registered','mock-user','','']]).value,null));
test('duplicate IDs fail closed',()=>assert.throws(()=>run({device_id:id},[row,row]),/DEVICE_AUTH_DUPLICATE_DEVICE_ID/));
test('schema mismatch fails closed',()=>assert.throws(()=>run({device_id:id},[row],headers.slice(0,5)),/DEVICE_AUTH_SCHEMA_MISMATCH/));
test('extra payload fields are denied',()=>assert.throws(()=>run({device_id:id,admin:true},[row]),/DEVICE_AUTH_INVALID_REQUEST/));
test('invalid ID is denied',()=>assert.throws(()=>run({device_id:'INVALID!'},[row]),/DEVICE_AUTH_INVALID_REQUEST/));
test('candidate has no write or deploy operations',()=>{
 const codeOnly=source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,'');
 assert.doesNotMatch(codeOnly,/\b(?:setValues?|appendRow|deleteRows?|insertRows?|clearContent|doPost|UrlFetchApp|ScriptApp)\s*\(/);
});
