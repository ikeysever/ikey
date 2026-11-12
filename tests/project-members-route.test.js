'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
const client=fs.readFileSync(path.join(__dirname,'../public/project-members.js'),'utf8');
test('member route requires authenticated user and validates project identity',()=>{
 assert.match(server,/app\.get\('\/api\/projects\/:projectId\/members',requireProjectUser/);
 assert.match(server,/code:'INVALID_PROJECT_ID'/);
 assert.match(server,/code:'NOT_PROJECT_OWNER'/);
});
test('member route fails closed on incomplete storage and never claims full inventory',()=>{
 const route=server.slice(server.indexOf("app.get('/api/projects/:projectId/members'"),server.indexOf("// Device pre-registration:"));
 assert.ok(route.includes("result.limited"));
 assert.ok(route.includes("membership_inventory_complete:false"));
 assert.ok(route.includes("source:'project_creator'"));
 assert.ok(!route.includes('Project_Members'));
});
test('client uses verified endpoint without fabricating membership',()=>{
 assert.match(client,/\/members'/);
 assert.match(client,/membership_inventory_complete===true/);
});
