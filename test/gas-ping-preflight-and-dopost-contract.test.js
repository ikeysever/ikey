'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const seam=fs.readFileSync(path.join(__dirname,'../gas-staging/ikey-ping-route-seam.gs'),'utf8');
const preflight=fs.readFileSync(path.join(__dirname,'../gas-staging/ikey-ping-preflight.gs'),'utf8');
const headers={
 Factory_Devices:['device_id','credential_kdf','credential_salt','credential_hash','registration_status','registered_by','registered_at','updated_at'],
 Project_Devices:['binding_id','project_id','device_id','display_name','lock_mode','heartbeat_interval_minutes','auto_firmware_update','bound_by','bound_at','updated_at'],
 Device_Ping_Commands:['command_id','project_id','device_id','action','status','created_at','claimed_at','reported_at','result'],
 Device_Ping_Nonces:['nonce','expires_at']
};
function ctx({apiKey='a'.repeat(32),trustSecret='b'.repeat(32),tabs=headers}={}){
 const context={
  PropertiesService:{getScriptProperties:()=>({getProperty:(name)=>({
   GEN3_API_KEY:apiKey,GEN3_SPREADSHEET_ID:'staging-only-sheet',
   IKEY_COMMAND_TRUST_SECRET:trustSecret
  })[name]})},
  SpreadsheetApp:{openById:(id)=>{assert.equal(id,'staging-only-sheet');return {getSheetByName:(name)=>tabs[name]?{
   getLastColumn:()=>tabs[name].length,
   getRange:()=>({getDisplayValues:()=>[tabs[name]]})
  }:null}}},
  IKEY_FACTORY_HEADERS:headers.Factory_Devices,
  IKEY_BIND_HEADERS:headers.Project_Devices,
  IKEY_PING_COLUMNS_:headers.Device_Ping_Commands,
  ikeyVerifyDeviceActor_:()=>true,
  ikeyFactoryDeviceAction:()=>({legacy:true}),
  ikeyPingDispatchAuthorized_:(action,payload)=>({action,payload}),
  ikeyPingAuthorization_:()=>({}),
  Error
 };
 vm.createContext(context);
 vm.runInContext(seam+'\n'+preflight,context);
 return context;
}
test('GAS staging preflight passes only when all four sheets and security requirements exist',()=>{
 const c=ctx();const r=c.ikeyPingPreflight_();
 assert.equal(r.ready,true);
 assert.equal(r.api_key_configured,true);
 assert.equal(r.ping_route_seam,true);
 assert.equal(Object.keys(r.sheets).length,4);
});
test('GAS staging preflight rejects missing API key, trust secret, or schema',()=>{
 assert.equal(ctx({apiKey:''}).ikeyPingPreflight_().ready,false);
 assert.equal(ctx({trustSecret:'short'}).ikeyPingPreflight_().ready,false);
 assert.equal(ctx({tabs:{...headers,Device_Ping_Nonces:['wrong','expires_at']}}).ikeyPingPreflight_().ready,false);
 assert.equal(ctx({tabs:{...headers,Device_Ping_Commands:undefined}}).ikeyPingPreflight_().ready,false);
});
test('verified doPost shape: API key guard precedes ping routing and preserves legacy dispatch',()=>{
 const c=ctx();let legacy=0, ping=0;
 c.ikeyPingDispatchAuthorized_=(action,payload)=>{ping++;return {action,payload}};
 c.respond=(value)=>value;
 // The user-supplied doPost prefix and existing response contract are
 // reproduced here; the remainder is a deliberately isolated test adapter.
 // This is NOT a replacement for the live GAS doPost.
 vm.runInContext(`
 function doPost(e){
  try {
   const data=JSON.parse(e.postData?.contents||'{}');
   const secret=PropertiesService.getScriptProperties().getProperty('GEN3_API_KEY');
   if(!secret || secret.length<32 || data.api_key!==secret)
    return respond({ok:false,error:'UNAUTHORIZED'});
   const action=String(data.action||'');
   const payload=data.payload&&typeof data.payload==='object'&&!Array.isArray(data.payload)
     ?data.payload:{};
   const ping=ikeyPingTryDispatch_(action,payload);
   if(ping.handled)return respond({ok:true,result:ping.result});
   return respond({ok:true,result:{legacy_action:action}});
  }catch(err){return respond({ok:false,error:'TEST_ERROR'});}
 }
 `,c);
 function send(key,action,payload={}){return c.doPost({postData:{contents:JSON.stringify({api_key:key,action,payload})}})}
 assert.equal(send('wrong','devicePingCreate').error,'UNAUTHORIZED');
 assert.equal(ping,0);
 assert.equal(send('a'.repeat(32),'db.select').result.legacy_action,'db.select');
 assert.equal(ping,0);
 assert.equal(send('a'.repeat(32),'devicePingCreate',{project_id:'test'}).result.action,'devicePingCreate');
 assert.equal(ping,1);
});
