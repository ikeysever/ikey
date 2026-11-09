'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {makeAnnouncementMutator}=require('./announcement-mutation-adapter');
const args={actor:{user_id:'admin'},operation:'create',announcementId:'notice_1',operationId:'op_1234567890123456',payload:{title:'A'}};
test('missing secure dependencies fail closed',()=>assert.throws(()=>makeAnnouncementMutator({}),/NOT_CONFIGURED/));
test('unauthorized actor never reaches writer',async()=>{
 let called=false;const mutate=makeAnnouncementMutator({authorize:async()=>false,writeJournaled:async()=>{called=true}});
 await assert.rejects(mutate(args),/FORBIDDEN/);assert.equal(called,false);
});
test('invalid operation never reaches authorization',async()=>{
 let called=false;const mutate=makeAnnouncementMutator({authorize:async()=>{called=true;return true},writeJournaled:async()=>({committed:true,revision:1})});
 await assert.rejects(mutate({...args,operation:'db.insert'}),/OPERATION_DENIED/);assert.equal(called,false);
});
test('missing idempotency operation ID rejected',async()=>{
 const mutate=makeAnnouncementMutator({authorize:async()=>true,writeJournaled:async()=>({committed:true,revision:1})});
 await assert.rejects(mutate({...args,operationId:''}),/OPERATION_ID_REQUIRED/);
});
test('unverified commit fails closed',async()=>{
 const mutate=makeAnnouncementMutator({authorize:async()=>true,writeJournaled:async()=>({inserted:true})});
 await assert.rejects(mutate(args),/COMMIT_UNVERIFIED/);
});
test('authorized create returns only verified commit',async()=>{
 const mutate=makeAnnouncementMutator({authorize:async()=>true,writeJournaled:async()=>({committed:true,revision:3})});
 assert.deepEqual(await mutate(args),{committed:true,revision:3,operationId:args.operationId});
});
test('update and delete require same verified writer',async()=>{
 const operations=[];const mutate=makeAnnouncementMutator({authorize:async()=>true,writeJournaled:async req=>{operations.push(req.operation);return {committed:true,revision:operations.length}}});
 await mutate({...args,operation:'update'});await mutate({...args,operation:'delete'});
 assert.deepEqual(operations,['update','delete']);
});
