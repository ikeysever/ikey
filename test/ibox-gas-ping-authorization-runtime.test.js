'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../gas-staging/ikey-ping-authorization-adapter.gs'),'utf8');
const PROJECT='123e4567-e89b-42d3-a456-426614174000',OTHER='123e4567-e89b-42d3-a456-426614174001',DEVICE='Y8R69EXB';
function setup(factory,bindings,admin=true){
 const ctx={
  IKEY_FACTORY_HEADERS:['device_id'],IKEY_BIND_HEADERS:['device_id'],
  ikeyDeviceSheet_:(name)=>name,
  ikeyDeviceRows_:(name)=>name==='Factory_Devices'?factory:bindings,
  ikeyVerifyDeviceActor_:()=>admin
 };
 vm.createContext(ctx);vm.runInContext(source,ctx);
 return ctx.ikeyPingAuthorization_();
}
test('requires active factory registration and exactly one project binding',()=>{
 const active=[[DEVICE,'','','','active']];
 const binding=[['binding',PROJECT,DEVICE]];
 assert.equal(setup(active,binding).verifyDeviceBinding(PROJECT,DEVICE),true);
 assert.equal(setup(active,binding).verifyDeviceBinding(OTHER,DEVICE),false);
 assert.equal(setup([[DEVICE,'','','','revoked']],binding).verifyDeviceBinding(PROJECT,DEVICE),false);
 assert.equal(setup(active,[]).verifyDeviceBinding(PROJECT,DEVICE),false);
 assert.equal(setup(active,[...binding,...binding]).verifyDeviceBinding(PROJECT,DEVICE),false);
 assert.equal(setup([...active,...active],binding).verifyDeviceBinding(PROJECT,DEVICE),false);
});
test('web actor must pass existing project-admin authorization',()=>{
 const active=[[DEVICE,'','','','active']],binding=[['binding',PROJECT,DEVICE]];
 assert.equal(setup(active,binding,false).verifyWebOwner('actor',PROJECT,DEVICE),false);
 assert.equal(setup(active,binding,true).verifyWebOwner('actor',PROJECT,DEVICE),true);
 assert.equal(setup(active,binding,true).verifyWebOwner('actor',OTHER,DEVICE),false);
});
