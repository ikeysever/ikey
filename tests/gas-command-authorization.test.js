'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=fs.readFileSync(require('node:path').join(__dirname,'../gas/device-command-authorization.gs'),'utf8');
function verify(tables,p){
 const context={PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'offline-test'})},
 SpreadsheetApp:{openById:()=>({getSheetByName:name=>{
 const rows=tables[name];if(!rows)return null;
 const headers=Object.keys(rows[0]||{});
 return {getLastRow:()=>rows.length+1,getLastColumn:()=>headers.length,
 getRange:(r,c,n)=>({getDisplayValues:()=>[headers],getValues:()=>rows.map(x=>headers.map(k=>x[k]))})};
 }})},ikeyCmdUuid_:x=>/^[0-9a-f-]{36}$/i.test(x)};
 vm.createContext(context);vm.runInContext(src,context);
 return {actor:context.ikeyVerifyDeviceActor_('factoryDeviceList',p),
 device:context.ikeyVerifyCommandDeviceContext_(p)};
}
test('GAS command authorization accepts project admin and registered device',()=>{
 const p={project_id:'22222222-2222-4222-8222-222222222222',actor_user_id:'11111111-1111-4111-8111-111111111111',device_id:'ABCDEFGH'};
 const tables={Projects:[{project_id:p.project_id,status:'active',created_by_user_id:'other'}],
 Project_Access:[{project_id:p.project_id,user_id:p.actor_user_id,role:'admin',status:'active'}],
 Devices:[{device_id:p.device_id,status:'pre_registered'}]};
 assert.deepEqual(verify(tables,p),{actor:true,device:true});
 tables.Project_Access[0].status='revoked';
 assert.equal(verify(tables,p).actor,false);
 tables.Devices[0].status='disabled';
 assert.equal(verify(tables,p).device,false);
});
