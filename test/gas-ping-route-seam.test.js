'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../gas-staging/ikey-ping-route-seam.gs'),'utf8');
test('staging ping route seam leaves existing GAS actions untouched',()=>{
 let called=0;
 const context={
  ikeyPingAuthorization_:()=>({}),
  ikeyPingDispatchAuthorized_:(action,payload)=>{called++;return {action,payload}}
 };
 vm.createContext(context);vm.runInContext(source,context);
 for(const action of ['health','db.select','factoryDeviceList','projectCreate','adminAccountList','deviceCommandGet','unknown']){
  assert.equal(context.ikeyPingTryDispatch_(action,{}).handled,false);
 }
 assert.equal(called,0);
 for(const action of ['devicePingCreate','devicePingClaim','devicePingReport','devicePingStatus']){
  const result=context.ikeyPingTryDispatch_(action,{project_id:'test'});
  assert.equal(result.handled,true);
  assert.equal(result.result.action,action);
 }
 assert.equal(called,4);
});
