'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('project settings: all six cards and three editable forms exist',()=>{
 const html=read('public/project.html');
 for(const name of ['basic','auth','notify','devices','members','advanced'])assert.match(html,new RegExp('data-pc-open="'+name+'"'));
 for(const name of ['basic','auth','notify'])assert.match(html,new RegExp('data-pc-settings="'+name+'"'));
 assert.match(html,/project-settings-edit\\.js/);
});
test('project settings: preload waits for authenticated project fetch',()=>{
 const js=read('public/project.js');
 assert.match(js,/credentials:'same-origin',cache:'no-store'/);
 assert.match(js,/querySelectorAll\\('\[data-pc-open\]'\\)\\.forEach\\(button=>button\\.disabled=true\\)/);
 assert.match(js,/ikey:project-loaded/);
 assert.match(js,/preloaded\\.hidden=true/);
});
test('project settings: write endpoint has owner, allowlist and post-write verification',()=>{
 const server=read('server.js');
 const start=server.indexOf("app.patch('/api/projects/:projectId/settings'");
 const end=server.indexOf("app.delete('/api/projects/:projectId'",start);
 assert.ok(start>=0&&end>start);
 const route=server.slice(start,end);
 assert.match(route,/requireProjectUser/);
 assert.match(route,/sameProjectOrigin/);
 assert.match(route,/created_by_user_id!==req\\.projectUser\\.user_id/);
 assert.match(route,/keys\\.some\\(k=>!allowed\\.includes\\(k\\)\\)/);
 assert.match(route,/db\\.update/);
 assert.match(route,/尚未確認設定已儲存/);
 assert.doesNotMatch(route,/unlock|relay|servo/i);
});
test('project settings: frontend sends PATCH only on submit',()=>{
 const js=read('public/project-settings-edit.js');
 assert.match(js,/addEventListener\\('submit'/);
 assert.match(js,/method:'PATCH'/);
 assert.match(js,/reportValidity\\(\\)/);
 assert.match(js,/notification_volume/);
});
