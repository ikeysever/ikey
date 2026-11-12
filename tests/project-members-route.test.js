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
async function invoke({id=projectId,user=ownerId,rows=[{project_id:projectId,created_by_user_id:ownerId,status:'active'}],limited=false,throws=false,memberRows=null}={}){
 const calls=[];
 const store={async dbCall(action,payload){calls.push({action,payload});if(throws)throw Error('offline');if(action==='db.schema'){if(memberRows===null)throw Error('not configured');return {columns:['membership_id','project_id','user_id','role','status','created_at']};}if(payload.table==='Project_Memberships')return {rows:memberRows};return {rows,limited};}};
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
 for(const opts of [{limited:true},{rows:null},{throws:true}]){
  const {res}=await invoke(opts);assert.equal(res.code,503);
 }
});

test('malformed creator identity cannot enumerate members',async()=>{
 const {res}=await invoke({rows:[{project_id:projectId,created_by_user_id:'bad',status:'active'}]});
 assert.equal(res.code,403);assert.equal(res.body.code,'NOT_PROJECT_OWNER');
});

test('ambiguous duplicate project rows fail closed',async()=>{
 const row={project_id:projectId,created_by_user_id:ownerId,status:'active'};
 const {res}=await invoke({rows:[row,{...row}]});
 assert.equal(res.code,503);assert.equal(res.body.code,'MEMBERSHIP_UNVERIFIED');
});

test('verified membership storage returns complete owner and member list',async()=>{
 const member={membership_id:'44444444-4444-4444-8444-444444444444',project_id:projectId,user_id:stranger,role:'member',status:'active',created_at:'2026-11-12T00:00:00Z'};
 const {res}=await invoke({memberRows:[member]});
 assert.equal(res.code,200);
 assert.equal(res.body.membership_inventory_complete,true);
 assert.deepEqual(res.body.members.map(x=>x.user_id),[ownerId,stranger]);
});
test('duplicate or cross-project memberships fail closed',async()=>{
 const member={membership_id:'44444444-4444-4444-8444-444444444444',project_id:projectId,user_id:stranger,role:'member',status:'active',created_at:'2026-11-12T00:00:00Z'};
 for(const memberRows of [[member,member],[{...member,project_id:'55555555-5555-4555-8555-555555555555'}]]){
  const {res}=await invoke({memberRows});
  assert.equal(res.code,503);
 }
});
