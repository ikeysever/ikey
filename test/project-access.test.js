'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const UUIDS={
 owner:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 alice:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 bob:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
 project:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
};
function setup(){
 let count=0;
 const data={
  Projects:[],Project_Access:[],
  Gen3_Users:[...['owner','alice','bob'].map(name=>({user_id:UUIDS[name],display_name:name,account_status:'active'}))],
  Auth_Audit_Logs:[]
 };
 const headers={
  Projects:['project_id','project_name','description','created_by_user_id','authorization_method','scheduled_authorization','status','created_at','updated_at','notification_theme','notification_sound_pack','notification_volume'],
  Project_Access:['entry_id','project_id','entry_type','user_id','role','status','invite_hash','join_policy','created_at','updated_at','reviewed_by']
 };
 const globals={
  TABS:{users:'Gen3_Users',access:'Project_Access',audit:'Auth_Audit_Logs'},HEADERS:headers,
  rows:name=>(data[name]||[]).map((value,i)=>({index:i+2,value:{...value}})),
  sheet:name=>{if(!(name in data))throw Error('MISSING_SHEET');return true;},
  append:(name,value)=>data[name].push({...value}),
  overwrite:(name,index,value)=>{data[name][index-2]={...value};},
  locked:fn=>fn(),
  Utilities:{getUuid:()=> '00000000-0000-4000-8000-'+String(++count).padStart(12,'0')}
 };
 const context=vm.createContext(globals);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../gen3-auth/project-data.gs'),'utf8'),context);
 const call=(action,payload)=>{
  const f=action.startsWith('db.')?'executeProjectData':'executeProjectAccess';
  return vm.runInContext(f,context)(action,payload);
 };
 const project={project_id:UUIDS.project,project_name:'Test project',description:'',created_by_user_id:UUIDS.owner,authorization_method:'application',scheduled_authorization:'false',status:'active',created_at:'2026-10-25T00:00:00.000Z',updated_at:'2026-10-25T00:00:00.000Z',notification_theme:'midnight',notification_sound_pack:'pulse',notification_volume:'50'};
 return {call,data,project};
}
test('project access: approval, review, rotation and soft delete',()=>{
 const {call,data,project}=setup();
 assert.equal(call('db.insert',{table:'Projects',primary_key:'project_id',data:project}).inserted,true);
 assert.equal(call('db.select',{table:'Projects',where:{created_by_user_id:UUIDS.owner}}).rows.length,1);
 assert.throws(()=>call('db.select',{table:'Projects',where:{status:'active'}}),/DB_WHERE_REQUIRED/);
 assert.throws(()=>call('db.select',{table:'Gen3_Users',where:{user_id:UUIDS.owner}}),/DB_TABLE_NOT_ALLOWED/);
 assert.equal(call('projectAccessConfigure',{actor_user_id:UUIDS.owner,project_id:UUIDS.project,join_policy:'approval',invite_hash:'a'.repeat(64)}).configured,true);
 assert.throws(()=>call('projectAccessConfigure',{actor_user_id:UUIDS.alice,project_id:UUIDS.project,join_policy:'direct',invite_hash:'b'.repeat(64)}),/PROJECT_FORBIDDEN/);
 assert.equal(call('projectAccessJoin',{actor_user_id:UUIDS.alice,invite_hash:'a'.repeat(64)}).status,'pending');
 assert.equal(call('projectAccessGet',{actor_user_id:UUIDS.alice,project_id:UUIDS.project}),null);
 const members=call('projectAccessList',{actor_user_id:UUIDS.owner,project_id:UUIDS.project}).members;
 assert.equal(members[0].role,'admin');
 assert.equal(members[1].display_name,'alice');
 const entry=data.Project_Access.find(r=>r.entry_type==='member').entry_id;
 assert.throws(()=>call('projectAccessReview',{actor_user_id:UUIDS.bob,project_id:UUIDS.project,entry_id:entry,decision:'approve'}),/PROJECT_FORBIDDEN/);
 assert.equal(call('projectAccessReview',{actor_user_id:UUIDS.owner,project_id:UUIDS.project,entry_id:entry,decision:'approve'}).status,'active');
 assert.equal(call('projectAccessGet',{actor_user_id:UUIDS.alice,project_id:UUIDS.project}).project_role,'member');
 assert.equal(call('projectAccessConfigure',{actor_user_id:UUIDS.owner,project_id:UUIDS.project,join_policy:'direct',invite_hash:'b'.repeat(64)}).configured,true);
 assert.equal(call('projectAccessJoin',{actor_user_id:UUIDS.bob,invite_hash:'a'.repeat(64)}).joined,false);
 assert.equal(call('projectAccessJoin',{actor_user_id:UUIDS.bob,invite_hash:'b'.repeat(64)}).status,'active');
 assert.equal(call('projectAccessMine',{actor_user_id:UUIDS.bob}).projects.length,1);
 assert.equal(call('db.update',{table:'Projects',where:{project_id:UUIDS.project,created_by_user_id:UUIDS.owner,status:'active'},data:{status:'deleted',updated_at:'2026-10-25T01:00:00.000Z'}}).updated,true);
 assert.equal(call('projectAccessGet',{actor_user_id:UUIDS.alice,project_id:UUIDS.project}),null);
 assert.equal(call('projectAccessMine',{actor_user_id:UUIDS.bob}).projects.length,0);
});
test('project access: duplicates, denials and schema fail-closed',()=>{
 const {call,project}=setup();
 call('db.insert',{table:'Projects',primary_key:'project_id',data:project});
 assert.throws(()=>call('db.insert',{table:'Projects',primary_key:'project_id',data:project}),/DUPLICATE_PROJECT/);
 assert.throws(()=>call('db.delete',{table:'Projects'}),/DB_ACTION_NOT_ALLOWED|DB_TABLE_NOT_ALLOWED/);
 assert.equal(call('db.update',{table:'Projects',where:{project_id:UUIDS.project,created_by_user_id:UUIDS.alice},data:{project_name:'Hacked'}}).updated,false);
});
