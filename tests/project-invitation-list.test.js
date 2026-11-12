'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createInvitationListHandler}=require('../lib/project-invitation-list-handler');
const owner='11111111-1111-4111-8111-111111111111',projectId='22222222-2222-4222-8222-222222222222',invitationId='33333333-3333-4333-8333-333333333333';
const columns=['invitation_id','project_id','created_by_user_id','token_hash','role','expires_at','status','created_at','redeemed_by_user_id','membership_id'];
const invitation={invitation_id:invitationId,project_id:projectId,created_by_user_id:owner,token_hash:'a'.repeat(64),role:'member',expires_at:'2026-11-13T00:00:00Z',status:'pending',created_at:'2026-11-12T00:00:00Z'};
async function invoke({actor=owner,rows=[invitation],projectRows=[{project_id:projectId,created_by_user_id:owner,status:'active'}],limited=false,schema=columns}={}){
 const calls=[];
 const store={async dbCall(action,payload){calls.push({action,payload});if(action==='db.schema')return {columns:schema};if(payload.table==='Projects')return {rows:projectRows};return {rows,limited};}};
 const res={code:200,headers:{},set(k,v){this.headers[k]=v;return this;},status(n){this.code=n;return this;},json(value){this.body=value;return this;}};
 await createInvitationListHandler(store)({params:{projectId},projectUser:{user_id:actor}},res);
 return {res,calls};
}
test('owner lists invitation metadata without token hashes',async()=>{
 const {res,calls}=await invoke();
 assert.equal(res.code,200);assert.equal(res.headers['Cache-Control'],'no-store');
 assert.deepEqual(res.body.invitations,[{invitation_id:invitationId,role:'member',status:'pending',created_at:invitation.created_at,expires_at:invitation.expires_at}]);
 assert.equal(JSON.stringify(res.body).includes(invitation.token_hash),false);
 assert.equal(calls.at(-1).payload.where.project_id,projectId);
});
test('non-owner cannot enumerate invitations',async()=>{
 const {res,calls}=await invoke({actor:'44444444-4444-4444-8444-444444444444'});
 assert.equal(res.code,403);assert.equal(calls.length,1);
});
test('invalid schema, truncated rows, mixed project or duplicate records fail closed',async()=>{
 for(const opts of [{schema:['invitation_id']},{limited:true},{rows:[{...invitation,project_id:'55555555-5555-4555-8555-555555555555'}]},{rows:[invitation,invitation]},{rows:[{...invitation,token_hash:'invalid'}]}]){
  const {res}=await invoke(opts);assert.equal(res.code,503);assert.equal(res.body.invitations,undefined);
 }
});

test('full 100-row page cannot be reported as complete invitation inventory',async()=>{
 const rows=Array.from({length:100},(_,i)=>({...invitation,invitation_id:'33333333-3333-4333-8333-'+String(i).padStart(12,'0')}));
 const {res}=await invoke({rows});
 assert.equal(res.code,503);
 assert.equal(res.body.code,'INVITATION_LIST_UNVERIFIED');
});
test('reservation and redeemed states require verified actor and membership IDs',async()=>{
 const actor='44444444-4444-4444-8444-444444444444';
 const membership='55555555-5555-4555-8555-555555555555';
 for(const row of [
  {...invitation,status:'redeeming'},
  {...invitation,status:'redeemed',redeemed_by_user_id:actor},
  {...invitation,status:'pending',membership_id:membership},
  {...invitation,status:'revoked',redeemed_by_user_id:actor,membership_id:membership},
  {...invitation,status:'redeeming',redeemed_by_user_id:'bad',membership_id:membership}
 ]){
  const {res}=await invoke({rows:[row]});
  assert.equal(res.code,503);
  assert.equal(res.body.code,'INVITATION_STATE_UNVERIFIED');
 }
 const {res}=await invoke({rows:[{...invitation,status:'redeemed',redeemed_by_user_id:actor,membership_id:membership}]});
 assert.equal(res.code,200);
 assert.equal(JSON.stringify(res.body).includes(actor),false);
 assert.equal(JSON.stringify(res.body).includes(membership),false);
});
