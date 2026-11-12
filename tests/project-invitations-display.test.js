'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../public/project.html'),'utf8');
const js=fs.readFileSync(path.join(__dirname,'../public/project-invitations.js'),'utf8');
test('project settings mount invitation history UI',()=>{
 for(const id of ['pc-invitation-status','pc-invitation-list'])assert.ok(html.includes('id="'+id+'"'));
 assert.match(html,/src="\/project-invitations\.js\?/);
 new Function(js);
});
test('invitation UI never renders or requests raw token or token hash',()=>{
 assert.doesNotMatch(js,/invitation_token|token_hash|localStorage|sessionStorage/);
 assert.match(js,/credentials:'same-origin',cache:'no-store'/);
 assert.match(js,/data\.project_id!==id/);
});
