'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../gen3-auth/Code.gs'),'utf8');

test('existing Devices table is only used with explicit opt-in',()=>{
 assert.match(source,/getProperty\("IKEY_DEVICE_AUTH_SOURCE"\)==="primary"/);
 assert.match(source,/primary\?"Devices":TABS\.deviceAuth/);
 assert.match(source,/primary\?PropertiesService\.getScriptProperties\(\)\.getProperty\("GEN3_SPREADSHEET_ID"\):deviceAuthStagingSpreadsheetId_\(\)/);
});
test('primary source blocks device provisioning writes',()=>{
 assert.match(source,/if\(PropertiesService\.getScriptProperties\(\)\.getProperty\("IKEY_DEVICE_AUTH_SOURCE"\)==="primary"\)throw Error\("DEVICE_AUTH_PRIMARY_CREATE_DISABLED"\)/);
});
test('primary and staging share the same six-column schema validation',()=>{
 assert.match(source,/const expected=HEADERS\[TABS\.deviceAuth\],actual=tab\.getRange\(1,1,1,expected\.length\)/);
 assert.match(source,/DEVICE_AUTH_SCHEMA_MISMATCH/);
});
