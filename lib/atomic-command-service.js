'use strict';
// Portable command state machine for isolated GAS/Sheets adapter tests.
// No HTTP route, no physical actuation. Adapter must provide a SHARED durable
// transactional lock and read/write implementation; no process-local locks.
function createAtomicCommandService({transaction,clock=Date.now,randomId,hashToken,verifyProjectAdmin,verifyBinding}={}){
 if([transaction,randomId,hashToken,verifyProjectAdmin,verifyBinding].some(x=>typeof x!=='function'))throw Error('COMMAND_SERVICE_DEPENDENCIES_REQUIRED');
 const terminal=new Set(['succeeded','failed','timed_out']);
 const fail=code=>{const e=new Error(code);e.code=code;throw e;};
 const validId=x=>typeof x==='string'&&/^[0-9a-f-]{36}$/i.test(x);
 const deviceId=x=>typeof x==='string'&&/^[A-HJ-NP-Z2-9]{8}$/.test(x);
 const copy=x=>structuredClone(x);
 function expiry(db,now){
  for(const c of db.commands)if(!terminal.has(c.status)&&now>=c.deadline_at){
   c.status='timed_out';c.finished_at=now;db.events.push({event_id:randomId(),command_id:c.command_id,type:'timed_out',at:now});
  }
 }
 async function checkedBinding(project_id,device_id){
  if(!validId(project_id)||!deviceId(device_id)||!await verifyBinding(project_id,device_id))fail('DEVICE_BINDING_REQUIRED');
 }
 return Object.freeze({
  async create(p){
   if(!p||!validId(p.actor_user_id)||!validId(p.project_id)||!deviceId(p.device_id)||p.action!=='unlock'||!/^[A-Za-z0-9._:-]{8,128}$/.test(p.idempotency_key||'')||!Number.isSafeInteger(p.timeout_ms)||p.timeout_ms<1000||p.timeout_ms>60000)fail('INVALID_REQUEST');
   if(!await verifyProjectAdmin(p.actor_user_id,p.project_id))fail('PROJECT_ADMIN_REQUIRED');
   await checkedBinding(p.project_id,p.device_id);
   return transaction(db=>{
    const now=clock();expiry(db,now);
    const fingerprint=JSON.stringify([p.project_id,p.device_id,p.actor_user_id,p.action,p.timeout_ms]);
    const old=db.commands.find(c=>c.device_id===p.device_id&&c.actor_user_id===p.actor_user_id&&c.idempotency_key===p.idempotency_key);
    if(old){if(old.fingerprint!==fingerprint)fail('IDEMPOTENCY_CONFLICT');return {duplicate:true,command:copy(old)};}
    const c={command_id:randomId(),project_id:p.project_id,device_id:p.device_id,actor_user_id:p.actor_user_id,action:'unlock',idempotency_key:p.idempotency_key,fingerprint,status:'pending',created_at:now,deadline_at:now+p.timeout_ms,claimed_at:null,finished_at:null,claim_token_hash:null,result:null};
    db.commands.push(c);db.events.push({event_id:randomId(),command_id:c.command_id,type:'created',at:now});
    return {duplicate:false,command:copy(c)};
   });
  },
  async claim({project_id,device_id,claim_token}){
   await checkedBinding(project_id,device_id);
   // token must be generated outside this module by a CSPRNG and delivered
   // only to the authenticated device; never expose its hash in admin views.
   if(typeof claim_token!=='string'||claim_token.length<32)fail('INVALID_CLAIM_TOKEN');
   return transaction(db=>{
    const now=clock();expiry(db,now);
    const c=db.commands.find(x=>x.project_id===project_id&&x.device_id===device_id&&x.status==='pending');
    if(!c)return null;
    c.status='claimed';c.claimed_at=now;c.claim_token_hash=hashToken(claim_token);
    db.events.push({event_id:randomId(),command_id:c.command_id,type:'claimed',at:now});
    const safe=copy(c);delete safe.claim_token_hash;delete safe.idempotency_key;delete safe.fingerprint;
    return safe;
   });
  },
  async report({project_id,device_id,command_id,claim_token,status,feedback_observed}){
   await checkedBinding(project_id,device_id);
   if(!validId(command_id)||typeof claim_token!=='string'||claim_token.length<32||!['succeeded','failed'].includes(status)||typeof feedback_observed!=='boolean'||(status==='succeeded'&&!feedback_observed))fail('INVALID_RESULT');
   return transaction(db=>{
    const now=clock();expiry(db,now);
    const c=db.commands.find(x=>x.command_id===command_id&&x.device_id===device_id&&x.project_id===project_id);
    if(!c)fail('NOT_FOUND');
    if(!c.claim_token_hash||hashToken(claim_token)!==c.claim_token_hash)fail('INVALID_CLAIM');
    if(c.status===status&&c.result?.feedback_observed===feedback_observed)return {duplicate:true,status:c.status};
    if(c.status!=='claimed')fail('INVALID_TRANSITION');
    c.status=status;c.finished_at=now;c.result={status,feedback_observed,reported_at:now};
    db.events.push({event_id:randomId(),command_id:c.command_id,type:'reported',at:now});
    return {duplicate:false,status:c.status};
   });
  },
  async get({actor_user_id,project_id,device_id,command_id}){
   if(!await verifyProjectAdmin(actor_user_id,project_id))fail('PROJECT_ADMIN_REQUIRED');
   await checkedBinding(project_id,device_id);
   return transaction(db=>{
    expiry(db,clock());
    const c=db.commands.find(x=>x.command_id===command_id&&x.project_id===project_id&&x.device_id===device_id);
    if(!c)return null;
    const safe=copy(c);delete safe.claim_token_hash;delete safe.idempotency_key;delete safe.fingerprint;
    return safe;
   });
  }
 });
}
module.exports={createAtomicCommandService};
