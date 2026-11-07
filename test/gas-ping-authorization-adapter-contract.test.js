'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const adapter=fs.readFileSync(path.join(__dirname,'../gas-staging/ikey-ping-authorization-adapter.gs'),'utf8');
const uuid='123e4567-e89b-42d3-a456-426614174000',device='Y8R69EXB';
function make({factoryStatus='active',owner=true,duplicates=false,boundProject=uuid}={}){
 const factory=[[device,'scrypt','salt','hash',factoryStatus,'actor','date','date']];
 const bindings=[['bind',boundProject,device,'device','mode',30,false,'actor','date','date']];
 if(duplicates)bindings.push([...bindings[0]]);
 const tabs={Factory_Devices:factory,Project_Devices:bindings};
 const ctx={
  IKEY_FACTORY_HEADERS:['device_id','credential_kdf','credential_salt','credential_hash','registration_status','registered_by','registered_at','updated_at'],
  IKEY_BIND_HEADERS:['binding_id','project_id','device_id','display_name','lock_mode','heartbeat_interval_minutes','auto_firmware_update','bound_by','bound_at','updated_at'],
  ikeyDeviceSheet_:name=>name,
  ikeyDeviceRows_:name=>tabs[name],
  ikeyVerifyDeviceActor_:(action,payload)=>action==='factoryDeviceList'&&payload.actor_user_id==='actor'&&owner
 };
 vm.createContext(ctx);vm.runInContext(adapter,ctx);return ctx;
}
test('staging ping adapter denies unregistered or inactive device',()=>{
 assert.equal(make({factoryStatus:'disabled'}).ikeyPingVerifiedDeviceBinding_(uuid,device),false);
 assert.equal(make().ikeyPingVerifiedDeviceBinding_(uuid,'INVALID'),false);
});
test('staging ping adapter denies mismatched or duplicate bindings',()=>{
 assert.equal(make({boundProject:'00000000-0000-4000-8000-000000000000'}).ikeyPingVerifiedDeviceBinding_(uuid,device),false);
 assert.equal(make({duplicates:true}).ikeyPingVerifiedDeviceBinding_(uuid,device),false);
});
test('staging ping adapter denies nonowner and allows only owner with valid binding',()=>{
 assert.equal(make({owner:false}).ikeyPingAuthorization_().verifyWebOwner('actor',uuid,device),false);
 assert.equal(make().ikeyPingAuthorization_().verifyWebOwner('actor',uuid,device),true);
 assert.equal(make().ikeyPingAuthorization_().verifyDeviceBinding(uuid,device),true);
});
