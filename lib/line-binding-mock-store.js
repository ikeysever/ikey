'use strict';
// Pure in-memory simulation for **tests only**; never use as live binding storage.
// Models the contract under an exclusive lock; production GAS needs durable
// idempotency, shared throttling, fault reconciliation and live session checks.
const {CODE_RE}=require('./line-code-binding');
const TTL_MS=300_000;
class MockLineBindingStore {
 constructor(){this.challenges=new Map();this.bindings=new Map();this.events=new Map();this.queue=Promise.resolve();this.sequence=0;}
 transact(fn){const work=this.queue.then(fn);this.queue=work.then(()=>{},()=>{});return work;}
 async createChallengeAtomic({userId,codeDigest,now=Date.now(),active=true}){
  return this.transact(()=>{
   if(!active||!userId||!(/^[a-f0-9]{64}$/.test(codeDigest)))throw Error('INVALID_CHALLENGE');
   for(const c of this.challenges.values())if(c.userId===userId&&c.status==='pending')c.status='revoked';
   const id=String(++this.sequence),challenge={id,userId,codeDigest,createdAt:now,expiresAt:now+TTL_MS,status:'pending',usedAt:null};
   this.challenges.set(id,challenge);return {...challenge};
  });
 }
 async consumeChallengeAtomic({eventId,lineUserId,codeDigest,now=Date.now(),active=true}){
  return this.transact(()=>{
   if(!eventId||!lineUserId||!(/^[a-f0-9]{64}$/.test(codeDigest)))throw Error('INVALID_WEBHOOK_CANDIDATE');
   if(this.events.has(eventId))return {status:'duplicate',original:this.events.get(eventId)};
   const c=[...this.challenges.values()].find(x=>x.codeDigest===codeDigest&&x.status==='pending');
   if(!c||now>=c.expiresAt||!active){this.events.set(eventId,'rejected');return {status:'rejected'};}
   if([...this.bindings.values()].some(b=>b.lineUserId===lineUserId)||this.bindings.has(c.userId)){
    this.events.set(eventId,'conflict');return {status:'conflict'};
   }
   c.status='consumed';c.usedAt=now;
   this.bindings.set(c.userId,{userId:c.userId,lineUserId,boundAt:now});
   this.events.set(eventId,'bound');
   return {status:'bound',userId:c.userId};
  });
 }
 async recordWebhookEventAtomic(eventId){return this.transact(()=>{if(!eventId)throw Error('INVALID_EVENT');if(this.events.has(eventId))return false;this.events.set(eventId,'recorded');return true;});}
 async getBindingByUser(userId){return this.bindings.get(userId)||null;}
 async unbindAtomic({userId}){return this.transact(()=>this.bindings.delete(userId));}
}
module.exports={MockLineBindingStore,TTL_MS};
