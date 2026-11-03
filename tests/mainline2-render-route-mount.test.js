'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const server=fs.readFileSync('server.js','utf8');
const device=fs.readFileSync('device-auth.js','utf8');
test('device auth routes mounted after GAS store and before 404 fallback',()=>{
 const mount=server.indexOf("require('./device-auth')(app, authStore)");
 assert.ok(mount>server.indexOf("app.use('/api/auth', createRouter(authStore))"));
 assert.ok(mount<server.indexOf("app.use('/api', (_req, res) => res.status(404)"));
});
test('login and me routes are present and require server-side token secret',()=>{
 assert.match(device,/app\.post\('\/api\/device\/auth'/);
 assert.match(device,/app\.get\('\/api\/device\/me'/);
 assert.match(device,/IKEY_DEVICE_TOKEN_SECRET/);
 assert.match(device,/DEVICE_AUTH_NOT_CONFIGURED/);
 assert.match(device,/DEVICE_AUTH_UNAVAILABLE/);
});
test('no physical unlock enabled by mounting auth routes',()=>{
 assert.doesNotMatch(device,/IKEY_PHYSICAL_UNLOCK_ENABLED\s*=\s*['"]true/);
 assert.match(server,/COMMAND_BACKEND_NOT_READY/);
});
