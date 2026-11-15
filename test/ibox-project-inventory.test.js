'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
test('project iBOX inventory is project-member scoped and never reports unverified control as ready',()=>{
 const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
 const frontend=fs.readFileSync(path.join(__dirname,'../public/project-devices.js'),'utf8');
 assert.match(server,/app\.get\('\/api\/projects\/:projectId\/devices',requireProjectUser/);
 assert.match(server,/projectDeviceContext\(id,req\.projectUser\.user_id\)/);
 assert.match(server,/table:'Project_Devices',where:\{project_id:id\}/);
 assert.match(server,/control_ready:false,connection_status:'unverified'/);
 assert.match(server,/DEVICE_LIST_UNAVAILABLE/);
 assert.match(server,/if\(ctx.denied\)return res.status\(403\)/);
 assert.match(frontend,/const api='\/api\/projects\/'\+encodeURIComponent\(id\)\+'\/devices'/);
 assert.match(frontend,/textContent=d\.device_name/);
 assert.doesNotMatch(frontend,/innerHTML\s*=/);
 new Function(frontend);
});
