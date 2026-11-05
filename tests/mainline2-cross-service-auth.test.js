'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {createDeviceCommandGateway}=require('../lib/device-command-gateway');
const {createCommandAuthorization}=require('../lib/device-command-authorization');
const project='123e4567-e89b-42d3-a456-426614174000';
const user='123e4567-e89b-42d3-a456-426614174001';
const device='ABCDEFGH';
function fixture({admin=true,bound=true,registered=true}={}){
 let calls=0;
 const rows={Projects:[{project_id:project,status:'active',created_by_user_id:'other'}],
 Project_Access:admin?[{project_id:project,user_id:user,role:'admin',status:'active'}]:[],
 Devices:[{device_id:device,status:registered?'pre_registered':'disabled'}],
 Project_Devices:bound?[{project_id:project,device_id:device}]:[]};
 const auth=createCommandAuthorization({dbCall:async(_,{table,where})=>({
 rows:(rows[table]||[]).filter(r=>Object.keys(where).every(k=>r[k]===where[k]))})});
 const gateway=createDeviceCommandGateway({call:async()=>{calls++;return {command:{command_id:'id',status:'pending'}};},
 verifyActor:auth.verifyActor,verifyDeviceBinding:auth.verifyDeviceBinding});
 return {gateway,calls:()=>calls};
}
async function create(f){return f.gateway.create({actor:{user_id:user,status:'active'},project_id:project,device_id:device,idempotency_key:'sample-key-123'});}
test('authorized admin and bound device reaches GAS call',async()=>{const f=fixture();await create(f);assert.equal(f.calls(),1);});
for(const [name,opts] of [['non-admin',{admin:false}],['unbound',{bound:false}],['unregistered',{registered:false}]]){
 test(name+' cannot reach GAS',async()=>{const f=fixture(opts);await assert.rejects(create(f));assert.equal(f.calls(),0);});
}
test('unverified device cannot claim or report',async()=>{
 const f=fixture();
 await assert.rejects(f.gateway.claim({device:{authenticated:false,device_id:device},project_id:project}));
 await assert.rejects(f.gateway.report({device:{authenticated:false,device_id:device},project_id:project}));
 assert.equal(f.calls(),0);
});
test('command probe uses sandbox transport only',()=>{
 const s=fs.readFileSync('gen3-auth/sheets-store.js','utf8');
 const probe=s.split('commandProbe:async(payload)=>')[1].split('// Dedicated command transport.')[0];
 assert.ok(probe.includes('sandboxCommandTarget()'));
 assert.ok(probe.includes("sandboxCommandCall('deviceCommandGet'"));
 assert.ok(!probe.includes("return call('deviceCommandGet'"));
});
