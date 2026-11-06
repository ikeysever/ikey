'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../firmware/esp32-ikey-ping-staging/esp32-ikey-ping-staging.ino'),'utf8');
test('ESP32 staging firmware uses verified HTTPS and never actuates',()=>{
 assert.match(source,/client\.setCACert\(ROOT_CA\)/);
 assert.doesNotMatch(source,/setInsecure\s*\(/);
 assert.match(source,/\/api\/bridge-demo\/device\/login/);
 assert.match(source,/\/api\/bridge-demo\/device\/commands/);
 assert.match(source,/\/api\/bridge-demo\/device\/report/);
 assert.match(source,/action!="ping"/);
 assert.match(source,/device!=Config::DEVICE_ID/);
 assert.match(source,/REPLACE_WITH_VERIFIED_ROOT_CA_CERTIFICATE_PEM/);
 assert.doesNotMatch(source,/digitalWrite\s*\(|ledcWrite\s*\(|gpio_set_level\s*\(/);
});
