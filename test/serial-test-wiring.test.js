'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const router=fs.readFileSync(path.join(root,'lib/serial-test-router.js'),'utf8');
const adapter=fs.readFileSync(path.join(root,'lib/supabase-data-adapter.js'),'utf8');
const ui=fs.readFileSync(path.join(root,'public/quick-unlock.js'),'utf8');
const firmware=fs.readFileSync(path.join(root,'firmware/ikey-serial-test/ikey-serial-test.ino'),'utf8');
test('server mounts device authentication and serial test routes',()=>{
 assert.match(server,/const requireDevice=require\('\.\/device-auth'\)\(app,authStore\)/);
 assert.match(server,/require\('\.\/lib\/serial-test-router'\)/);
});
test('serial test requires user/device authentication and explicit opt in',()=>{
 assert.match(router,/IKEY_SERIAL_TEST_ENABLED/);
 assert.match(router,/IKEY_STORAGE_BACKEND==='supabase'/);
 assert.match(router,/requireProjectUser/);
 assert.match(router,/requireDevice/);
 assert.match(router,/sameProjectOrigin\(req\)/);
 assert.match(router,/Project_Devices/);
 assert.match(router,/SERIAL_PRINTED/);
});
test('Supabase adapter allowlists test table and RPC',()=>{
 assert.match(adapter,/Device_Test_Commands:'device_test_commands'/);
 assert.match(adapter,/ikey_serial_test_claim/);
 assert.match(adapter,/ikey_serial_test_complete/);
});
test('UI waits for reported completion',()=>{
 assert.match(ui,/api\/serial-test\/commands/);
 assert.match(ui,/state.status==='completed'/);
});
test('firmware never actuates physical lock',()=>{
 assert.match(firmware,/TEST_UNLOCK_SUCCESS/);
 assert.doesNotMatch(firmware,/digitalWrite\s*\(|analogWrite\s*\(|ledcWrite\s*\(/);
});
