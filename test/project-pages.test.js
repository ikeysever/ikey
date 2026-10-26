'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'../public',file),'utf8');
test('project overview and settings retain expected DOM hooks',()=>{
 const html=read('project.html');
 for(const id of ['project-role','project-authorization-action','project-device-grid','project-settings','project-name','project-description','project-id','project-invite-form','project-admin-settings','project-members-list','project-devices-link','project-other-link','project-edit-form'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.ok(html.indexOf('id="project-settings"')<html.indexOf('id="project-name"'));
 assert.ok(html.indexOf('id="project-settings"')<html.indexOf('id="project-invite-form"'));
});
test('device management provides search, factory credential entry, dialog and group controls',()=>{
 const html=read('project-devices.html');
 for(const id of ['device-search','add-device','group-create','group-remove','device-grid','add-dialog','factory-device-id','factory-device-password','settings-dialog','device-name','device-lock-mode','device-heartbeat','device-auto-update'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/type="password"/);
 assert.match(html,/disabled>連線測試/);
 const js=read('project-devices.js');new Function(js);
 assert.match(js,/project_role!=='admin'/);
 assert.doesNotMatch(js,/localStorage|sessionStorage/);
});
test('other settings reflect server values and persist through secured API',()=>{
 const html=read('project-other-settings.html');
 for(const name of ['status','authorization_method','scheduled_authorization'])assert.ok(html.includes('name="'+name+'"'),name);
 assert.match(html,/id="save-settings"/);
 const js=read('project-other-settings.js');new Function(js);
 assert.match(js,/project_role!=='admin'/);
 assert.match(js,/method:'PATCH'/);
});
