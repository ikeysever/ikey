'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createProjectMembersHandler}=require('../lib/project-members-handler');
const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
const projectId='11111111-1111-4111-8111-111111111111';
const ownerId='22222222-2222-4222-8222-222222222222';
const stranger='33333333-3333-4333-8333-333333333333';
async function invoke({id=projectId,user=ownerId,rows=[{project_id:projectId,created_by_user_id:ownerId,status:'active'}],limited=false,throws=false}={}){
 const calls=[];
 const store={async dbCall(action,payload){calls.push({action,payload});if(throws)throw Error('offline');return {rows,limited};}};
 const res={code:200,headers:{},set(k,v){this.headers[k]=v;return this;},status(n){this.code=n;return this;},json(body){this.body=body;return this;}};
 await createProjectMembersHandler(store)({params:{projectId:id},projectUser:{user_id:user}},res);
 return {res,calls};
}
test('route requires authenticated user middleware',()=>{
 assert.ok(server.includes("app.get('/api/projects/:projectId/members',requireProjectUser,createProjectMembersHandler(authStore))"));
});
test('returns only verified creator, explicitly incomplete',async()=>{
 const {res,calls}=await invoke();
 assert.equal(res.code,200);
 assert.deepEqual(res.body.members,[{user_id:ownerId,role:'owner',source:'project_creator'}]);
 assert.equal(res.body.membership_inventory_complete,false);
 assert.equal(res.headers['Cache-Control'],'no-store');
 assert.deepEqual(calls[0],{action:'db.select',payload:{table:'Projects',where:{project_id:projectId},limit:1}});
});
test('invalid UUID is rejected before storage access',async()=>{
 const {res,calls}=await invoke({id:'../bad'});
 assert.equal(res.code,400);assert.equal(res.body.code,'INVALID_PROJECT_ID');assert.equal(calls.length,0);
});
test('non-owner cannot enumerate project members',async()=>{
 const {res}=await invoke({user:stranger});assert.equal(res.code,403);assert.equal(res.body.code,'NOT_PROJECT_OWNER');
});
test('missing and deleted projects return 404',async()=>{
 for(const rows of [[],[{project_id:projectId,created_by_user_id:ownerId,status:'deleted'}]]){
  const {res}=await invoke({rows});assert.equal(res.code,404);
 }
});
test('truncated, malformed, or unavailable storage fails closed',async()=>{
 for(const opts of [{limited:true},{rows:null},{throws:true},{rows:[{project_id:projectId,created_by_user_id:'bad',status:'active'}]}]){
  const {res}=await invoke(opts);assert.equal(res.code,503);
 }
});
