'use strict';
// Actual overlapping asynchronous requests against a shared transactional adapter.
// This verifies the portable state-machine contract, NOT Apps Script multi-process locking.
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {createAtomicCommandService}=require('../lib/atomic-command-service');
const actor_user_id='11111111-1111-4111-8111-111111111111';
const project_id='22222222-2222-4222-8222-222222222222';
const device_id='ikey_unit-01';
function fixture(){
 const db={commands:[],events:[]};let seq=0,entered=0,active=0,maxActive=0;
 let queue=Promise.resolve();
 const transaction=fn=>{
  const run=async()=>{
   entered++;active++;maxActive=Math.max(maxActive,active);
   // Force each request to yield while holding the same shared transaction lock.
   await new Promise(resolve=>setImmediate(resolve));
   const before=structuredClone(db);
   try{return await fn(db);}catch(e){db.commands=before.commands;db.events=before.events;throw e;}
   finally{active--;}
  };
  const result=queue.then(run);
  queue=result.catch(()=>{});
  return result;
 };
 const service=createAtomicCommandService({transaction,clock:()=>1000,
  randomId:()=> '00000000-0000-4000-8000-'+String(++seq).padStart(12,'0'),
  hashToken:x=>crypto.createHash('sha256').update(x).digest('hex'),
  verifyProjectAdmin:async()=>true,verifyBinding:async()=>true});
 const args={actor_user_id,project_id,device_id,action:'unlock',timeout_ms:15000,idempotency_key:'request-0001'};
 return {service,args,db,stats:()=>({entered,maxActive})};
}
test('64 overlapping create requests with same idempotency key produce one command',async()=>{
 const f=fixture();
 const results=await Promise.all(Array.from({length:64},()=>f.service.create(f.args)));
 assert.equal(results.filter(x=>!x.duplicate).length,1);
 assert.equal(f.db.commands.length,1);
 assert.equal(f.db.events.filter(x=>x.type==='created').length,1);
 assert.equal(f.stats().entered,64);
 assert.equal(f.stats().maxActive,1);
});
test('64 overlapping claims produce exactly one winner',async()=>{
 const f=fixture();await f.service.create(f.args);
 const results=await Promise.all(Array.from({length:64},(_,i)=>f.service.claim({
  project_id,device_id,claim_token:crypto.createHash('sha256').update(String(i)).digest('hex')
 })));
 assert.equal(results.filter(Boolean).length,1);
 assert.equal(f.db.commands[0].status,'claimed');
 assert.equal(f.db.events.filter(x=>x.type==='claimed').length,1);
 assert.equal(f.stats().maxActive,1);
});
test('64 overlapping reports with same proof yield one transition and idempotent retries',async()=>{
 const f=fixture();const created=await f.service.create(f.args);
 const claim_token='b'.repeat(64);
 await f.service.claim({project_id,device_id,claim_token});
 const reports=await Promise.all(Array.from({length:64},()=>f.service.report({
  project_id,device_id,command_id:created.command.command_id,claim_token,
  status:'succeeded',feedback_observed:true
 })));
 assert.equal(reports.filter(x=>!x.duplicate).length,1);
 assert.equal(f.db.events.filter(x=>x.type==='reported').length,1);
 assert.equal(f.stats().maxActive,1);
});
