'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {newCode,digestCode,ready}=require('../lib/line-code-binding');
const {MockLineBindingStore,TTL_MS}=require('../lib/line-binding-mock-store');
const secret='staging-only-not-a-secret-value-123456789';
const candidate=()=>digestCode(newCode(),secret);
test('mock adapter fits existing ready() interface; mock is not production persistence',()=>{
 assert.equal(ready(new MockLineBindingStore()),true);
});
test('validity is exactly five minutes, rejecting expiration boundary',async()=>{
 const s=new MockLineBindingStore(),digest=candidate();
 await s.createChallengeAtomic({userId:'u1',codeDigest:digest,now:1000});
 assert.equal((await s.consumeChallengeAtomic({eventId:'e1',lineUserId:'L1',codeDigest:digest,now:1000+TTL_MS})).status,'rejected');
 assert.equal(await s.getBindingByUser('u1'),null);
});
test('new challenge revokes former pending challenge',async()=>{
 const s=new MockLineBindingStore(),a=candidate(),b=candidate();
 await s.createChallengeAtomic({userId:'u1',codeDigest:a,now:1000});
 await s.createChallengeAtomic({userId:'u1',codeDigest:b,now:2000});
 assert.equal((await s.consumeChallengeAtomic({eventId:'old',lineUserId:'L1',codeDigest:a,now:3000})).status,'rejected');
 assert.equal((await s.consumeChallengeAtomic({eventId:'new',lineUserId:'L1',codeDigest:b,now:3000})).status,'bound');
});
test('same code or webhook can bind only once',async()=>{
 const s=new MockLineBindingStore(),digest=candidate();
 await s.createChallengeAtomic({userId:'u1',codeDigest:digest,now:1000});
 assert.equal((await s.consumeChallengeAtomic({eventId:'e1',lineUserId:'L1',codeDigest:digest,now:2000})).status,'bound');
 assert.equal((await s.consumeChallengeAtomic({eventId:'e1',lineUserId:'L1',codeDigest:digest,now:2000})).status,'duplicate');
 assert.equal((await s.consumeChallengeAtomic({eventId:'e2',lineUserId:'L2',codeDigest:digest,now:2000})).status,'rejected');
 assert.equal(s.bindings.size,1);
});
test('unique LINE identity and unique iKey identity under concurrent calls',async()=>{
 const s=new MockLineBindingStore(),d1=candidate(),d2=candidate();
 await s.createChallengeAtomic({userId:'u1',codeDigest:d1,now:1000});
 await s.createChallengeAtomic({userId:'u2',codeDigest:d2,now:1000});
 const r=await Promise.all([
  s.consumeChallengeAtomic({eventId:'a',lineUserId:'L1',codeDigest:d1,now:2000}),
  s.consumeChallengeAtomic({eventId:'b',lineUserId:'L1',codeDigest:d2,now:2000})
 ]);
 assert.equal(r.filter(x=>x.status==='bound').length,1);
 assert.equal(r.filter(x=>x.status==='conflict').length,1);
});
test('parallel attempts to consume same challenge yield one binding',async()=>{
 const s=new MockLineBindingStore(),digest=candidate();await s.createChallengeAtomic({userId:'u1',codeDigest:digest,now:1000});
 const result=await Promise.all(Array.from({length:20},(_,i)=>s.consumeChallengeAtomic({eventId:'evt-'+i,lineUserId:'line-'+i,codeDigest:digest,now:2000})));
 assert.equal(result.filter(x=>x.status==='bound').length,1);
 assert.equal(s.bindings.size,1);
});
test('inactive user, invalid webhook candidate and unknown codes are denied',async()=>{
 const s=new MockLineBindingStore(),digest=candidate();
 await assert.rejects(()=>s.createChallengeAtomic({userId:'u1',codeDigest:digest,active:false}));
 await s.createChallengeAtomic({userId:'u1',codeDigest:digest,now:1000});
 assert.equal((await s.consumeChallengeAtomic({eventId:'e1',lineUserId:'L1',codeDigest:digest,now:2000,active:false})).status,'rejected');
 await assert.rejects(()=>s.consumeChallengeAtomic({eventId:'',lineUserId:'L1',codeDigest:digest,now:2000}));
 assert.equal((await s.consumeChallengeAtomic({eventId:'e2',lineUserId:'L1',codeDigest:candidate(),now:2000})).status,'rejected');
});
test('binding transport is still disabled in production routes',async()=>{
 const fs=require('node:fs');const server=fs.readFileSync(require('node:path').join(__dirname,'../server.js'),'utf8');
 const ingress=fs.readFileSync(require('node:path').join(__dirname,'../lib/line-ingress.js'),'utf8');
 assert.match(server,/LINE_BINDING_DISABLED/);assert.match(ingress,/LINE_WEBHOOK_DISABLED/);
});
