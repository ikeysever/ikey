'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
const sketch=fs.readFileSync(path.join(__dirname,'../firmware/esp32-ikey-ping-staging/esp32-ikey-ping-staging.ino'),'utf8');
test('GAS staging HTTP endpoints are gated and separate Web/device identity',()=>{
 assert.match(server,/IKEY_GAS_PING_ENABLED==='true'&&process\.env\.IKEY_BRIDGE_DEMO_ENABLED==='true'/);
 assert.match(server,/function requireGasPing/);
 assert.match(server,/requireGasPing,requireProjectUser,requireDemoProjectOwner,gasPingScope/);
 assert.match(server,/requireGasPing,requireDemoDevice,gasPingScope/);
 for(const op of ['create','claim','report','status'])
  assert.match(server,new RegExp("gasPingBridge\\.execute\\('"+op+"'"));
 assert.match(server,/validateDeviceReport\(req\.body\)/);
 assert.match(server,/req\.body\.result==='received'/);
 assert.match(server,/sameProjectOrigin\(req\)/);
});
test('ESP32 defaults to isolated demo, opts into GAS project route explicitly',()=>{
 assert.match(sketch,/const char\* PROJECT_ID = ""/);
 assert.match(sketch,/String commandRoute\(\)/);
 assert.match(sketch,/String reportRoute\(\)/);
 assert.match(sketch,/\/api\/bridge-staging\/projects\//);
 assert.match(sketch,/client\.setCACert\(ROOT_CA\)/);
 assert.doesNotMatch(sketch,/digitalWrite\s*\(/);
});
