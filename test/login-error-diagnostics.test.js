'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const route = fs.readFileSync(require.resolve('../gen3-auth/routes.js'),'utf8');
test('login failures log allowlisted category instead of generic Error name',()=>{
  assert.match(route,/Gen3 login error",category/);
  assert.match(route,/SUPABASE_\[A-Z0-9_\]/);
  assert.doesNotMatch(route,/Gen3 login error",err\.code\|\|err\.name\|\|err\.message/);
});
test('login failures keep generic client response',()=>{
  assert.match(route,/status\(503\)\.json\(\{success:false,message:"登入服務暫時無法使用"\}\)/);
});
