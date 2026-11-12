'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('restored project wizard has five steps and preserves notification previews',()=>{
 const html=read('public/project-create.html');
 const js=read('public/project-create.js');
 for(const id of ['create-project-form','create-step2','create-step3','create-step4','create-confirm','notify-themes','notify-sound-pack','notify-volume']){
  assert.match(html,new RegExp('id="'+id+'"'),id);
 }
 for(const marker of ['show(2)','show(3)','show(4)','show(5)','notification_theme','notification_sound_pack','notification_volume'])assert.ok(js.includes(marker),marker);
 assert.match(html,/project-notification\.js/);
});
test('wizard sends fields accepted by current server project-create API',()=>{
 const js=read('public/project-create.js');
 const server=read('server.js');
 for(const key of ['project_name','description','authorization_method','scheduled_authorization','notification_theme','notification_sound_pack','notification_volume']){
  assert.ok(js.includes(key),'wizard missing '+key);
  assert.ok(server.includes('req.body?.'+key),'server missing '+key);
 }
 assert.match(js,/method:'POST'/);
 assert.match(js,/credentials:'same-origin'/);
});
test('feature module selection is not falsely claimed persisted before backend schema exists',()=>{
 const html=read('public/project-create.html');
 assert.doesNotMatch(html,/功能模組已儲存/);
});

test('wizard validates notification choices and payload before submitting',()=>{
 const js=read('public/project-create.js');
 for(const fragment of ['themes.includes(payload.notification_theme)','packs.includes(payload.notification_sound_pack)','Number.isInteger(payload.notification_volume)','payload.notification_volume<0','payload.notification_volume>100','button.disabled=true']){
  assert.ok(js.includes(fragment),fragment);
 }
});
test('project management device panel links to existing inventory page',()=>{
 const js=read('public/project-readonly-panels.js');
 assert.ok(js.includes("/project-devices.html?id="));
 assert.ok(js.includes('encodeURIComponent(project.project_id)'));
});

test('project creation is fail-closed until auth/me verifies session',()=>{
 const js=read('public/project-create.js');
 assert.match(js,/let authVerified=false/);
 assert.match(js,/get\('create-content'\)\.hidden=true;show\(1\)/);
 assert.match(js,/if\(!authVerified\)/);
 assert.match(js,/authVerified=true;get\('create-loading'\)\.hidden=true;get\('create-content'\)\.hidden=false/);
});
