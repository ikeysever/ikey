'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createAtomicCommandService}=require('../lib/atomic-command-service');
const actor_user_id='11111111-1111-4111-8111-111111111111',project_id='22222222-2222-4222-8222-222222222222',device_id='ABCDEFGH';
const token='a'.repeat(48);
function fixture({admin=true,bound=true}={}){
 let time=1000;let seq=0;
 const db={commands:[],events:[]};
 const transaction=async fn=>{const snapshot=structuredClone(db);try{return await fn(db);}catch(e){Object.assign(db,snapshot);throw e;}};
 const service=createAtomicCommandService({transaction,clock:()=>time,randomId:()=>('00000000-0000-4000-8000-'+String(++seq).padStart(12,'0')),hashToken:x=>crypto.createHash('sha256').update(x).digest('hex'),verifyProjectAdmin:async()=>admin,verifyBinding:async()=>bound});
 const args={actor_user_id,project_id,device_id,action:'unlock',idempotency_key:'test-request-0001',timeout_ms:15000};
 return {service,db,args,tick:n=>time+=n};
}
test('create, claim, report and duplicate report',async()=>{
 const {service,db,args}=fixture();
 const first=await service.create(args);assert.equal(first.duplicate,false);
 assert.equal((await service.create(args)).duplicate,true);
 const claimed=await service.claim({project_id,device_id,claim_token:token});assert.equal(claimed.command_id,first.command.command_id);
 assert.equal(await service.claim({project_id,device_id,claim_token:token}),null);
 const result={project_id,device_id,command_id:claimed.command_id,claim_token:token,status:'succeeded',feedback_observed:true};
 assert.equal((await service.report(result)).duplicate,false);
 assert.equal((await service.report(result)).duplicate,true);
 assert.equal(db.events.length,3);
 assert.equal((await service.get({actor_user_id,project_id,device_id,command_id:claimed.command_id})).claim_token_hash,undefined);
});
test('conflicting idempotency key rejected',async()=>{
 const {service,args}=fixture();await service.create(args);
 await assert.rejects(service.create({...args,timeout_ms:20000}),/IDEMPOTENCY_CONFLICT/);
});
test('authorization and binding fail closed',async()=>{
 for(const options of [{admin:false},{bound:false}]){
  const {service,args,db}=fixture(options);
  await assert.rejects(service.create(args));
  assert.equal(db.commands.length,0);
 }
});
test('wrong claim token and contradictory terminal report rejected',async()=>{
 const {service,args}=fixture();const c=(await service.create(args)).command;
 await service.claim({project_id,device_id,claim_token:token});
 const input={project_id,device_id,command_id:c.command_id,claim_token:token,status:'failed',feedback_observed:false};
 await assert.rejects(service.report({...input,claim_token:'b'.repeat(48)}),/INVALID_CLAIM/);
 await service.report(input);
 await assert.rejects(service.report({...input,status:'succeeded',feedback_observed:true}),/INVALID_TRANSITION/);
});
test('expiry prevents late claim and report',async()=>{
 const {service,args,tick}=fixture();const c=(await service.create({...args,timeout_ms:1000})).command;
 tick(1000);assert.equal(await service.claim({project_id,device_id,claim_token:token}),null);
 const other=await service.create({...args,idempotency_key:'test-request-0002'});
 await service.claim({project_id,device_id,claim_token:token});
 tick(15001);
 await assert.rejects(service.report({project_id,device_id,command_id:other.command.command_id,claim_token:token,status:'succeeded',feedback_observed:true}),/INVALID_TRANSITION/);
 assert.equal((await service.get({actor_user_id,project_id,device_id,command_id:c.command_id})).status,'timed_out');
});
test('no positive feedback cannot be reported as success',async()=>{
 const {service,args}=fixture();const c=(await service.create(args)).command;await service.claim({project_id,device_id,claim_token:token});
 await assert.rejects(service.report({project_id,device_id,command_id:c.command_id,claim_token:token,status:'succeeded',feedback_observed:false}),/INVALID_RESULT/);
});
