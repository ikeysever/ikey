'use strict';
// ISOLATED TEST PROTOTYPE. Local JSON file, single Node process only.
// Not safe for multi-instance Render, network filesystems or physical actuation.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
class CommandConflict extends Error { constructor(code){super(code);this.code=code;} }
class LocalCommandStore {
 constructor(file,{now=Date.now}={}) {
  if(!path.isAbsolute(file))throw Error('ABSOLUTE_PATH_REQUIRED');
  this.file=file;this.now=now;this.data={commands:[],events:[]};
  if(fs.existsSync(file)) {
   const parsed=JSON.parse(fs.readFileSync(file,'utf8'));
   if(!Array.isArray(parsed.commands)||!Array.isArray(parsed.events))throw Error('INVALID_STORE');
   this.data=parsed;
  }
 }
 persist(){
  fs.mkdirSync(path.dirname(this.file),{recursive:true});
  const temp=this.file+'.'+process.pid+'.'+crypto.randomBytes(6).toString('hex')+'.tmp';
  try{
   fs.writeFileSync(temp,JSON.stringify(this.data),{encoding:'utf8',flag:'wx',mode:0o600});
   fs.renameSync(temp,this.file);
  }finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
 }
 transact(fn){
  const snapshot=structuredClone(this.data);
  try{const result=fn();this.persist();return result;}
  catch(err){this.data=snapshot;throw err;}
 }
 event(c,type){this.data.events.push({event_id:crypto.randomUUID(),command_id:c.command_id,type,at:this.now()});}
 expire(){
  return this.transact(()=>{
   let count=0;
   for(const c of this.data.commands)if(!['succeeded','failed','timed_out'].includes(c.status)&&this.now()>=c.deadline_at){
    c.status='timed_out';c.finished_at=this.now();this.event(c,'timed_out');count++;
   }
   return count;
  });
 }
 create({device_id,project_id,requester_user_id,idempotency_key,action='unlock',timeout_ms=15000}){
  if(!/^[A-HJ-NP-Z2-9]{8}$/.test(device_id)||![project_id,requester_user_id].every(x=>/^[0-9a-f-]{36}$/i.test(x))||!/^[A-Za-z0-9._:-]{8,128}$/.test(idempotency_key)||action!=='unlock'||!Number.isInteger(timeout_ms)||timeout_ms<1000||timeout_ms>60000)throw new CommandConflict('INVALID_REQUEST');
  return this.transact(()=>{
   const fingerprint=JSON.stringify({device_id,project_id,requester_user_id,action,timeout_ms});
   const existing=this.data.commands.find(c=>c.device_id===device_id&&c.requester_user_id===requester_user_id&&c.idempotency_key===idempotency_key);
   if(existing){if(existing.fingerprint!==fingerprint)throw new CommandConflict('IDEMPOTENCY_CONFLICT');return {command:structuredClone(existing),duplicate:true};}
   const c={command_id:crypto.randomUUID(),device_id,project_id,requester_user_id,idempotency_key,fingerprint,action,status:'pending',created_at:this.now(),deadline_at:this.now()+timeout_ms,claimed_at:null,finished_at:null,claim_token_hash:null,result:null};
   this.data.commands.push(c);this.event(c,'created');return {command:structuredClone(c),duplicate:false};
  });
 }
 claim(device_id){
  return this.transact(()=>{
   const c=this.data.commands.find(x=>x.device_id===device_id&&x.status==='pending'&&this.now()<x.deadline_at);
   if(!c)return null;
   const claim_token=crypto.randomBytes(32).toString('base64url');
   c.claim_token_hash=crypto.createHash('sha256').update(claim_token).digest('hex');
   c.status='claimed';c.claimed_at=this.now();this.event(c,'claimed');
   return {command:structuredClone({...c,claim_token_hash:undefined}),claim_token};
  });
 }
 report({device_id,command_id,claim_token,status,feedback_observed=false}){
  if(!['succeeded','failed'].includes(status)||typeof claim_token!=='string'||typeof feedback_observed!=='boolean'||(status==='succeeded'&&!feedback_observed))throw new CommandConflict('INVALID_RESULT');
  return this.transact(()=>{
   const c=this.data.commands.find(x=>x.command_id===command_id&&x.device_id===device_id);
   if(!c)throw new CommandConflict('NOT_FOUND');
   const hash=crypto.createHash('sha256').update(claim_token).digest('hex');
   if(!c.claim_token_hash||!crypto.timingSafeEqual(Buffer.from(c.claim_token_hash,'hex'),Buffer.from(hash,'hex')))throw new CommandConflict('INVALID_CLAIM');
   if(c.status===status&&c.result?.feedback_observed===feedback_observed)return {duplicate:true,command:structuredClone(c)};
   if(c.status!=='claimed'||this.now()>=c.deadline_at)throw new CommandConflict('INVALID_TRANSITION');
   c.status=status;c.finished_at=this.now();c.result={status,feedback_observed,reported_at:this.now()};this.event(c,'reported');
   return {duplicate:false,command:structuredClone(c)};
  });
 }
 get(id){const c=this.data.commands.find(x=>x.command_id===id);return c?structuredClone(c):null;}
}
module.exports={LocalCommandStore,CommandConflict};
