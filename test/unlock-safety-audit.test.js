'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { requestProjectUnlock } = require('../lib/project-unlock-action');

const PROJECT = 'project-1', DEVICE = 'ABCDEFGH', OWNER = 'owner-1';
function mockStore({project = {project_id:PROJECT,status:'active',created_by_user_id:OWNER},member, binding = {device_id:DEVICE}, device = {device_id:DEVICE,status:'pre_registered'}, schedules = [], failure = false} = {}) {
  const calls = [];
  const dbCall = async (action, params) => {
    calls.push({action,params});
    if (failure) throw Error('storage unavailable');
    assert.equal(action,'db.select','Unlock eligibility must be read-only');
    const records = {Projects:[project],Project_Access:member?[member]:[],Project_Devices:binding?[binding]:[],Devices:device?[device]:[],Project_Access_Requests:schedules};
    return {rows:(records[params.table]||[]).filter(Boolean),limited:false};
  };
  return {dbCall,calls};
}
function assertNoPhysicalExecution(result, store) {
  assert.equal(result.body.success,false);
  assert.equal(result.body.unlock_signal_sent,false);
  assert.equal(result.body.execution_verified,false);
  assert.ok(store.calls.every(c=>c.action==='db.select'));
}
test('owner: eligible but no physical command until execution backend is verified',async()=>{
  const store=mockStore();
  const result=await requestProjectUnlock(store,OWNER,PROJECT,DEVICE);
  assert.equal(result.status,503);
  assert.equal(result.body.code,'UNLOCK_EXECUTION_NOT_READY');
  assertNoPhysicalExecution(result,store);
});
test('missing project fails closed',async()=>{
  const store=mockStore({project:null});
  const result=await requestProjectUnlock(store,OWNER,PROJECT,DEVICE);
  assert.equal(result.status,404);
  assert.equal(result.body.code,'PROJECT_NOT_FOUND');
  assertNoPhysicalExecution(result,store);
});
test('nonmember denied',async()=>{
  const store=mockStore();
  const result=await requestProjectUnlock(store,'outsider',PROJECT,DEVICE);
  assert.equal(result.status,403);
  assert.equal(result.body.code,'NOT_MEMBER');
  assertNoPhysicalExecution(result,store);
});
test('member without approved active schedule denied',async()=>{
  const store=mockStore({member:{user_id:'member',role:'member'}});
  const result=await requestProjectUnlock(store,'member',PROJECT,DEVICE);
  assert.equal(result.status,403);
  assert.equal(result.body.code,'NO_ACTIVE_APPROVED_SCHEDULE');
  assertNoPhysicalExecution(result,store);
});
test('member with approved active schedule still cannot trigger physical action',async()=>{
  const now=Date.now();
  const store=mockStore({member:{user_id:'member',role:'member'},schedules:[{start_at:new Date(now-60000).toISOString(),end_at:new Date(now+60000).toISOString()}]});
  const result=await requestProjectUnlock(store,'member',PROJECT,DEVICE);
  assert.equal(result.body.code,'UNLOCK_EXECUTION_NOT_READY');
  assertNoPhysicalExecution(result,store);
});
test('missing device binding denied',async()=>{
  const store=mockStore({binding:null});
  const result=await requestProjectUnlock(store,OWNER,PROJECT,DEVICE);
  assert.equal(result.status,404);
  assert.equal(result.body.code,'DEVICE_UNAVAILABLE');
  assertNoPhysicalExecution(result,store);
});
test('storage failure fails closed',async()=>{
  const store=mockStore({failure:true});
  const result=await requestProjectUnlock(store,OWNER,PROJECT,DEVICE);
  assert.equal(result.status,503);
  assert.equal(result.body.code,'UNLOCK_LOOKUP_UNAVAILABLE');
  assertNoPhysicalExecution(result,store);
});
