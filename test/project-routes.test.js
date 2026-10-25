'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const express=require('express');
const {createHash}=require('node:crypto');
const USER='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PROJECT='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
function build(){
 const calls=[];
 const store={
  resolveSession:async hash=>hash==='demo'?{
   session:{revoked_at:'',expires_at:new Date(Date.now()+3600000).toISOString()},
   user:{user_id:USER,account_status:'active'}
  }:null,
  projectCall:async(action,payload)=>{
   calls.push({action,payload});
   if(action==='projectAccessMine')return {projects:[{project_id:PROJECT,project_name:'Shared project',project_role:'member'}]};
   if(action==='projectAccessGet')return {project_id:PROJECT,project_name:'Shared project',project_role:'member'};
   if(action==='projectAccessConfigure')return {configured:true};
   if(action==='projectAccessJoin')return {joined:true,project_id:PROJECT,project_name:'Shared project',status:'pending'};
   if(action==='projectAccessList')return {join_policy:'approval',members:[]};
   if(action==='projectAccessReview')return {reviewed:true,status:'active'};
   throw Error('UNKNOWN_TEST_ACTION');
  },
  dbCall:async()=>({rows:[]})
 };
 const source=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
 const testRequire=name=>{
  if(name==='./gen3-auth/sheets-store')return {createSheetsStore:()=>store};
  if(name==='./gen3-auth/routes')return {createRouter:()=>express.Router()};
  if(name==='./gen3-auth/core')return {hashToken:x=>x,active:u=>u.account_status==='active'};
  return require(name);
 };
 const mod={exports:{}};const wrapped=vm.runInThisContext('(function(exports, require, module, __filename, __dirname){'+source+'\n})',{filename:'server.js'});
 wrapped(mod.exports,testRequire,mod,path.join(__dirname,'../server.js'),path.join(__dirname,'..'));
 return {app:mod.exports,calls};
}
test('authenticated project APIs validate roles, origins and invite-code secrecy',async t=>{
 const {app,calls}=build();
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base='http://127.0.0.1:'+server.address().port;
 const fetchApi=(url,options={})=>fetch(base+url,{...options,headers:{Cookie:'ikey_gen3_session=demo',Origin:base,'Content-Type':'application/json',...options.headers}});
 await t.test('not logged in is unauthorized',async()=>{
  const r=await fetchApi('/api/projects',{headers:{Cookie:''}});
  assert.equal(r.status,401);
 });
 await t.test('member projects appear in scoped list',async()=>{
  const r=await fetchApi('/api/projects');assert.equal(r.status,200);
  assert.equal((await r.json()).projects[0].project_role,'member');
 });
 await t.test('member can fetch project detail',async()=>{
  const r=await fetchApi('/api/projects/'+PROJECT);
  assert.equal(r.status,200);assert.equal((await r.json()).project.project_role,'member');
 });
 await t.test('invalid invite rejected',async()=>{
  const r=await fetchApi('/api/projects/join',{method:'POST',body:JSON.stringify({invite_code:'short'})});
  assert.equal(r.status,400);
 });
 await t.test('valid invitation is hashed and reported as pending',async()=>{
  const code='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0,24);
  const r=await fetchApi('/api/projects/join',{method:'POST',body:JSON.stringify({invite_code:code})});
  assert.equal(r.status,202);
  const call=calls.find(c=>c.action==='projectAccessJoin');
  assert.equal(call.payload.invite_hash,createHash('sha256').update(code).digest('hex'));
  assert.equal(call.payload.actor_user_id,USER);
  assert.equal(JSON.stringify(call).includes(code),false);
 });
 await t.test('cross-origin rotation is blocked',async()=>{
  const r=await fetchApi('/api/projects/'+PROJECT+'/invite',{method:'POST',headers:{Origin:'https://wrong.example'},body:JSON.stringify({join_policy:'approval'})});
  assert.equal(r.status,403);
 });
 await t.test('new invite is random and only hash enters the storage call',async()=>{
  const r=await fetchApi('/api/projects/'+PROJECT+'/invite',{method:'POST',body:JSON.stringify({join_policy:'direct'})});
  assert.equal(r.status,200);
  const data=await r.json();
  assert.match(data.invite_code,/^[A-Za-z0-9_-]{24}$/);
  assert.equal(calls.at(-1).payload.invite_hash,createHash('sha256').update(data.invite_code).digest('hex'));
 });
 await t.test('review requires an approved decision',async()=>{
  const entry='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const bad=await fetchApi('/api/projects/'+PROJECT+'/access/'+entry+'/review',{method:'POST',body:JSON.stringify({decision:'make_admin'})});
  assert.equal(bad.status,400);
  const valid=await fetchApi('/api/projects/'+PROJECT+'/access/'+entry+'/review',{method:'POST',body:JSON.stringify({decision:'approve'})});
  assert.equal(valid.status,200);
  assert.equal(calls.at(-1).payload.actor_user_id,USER);
 });
});
