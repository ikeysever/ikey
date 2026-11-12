'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createProjectListHandler}=require('../lib/project-list-handler');
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const a='33333333-3333-4333-8333-333333333333',b='44444444-4444-4444-8444-444444444444';
async function invoke(rows,options={}){
 const calls=[];
 const store={async dbCall(action,payload){calls.push({action,payload});if(options.throws)throw Error('offline');return {rows,limited:options.limited};}};
 const res={code:200,headers:{},set(k,v){this.headers[k]=v;return this;},status(n){this.code=n;return this;},json(value){this.body=value;return this;}};
 await createProjectListHandler(store)({projectUser:{user_id:options.user||owner}},res);
 return {res,calls};
}
test('returns only owned active projects and hides deleted ones',async()=>{
 const {res,calls}=await invoke([{project_id:a,created_by_user_id:owner,status:'active'},{project_id:b,created_by_user_id:owner,status:'deleted'}]);
 assert.equal(res.code,200);assert.deepEqual(res.body.projects,[{project_id:a,created_by_user_id:owner,status:'active',feature_modules:[]}]);
 assert.equal(res.headers['Cache-Control'],'no-store');
 assert.deepEqual(calls[0],{action:'db.select',payload:{table:'Projects',where:{created_by_user_id:owner},limit:100}});
});
test('rejects mixed-owner and malformed rows instead of leaking data',async()=>{
 for(const rows of [[{project_id:a,created_by_user_id:other,status:'active'}],[{project_id:'invalid',created_by_user_id:owner,status:'active'}],[{project_id:a,created_by_user_id:owner},{project_id:a,created_by_user_id:owner}]]){
  const {res}=await invoke(rows);assert.equal(res.code,503);assert.equal(res.body.code,'PROJECT_LIST_UNVERIFIED');
 }
});
test('truncated or malformed storage fails closed',async()=>{
 for(const opts of [{rows:null},{rows:[],limited:true},{rows:[],throws:true}]){
  const {res}=await invoke(opts.rows,opts);assert.equal(res.code,503);
 }
});
test('invalid authenticated actor never reaches storage',async()=>{
 const {res,calls}=await invoke([],{user:'bad'});assert.equal(res.code,403);assert.equal(calls.length,0);
});

test('persisted feature modules are decoded and invalid storage is rejected',async()=>{
 const good=await invoke([{project_id:a,created_by_user_id:owner,status:'active',feature_modules:'["reservations","audit_log"]'}]);
 assert.deepEqual(good.res.body.projects[0].feature_modules,['reservations','audit_log']);
 for(const raw of ['invalid','["unknown"]','["reservations","reservations"]']){
  const bad=await invoke([{project_id:a,created_by_user_id:owner,status:'active',feature_modules:raw}]);
  assert.equal(bad.res.code,503);assert.equal(bad.res.body.code,'PROJECT_MODULES_UNVERIFIED');
 }
});
