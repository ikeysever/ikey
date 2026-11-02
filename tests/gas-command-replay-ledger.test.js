'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../gas/device-command-trust.gs'),'utf8');
test('GAS replay verifier requires durable ledger and rejects duplicate nonce',()=>{
 assert.match(src,/getSheetByName\('DeviceCommandNonces'\)/);
 assert.match(src,/COMMAND_REPLAY_STORAGE_UNAVAILABLE/);
 assert.match(src,/COMMAND_REPLAY_SCHEMA_MISMATCH/);
 assert.match(src,/values\.some\(r=>String\(r\[0\]\)===c\.nonce\)/);
 assert.match(src,/COMMAND_ASSERTION_REPLAY/);
 assert.match(src,/ledger\.appendRow\(\[c\.nonce,c\.exp\]\)/);
 assert.doesNotMatch(src,/CacheService\.getScriptCache\(\)/);
});
