'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
for(const name of ['project-devices.js','project-other-settings.js'])
 test(name+' uses authenticated project list API',()=>{
  const code=fs.readFileSync(path.join(__dirname,'../public',name),'utf8');
  assert.match(code,/(?:request|fetch)\('\/api\/projects'/);
  assert.match(code,/(?:data|project)\.projects/);
  new Function(code);
 });
test('project devices page reads project-scoped inventory, not a generic device list',()=>{
 const code=fs.readFileSync(path.join(__dirname,'../public/project-devices.js'),'utf8');
 assert.match(code,/const api='\/api\/projects\/'\+encodeURIComponent\(id\)\+'\/devices'/);
 assert.match(code,/await request\(api\)/);
 assert.doesNotMatch(code,/fetch\('\/api\/devices'/);
});
