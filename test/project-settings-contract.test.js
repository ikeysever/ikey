'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('six immediate navigation cards lead to empty placeholders; no obsolete settings form is loaded',()=>{
 const html=read('public/project.html');
 for(const name of ['basic','auth','notify','devices','members','advanced']){
  assert.ok(html.includes('data-pc-open="'+name+'"'),name);
  assert.ok(html.includes('data-pc-pane="'+name+'"'),name);
 }
 assert.doesNotMatch(html,/data-pc-settings=|project-settings-edit\.js/);
});
test('verified project fetch updates placeholders without blocking immediate navigation',()=>{
 const js=read('public/project.js');
 for(const token of ["credentials:'same-origin'","cache:'no-store'","ikey:project-loaded","projectReady='true'"])assert.ok(js.includes(token),token);
 assert.ok(js.indexOf('if(!response.ok')<js.indexOf("projectReady='true'"));
 assert.doesNotMatch(js,/method:'PATCH'/);
});
test('obsolete project settings mutation endpoint is absent',()=>{
 const server=read('server.js');
 assert.ok(!server.includes("app.patch('/api/projects/:projectId/settings'"));
});
test('settings form submits a validated PATCH',()=>{
 const js=read('public/project-settings-edit.js');
 for(const token of ["addEventListener('submit'","method:'PATCH'","reportValidity()","notification_volume"])assert.ok(js.includes(token),token);
});
