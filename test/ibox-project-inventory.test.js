'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
test('project iBOX inventory is owner scoped and never reports unverified control as ready',()=>{
 const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
 const frontend=fs.readFileSync(path.join(__dirname,'../public/project-devices.js'),'utf8');
 assert.match(server,/app\.get\('\/api\/projects\/:projectId\/devices',requireProjectUser/);
 assert.match(server,/project\.created_by_user_id!==req\.projectUser\.user_id/);
 assert.match(server,/factoryDeviceCall\('factoryDeviceList'/);
 assert.match(server,/actor_user_id:req\.projectUser\.user_id,project_id:projectId/);
 assert.match(server,/connection_status:'unverified',control_ready:false/);
 assert.match(server,/DEVICE_INVENTORY_UNAVAILABLE/);
 assert.match(frontend,/fetch\('\/api\/projects\/'\+encodeURIComponent\(id\)\+'\/devices'/);
 assert.match(frontend,/textContent=device\.device_name/);
 assert.doesNotMatch(frontend,/innerHTML\s*=/);
 new Function(frontend);
});
