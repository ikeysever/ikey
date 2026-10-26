'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('factory registration requires server-side super admin gate', () => {
 const source = read('server.js');
 assert.match(source, /app\.post\('\/api\/admin\/factory-devices',requireProjectUser,factoryRateLimit/);
 assert.match(source, /if\(!isFactorySuperAdmin\(req\.projectUser\)\)/);
 assert.match(source, /IKEY_SUPER_ADMIN_USER_IDS/);
 assert.match(source, /scryptSync\(b\.password,salt,64/);
 assert.doesNotMatch(source, /credential_hash:b\.password/);
});

test('binding verifies project admin, KDF and timing-safe comparison', () => {
 const source = read('server.js');
 assert.match(source, /project\.project_role!=='admin'/);
 assert.match(source, /factoryDeviceCredentialGet/);
 assert.match(source, /timingSafeEqual\(candidate,expected\)/);
 assert.match(source, /factoryDeviceBind/);
});

test('GAS device actions fail closed without trusted authorization', () => {
 const source = read('gen3-auth/gas-device-actions.gs');
 assert.match(source, /if\(typeof ikeyVerifyDeviceActor_!=='function'\)return false/);
 assert.match(source, /if\(!ikeyDeviceAuthorized_\(action,p\)\)throw Error\('DEVICE_AUTH_NOT_READY'\)/);
 assert.match(source, /LockService\.getScriptLock\(\)/);
 assert.match(source, /DEVICE_SCHEMA_MISMATCH/);
});

test('GAS adapter uses explicit device action allowlist', () => {
 const source = read('gen3-auth/sheets-store.js');
 for(const action of ['factoryDeviceRegister','factoryDeviceCredentialGet','factoryDeviceBind']){
  assert.ok(source.includes('"'+action+'"'), action + ' is not allowlisted');
 }
});

test('project device UI must not claim live device state without service', () => {
 const source = read('public/project-devices.js');
 assert.match(source, /裝置登錄與讀取 API 尚未啟用/);
});
