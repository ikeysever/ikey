'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {newCode,digestCode,parseBindingMessage,ready,CODE_RE}=require('../lib/line-code-binding');
test('codes use a restricted alphabet and 8 random characters',()=>{
 for(let i=0;i<100;i++)assert.match(newCode(),CODE_RE);
});
test('code digest is keyed and deterministic',()=>{
 const code='IK-ABCD-2345',a='x'.repeat(32),b='y'.repeat(32);
 assert.equal(digestCode(code,a),digestCode(code,a));
 assert.notEqual(digestCode(code,a),digestCode(code,b));
 assert.throws(()=>digestCode(code,'short'));
});
test('only LINE user text messages with exact code are candidates',()=>{
 const event={type:'message',source:{type:'user',userId:'U123'},message:{type:'text',text:' IK-ABCD-2345 '},webhookEventId:'evt1'};
 assert.deepEqual(parseBindingMessage(event),{code:'IK-ABCD-2345',lineUserId:'U123',eventId:'evt1'});
 assert.equal(parseBindingMessage({...event,source:{type:'group',userId:'U123'}}),null);
 assert.equal(parseBindingMessage({...event,message:{type:'image'}}),null);
 assert.equal(parseBindingMessage({...event,message:{type:'text',text:'hello IK-ABCD-2345'}}),null);
});
test('binding never activates without durable atomic adapter',()=>{
 assert.equal(ready(null),false);
 assert.equal(ready({createChallengeAtomic(){}}),false);
});
