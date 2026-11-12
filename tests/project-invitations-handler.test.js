'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createProjectInvitationHandler,sha256}=require('../lib/project-invitations-handler');
const projectId='11111111-1111-4111-8111-111111111111',owner='22222222-2222-4222-8222-222222222222',stranger='33333333-3333-4333-8333-333333333333',invitationId='44444444-4444-4444-8444-444444444444';
const columns=['invitation_id','project_id','created_by_user_id','token_hash','role','expires_at','status','created_at','redeemed_by_user_id','membership_id'];
async function invoke({actor=owner,rows=[{project_id:projectId,created_by_user_id:owner,status:'active'}],schema=columns,echo=true,role='member',limited=false}={}){
 const calls=[];
 const store={async dbCall(action,payload){calls.push({action,payload});if(action==='db.select')return {rows,limited};if(action==='db.schema')return {columns:schema};if(action==='db.insert')return {inserted:true,record:echo?payload.data:{invitation_id:invitationId}};}};
 const res={code:200,headers:{},set(k,v){this.headers[k]=v;return this;},status(n){this.code=n;return this;},json(data){this.body=data;return this;}};
 await createProjectInvitationHandler(store,{uuid:()=>invitationId,random:()=>Buffer.alloc(24,7),now:()=>new Date('2026-11-12T00:00:00Z')})({params:{projectId},projectUser:{user_id:actor},body:{role}},res);
 return {res,calls};
}
test('owner can issue hashed, expiring invitation without exposing token in storage',async()=>{
 const {res,calls}=await invoke();
 assert.equal(res.code,201);
 assert.equal(res.body.expires_at,'2026-11-13T00:00:00.000Z');
 assert.equal(res.headers['Cache-Control'],'no-store');
 const inserted=calls.find(c=>c.action==='db.insert').payload.data;
 assert.equal(inserted.token_hash,sha256(res.body.invitation_token));
 assert.ok(!JSON.stringify(inserted).includes(res.body.invitation_token));
 assert.equal(inserted.role,'member');
});
test('other users cannot issue invitations or access invite schema',async()=>{
 const {res,calls}=await invoke({actor:stranger});
 assert.equal(res.code,403);assert.equal(calls.some(c=>c.action==='db.schema'),false);
});
test('missing or ambiguous project and incomplete storage fail closed',async()=>{
 for(const opts of [{rows:[]},{rows:[{project_id:projectId,created_by_user_id:owner,status:'deleted'}]},{rows:[{},{}]},{limited:true}]){
  const {res,calls}=await invoke(opts);assert.ok([404,503].includes(res.code));assert.equal(calls.some(c=>c.action==='db.insert'),false);
 }
});
test('missing invitation schema and unverified write do not return tokens',async()=>{
 for(const opts of [{schema:['invitation_id']},{echo:false}]){
  const {res}=await invoke(opts);assert.equal(res.code,503);assert.equal(res.body.invitation_token,undefined);
 }
});
test('only member role may be issued',async()=>{
 const {res,calls}=await invoke({role:'admin'});assert.equal(res.code,400);assert.equal(calls.length,0);
});
