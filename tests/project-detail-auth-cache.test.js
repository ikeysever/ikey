'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../public/project.js'),'utf8');
test('project detail never reads or writes a cross-account project cache',()=>{
 assert.doesNotMatch(source,/iKeyProjectCache\?\.read\(/);
 assert.doesNotMatch(source,/iKeyProjectCache\?\.write\(/);
 assert.match(source,/fetch\('\/api\/projects',\{credentials:'same-origin',cache:'no-store'\}\)/);
 assert.match(source,/data\.projects\.find\(p=>p\.project_id===id\)/);
 new Function(source);
});
