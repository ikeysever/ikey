'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {createAtomicCommandService}=require('../lib/atomic-command-service');
const actor_user_id='11111111-1111-4111-8111-111111111111';
const project_id='22222222-2222-4222-8222-222222222222';
function setup(){let n=0;const db={commands:[],events:[]};const service=createAtomicCommandService({transaction:async fn=>fn(db),randomId:()=>`00000000-0000-4000-8000-${String(++n).padStart(12,'0')}`,hashToken:x=>crypto.createHash('sha256').update(x).digest('hex'),verifyProjectAdmin:async()=>true,verifyBinding:async()=>true});return {db,service};}
for(const device_id of ['ABCDEF','ABCDEFGH','ikey_unit-01','a'.repeat(64)]){
 test(`GAS-compatible device ID accepted: ${device_id.slice(0,20)}`,async()=>{const {service}=setup();const r=await service.create({actor_user_id,project_id,device_id,action:'unlock',idempotency_key:'id-test-0001',timeout_ms:15000});assert.equal(r.command.device_id,device_id);});
}
for(const device_id of ['abc','bad device','x'.repeat(65),'bad/route']){
 test(`invalid device ID rejected: ${device_id.slice(0,20)}`,async()=>{const {service}=setup();await assert.rejects(service.create({actor_user_id,project_id,device_id,action:'unlock',idempotency_key:'id-test-0001',timeout_ms:15000}),/INVALID_REQUEST/);});
}
