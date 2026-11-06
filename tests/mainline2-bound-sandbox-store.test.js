'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const adapter=fs.readFileSync('staging/gas/ikey-command-bound-sandbox-store.candidate.gs','utf8');
const dispatch=fs.readFileSync('staging/gas/ikey-device-command-dispatch.candidate.gs','utf8');
const nonce=fs.readFileSync('staging/gas/ikey-command-nonce-store.candidate.gs','utf8');
const readiness=fs.readFileSync('staging/gas/ikey-command-staging-readiness.candidate.gs','utf8');
function harness(options={}){
 const calls={active:0,open:0};
 const sheets={
  DeviceCommands:{name:'DeviceCommands'},
  DeviceCommandNonces:{name:'DeviceCommandNonces'}
 };
 const book={getId:()=>options.actualId||'sandbox-id',getSheetByName:name=>sheets[name]||null};
 const props={
  IKEY_SANDBOX_COMMAND_HTTP_ENABLED:'true',
  IKEY_SANDBOX_SPREADSHEET_ID:'sandbox-id',
  ...options.props
 };
 const ctx={
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]})},
  SpreadsheetApp:{
   getActiveSpreadsheet:()=>{calls.active++;return options.noActive?null:book},
   openById:()=>{calls.open++;throw Error('OPEN_BY_ID_FORBIDDEN')}
  }
 };
 vm.createContext(ctx);vm.runInContext(adapter,ctx);
 return {ctx,calls,sheets};
}
test('command and nonce resolve to the same pinned bound spreadsheet',()=>{
 const {ctx,calls,sheets}=harness();
 assert.equal(ctx.ikeyBoundCommandSheetCandidate_(),sheets.DeviceCommands);
 assert.equal(ctx.ikeyBoundNonceSheetCandidate_(),sheets.DeviceCommandNonces);
 assert.equal(calls.open,0);
});
for(const [name,options,expected] of [
 ['disabled',{props:{IKEY_SANDBOX_COMMAND_HTTP_ENABLED:'false'}},'SANDBOX_COMMAND_DISABLED'],
 ['missing pinned ID',{props:{IKEY_SANDBOX_SPREADSHEET_ID:''}},'SANDBOX_SPREADSHEET_NOT_CONFIGURED'],
 ['wrong bound ID',{actualId:'production-id'},'SANDBOX_SPREADSHEET_BINDING_MISMATCH'],
 ['missing active spreadsheet',{noActive:true},'SANDBOX_SPREADSHEET_BINDING_MISMATCH']
]){
 test(name+' fails closed without openById',()=>{
  const {ctx,calls}=harness(options);
  assert.throws(()=>ctx.ikeyBoundCommandSheetCandidate_(),new RegExp(expected));
  assert.equal(calls.open,0);
 });
}
test('candidate modules never call openById or alternate spreadsheet IDs',()=>{
 for(const source of [adapter,dispatch,nonce,readiness]){
  assert.doesNotMatch(source,/SpreadsheetApp\.openById\s*\(/);
  assert.doesNotMatch(source,/IKEY_COMMAND_NONCE_SPREADSHEET_ID/);
  assert.doesNotMatch(source,/IKEY_COMMAND_SPREADSHEET_ID/);
 }
 assert.match(dispatch,/ikeyBoundCommandSheetCandidate_/);
 assert.match(nonce,/ikeyBoundNonceSheetCandidate_/);
});
