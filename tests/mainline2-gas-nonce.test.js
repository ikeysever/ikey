'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const adapter=fs.readFileSync('staging/gas/ikey-command-bound-sandbox-store.candidate.gs','utf8');
const source=fs.readFileSync('staging/gas/ikey-command-nonce-store.candidate.gs','utf8');
function harness({locked=true,configured=true,sheetExists=true}={}){
 const rows=[['nonce','expires_at','created_at']];
 let held=false;
 const sheet={
   getLastColumn:()=>3,getLastRow:()=>rows.length,
   getRange:(r,c,n,w)=>({getDisplayValues:()=>rows.slice(r-1,r-1+n).map(x=>x.slice(c-1,c-1+w))}),
   appendRow:row=>rows.push(row)
 };
 const context={
   Date,LockService:{getScriptLock:()=>({tryLock:()=>{if(!locked||held)return false;held=true;return true;},releaseLock:()=>{held=false;}})},
   PropertiesService:{getScriptProperties:()=>({getProperty:k=>k==='IKEY_SANDBOX_COMMAND_HTTP_ENABLED'?'true':configured?'sandbox-sheet':''})},
   SpreadsheetApp:{getActiveSpreadsheet:()=>({getId:()=> 'sandbox-sheet',getSheetByName:()=>sheetExists?sheet:null}),flush:()=>{}},
   ikeyCommandVerifyAssertionCandidate_:()=>({nonce:'a'.repeat(32),exp:Date.now()+30000})
 };
 vm.createContext(context);vm.runInContext(adapter,context);vm.runInContext(source,context);
 return {context,rows};
}
test('durably records nonce and rejects replay',()=>{
 const {context,rows}=harness();
 const claims={nonce:'a'.repeat(32),exp:Date.now()+30000};
 assert.equal(context.ikeyCommandReserveNonceCandidate_(claims),true);
 assert.equal(rows.length,2);
 assert.throws(()=>context.ikeyCommandReserveNonceCandidate_(claims),/COMMAND_NONCE_REPLAY/);
 assert.equal(rows.length,2);
});
test('fails closed when lock is unavailable',()=>{
 const {context,rows}=harness({locked:false});
 assert.throws(()=>context.ikeyCommandReserveNonceCandidate_({nonce:'a'.repeat(32),exp:Date.now()+30000}),/COMMAND_NONCE_LOCK_BUSY/);
 assert.equal(rows.length,1);
});
test('fails closed when store is unconfigured',()=>{
 const {context}=harness({configured:false});
 assert.throws(()=>context.ikeyCommandReserveNonceCandidate_({nonce:'a'.repeat(32),exp:Date.now()+30000}),/SANDBOX_SPREADSHEET_NOT_CONFIGURED/);
});
test('rejects expired nonce',()=>{
 const {context}=harness();
 assert.throws(()=>context.ikeyCommandReserveNonceCandidate_({nonce:'a'.repeat(32),exp:Date.now()-1}),/COMMAND_NONCE_INVALID/);
});
test('authorizes only after verification and nonce reservation',()=>{
 const {context,rows}=harness();
 context.ikeyCommandAuthorizeCandidate_('deviceCommandGet',{});
 assert.equal(rows.length,2);
 assert.throws(()=>context.ikeyCommandAuthorizeCandidate_('deviceCommandGet',{}),/COMMAND_NONCE_REPLAY/);
});
