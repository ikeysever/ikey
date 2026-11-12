'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../public/projects.js'),'utf8');
test('projects shell renders before network authentication',()=>{
 assert.match(source,/panel\.hidden=false/);
 assert.match(source,/authPlaceholder\.hidden=true/);
 assert.ok(source.indexOf('panel.hidden=false')<source.indexOf("fetch('/api/auth/me'"));
 new Function(source);
});
test('cached project names cannot be displayed even after authentication',()=>{
 assert.match(source,/window\.iKeyProjectCache\?\.clear\(\)/);
 assert.doesNotMatch(source,/projects=snapshot\.filter\(complete\)/);
 assert.doesNotMatch(source,/projects=parsed\.filter\(complete\)/);
 assert.match(source,/projects=\(Array\.isArray\(data\.projects\)/);
});
