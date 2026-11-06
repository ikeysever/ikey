'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../gas-staging/ikey-ping-command-actions.gs'),'utf8');
test('staged GAS ping queue uses lock and exact sheet schema',()=>{
 assert.match(source,/LockService\.getScriptLock\(\)/);
 assert.match(source,/tryLock\(15000\)/);
 assert.match(source,/finally\{lock\.releaseLock\(\)\}/);
 assert.match(source,/PING_SCHEMA_MISMATCH/);
 assert.match(source,/Device_Ping_Commands/);
 assert.match(source,/GEN3_SPREADSHEET_ID/);
});
test('staged GAS queue is ping-only and guards command scope',()=>{
 assert.match(source,/r\[1\]===p\.project_id&&r\[2\]===p\.device_id/);
 assert.match(source,/r\[3\]==='ping'&&r\[4\]==='pending'/);
 assert.match(source,/row\[4\]!=='delivered'/);
 assert.match(source,/\['completed','failed'\]\.includes\(p\.result\)/);
 assert.doesNotMatch(source,/unlock|relay|gpio|servo/i);
});
test('staged GAS action must not be presented as an authorized dispatcher',()=>{
 assert.match(source,/NOT deployed or connected to the live GAS dispatcher/);
 assert.match(source,/authorization boundary/);
});
