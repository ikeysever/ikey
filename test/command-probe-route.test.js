'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../server.js'),'utf8');
test('command probe has authenticated POST route',()=>{
 assert.ok(source.includes("app.post('/api/admin/command-probe',requireProjectUser,async"));
 assert.ok(source.includes("process.env.IKEY_COMMAND_PROBE_ENABLED!=='true'"));
 assert.ok(source.includes("req.projectUser.global_role!=='super_admin'"));
 assert.ok(source.includes('actor_user_id:req.projectUser.user_id,command_id:randomUUID()'));
});
