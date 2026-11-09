'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('six cards and three settings forms exist',()=>{
 const html=read('public/project.html');
 for(const name of ['basic','auth','notify','devices','members','advanced'])assert.ok(html.includes('data-pc-open="'+name+'"'),name);
 for(const name of ['basic','auth','notify'])assert.ok(html.includes('data-pc-settings="'+name+'"'),name);
 assert.ok(html.includes('project-settings-edit.js'));
});
test('preload keeps cards disabled until verified fetch',()=>{
 const js=read('public/project.js');
 for(const token of ["credentials:'same-origin'","cache:'no-store'","button.disabled=true","ikey:project-loaded","preloaded.hidden=true"])assert.ok(js.includes(token),token);
});
test('PATCH endpoint verifies ownership and persisted changes',()=>{
 const server=read('server.js');
 const start=server.indexOf("app.patch('/api/projects/:projectId/settings'");
 const end=server.indexOf("app.delete('/api/projects/:projectId'",start);
 assert.ok(start>=0&&end>start);
 const route=server.slice(start,end);
 for(const token of ['requireProjectUser','sameProjectOrigin','created_by_user_id!==req.projectUser.user_id','keys.some(k=>!allowed.includes(k))','db.update','尚未確認設定已儲存'])assert.ok(route.includes(token),token);
 assert.ok(!/unlock|relay|servo/i.test(route));
});
test('settings form submits a validated PATCH',()=>{
 const js=read('public/project-settings-edit.js');
 for(const token of ["addEventListener('submit'","method:'PATCH'","reportValidity()","notification_volume"])assert.ok(js.includes(token),token);
});
