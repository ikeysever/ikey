'use strict';
// Shared deterministic domain, also loaded as GAS source. All calls must hold one
// script lock. Repository writes are flushed + read back; no ACID claim or retries.
var IKeyLineDomain = (() => {
 const VERSION='line-binding-v2';
 const B=['binding_id','user_id','line_user_id','line_display_name','status','bound_at','unbound_at','updated_at','challenge_id','code_digest','digest_version','challenge_status','challenge_created_at','challenge_expires_at','challenge_used_at','created_session_hash','operation_id'];
 const A=['audit_id','user_id','line_user_id','event_type','result','details','created_at','webhook_event_id','operation_id','processing_status','processed_at','line_subject_hash','blocked_until','notification_status'];
 const ms=s=>Date.parse(s),iso=n=>new Date(n).toISOString();
 function execute(repo,action,p,now){
  if(!Number.isFinite(now))throw Error('INVALID_TIME');
  repo.schema(B,A);
  if(action==='health')return {version:VERSION,storage:true};
  const bindings=repo.bindings(),logs=repo.logs();
  function actor(){const a=repo.actor(p.sessionHash);if(!a||!a.user||!a.session||a.session.revoked_at||!Number.isFinite(ms(a.session.expires_at))||ms(a.session.expires_at)<=now||a.user.account_status!=='active')throw Error('INVALID_SESSION');return a.user;}
  const own=['consume','webhookNotification'].includes(action)?null:actor();
  if(action==='admin'){
   if(!['admin','super_admin'].includes(own.global_role))throw Error('FORBIDDEN');
   return {bindings:bindings.filter(x=>x.status==='active').slice(-100).map(x=>({binding_id:x.binding_id,user_id:x.user_id,status:x.status,bound_at:x.bound_at})),audit:logs.slice(-100).map(x=>({event_type:x.event_type,result:x.result,processing_status:x.processing_status,created_at:x.created_at}))};
  }
  function fenced(uid,subject,digest){return logs.some(x=>x.processing_status==='processing'&&((uid&&x.user_id===uid)||(subject&&x.line_subject_hash===subject)||(digest&&x.details===digest)));}
  const current=uid=>bindings.filter(x=>x.user_id===uid&&x.status==='active');
  if(action==='status'){
   const active=current(own.user_id);if(active.length>1)throw Error('BINDING_INCONSISTENT');
   const c=bindings.filter(x=>x.user_id===own.user_id&&x.challenge_status==='pending').slice(-1)[0];
   return {version:VERSION,binding_status:active.length?'bound':'unbound',binding_id:active[0]?.binding_id||null,challenge_status:fenced(own.user_id)?'unknown':c?(ms(c.challenge_expires_at)<=now?'expired':'pending'):'none',expires_at:c?.challenge_expires_at||null,server_time:iso(now)};
  }
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(p.operationId||''))throw Error('INVALID_OPERATION');
  const subject=p.subjectHash||'';
  const event=p.eventId||'';
  if(action==='consume'&&(!/^[a-f0-9]{64}$/.test(subject)||!/^U[a-f0-9]{32}$/.test(p.lineUserId||'')||!event||event.length>200))throw Error('INVALID_EVENT');
  const prior=logs.find(x=>x.operation_id===p.operationId||(event&&x.webhook_event_id===event));
  if(prior)return {status:prior.processing_status==='completed'?'duplicate':'unknown'};
  if(action==='notification'||action==='webhookNotification'){
   const op=logs.find(x=>x.operation_id===p.targetOperationId&&x.processing_status==='completed'&&(own?x.user_id===own.user_id:x.line_subject_hash===p.subjectHash));
   if(!op||!['sent','failed','unknown'].includes(p.notificationStatus))throw Error('INVALID_NOTIFICATION');
   // Record only, never send/retry. Original operation notification claim is final.
   repo.appendLog({audit_id:p.operationId,operation_id:p.operationId,user_id:op.user_id,event_type:'notification',result:p.notificationStatus,processing_status:'completed',created_at:iso(now),processed_at:iso(now)});
   return {status:'recorded'};
  }
  let uid=own?.user_id||'',c;
  if(action==='consume'){
   if(!/^[a-f0-9]{64}$/.test(p.codeDigest||''))throw Error('INVALID_DIGEST');
   const candidates=bindings.filter(x=>x.code_digest===p.codeDigest&&x.challenge_status==='pending'&&ms(x.challenge_expires_at)>now);
   if(candidates.length>1)throw Error('CODE_INCONSISTENT');c=candidates[0];uid=c?.user_id||'';
  }
  if(fenced(uid,subject,p.codeDigest)||(action==='consume'&&bindings.some(x=>x.code_digest===p.codeDigest&&fenced(x.user_id))))return {status:'unknown'};
  const row={audit_id:p.operationId,operation_id:p.operationId,user_id:uid,event_type:action,result:'',details:action==='consume'?p.codeDigest:'',created_at:iso(now),webhook_event_id:event,processing_status:'processing',line_subject_hash:subject,notification_status:''};
  // Intent is durable BEFORE authoritative changes. Any exception leaves a fence.
  repo.appendLog(row);
  function finish(status,extra={}){row.result=status;row.processing_status='completed';row.processed_at=iso(now);repo.updateLog(row);return {status,operationId:p.operationId,...extra};}
  function rate(kind,key,window,limit){return logs.filter(x=>x.event_type===kind&&x.details===key&&ms(x.created_at)>now-window).length>=limit;}
  if(action==='create'){
   if(current(uid).length)return finish('already_bound');
   if(!/^[a-f0-9]{64}$/.test(p.codeDigest||'')||!p.sourceHash)throw Error('INVALID_CHALLENGE');
   const attempts=logs.filter(x=>x.event_type==='create'&&!['collision','rate_limited'].includes(x.result)&&x.user_id===uid);
   if(attempts.some(x=>ms(x.created_at)>now-60000)||attempts.filter(x=>ms(x.created_at)>now-3600000).length>=5||rate('issue_source',p.sourceHash,3600000,30))return finish('rate_limited');
   repo.appendLog({audit_id:p.operationId+'_ip',event_type:'issue_source',details:p.sourceHash,created_at:iso(now),processing_status:'completed',processed_at:iso(now)});
   if(bindings.some(x=>x.code_digest===p.codeDigest&&x.challenge_status==='pending'&&ms(x.challenge_expires_at)>now))return finish('collision');
   bindings.filter(x=>x.user_id===uid&&x.challenge_status==='pending').forEach(x=>{x.challenge_status='revoked';x.updated_at=iso(now);repo.updateBinding(x);});
   const b={binding_id:p.operationId,user_id:uid,status:'pending',challenge_id:p.operationId,code_digest:p.codeDigest,digest_version:'v2',challenge_status:'pending',challenge_created_at:iso(now),challenge_expires_at:iso(now+300000),created_session_hash:p.sessionHash,operation_id:p.operationId,updated_at:iso(now)};
   repo.appendBinding(b);return finish('pending',{expires_at:b.challenge_expires_at});
  }
  if(action==='consume'){
   const blocked=logs.some(x=>x.line_subject_hash===subject&&ms(x.blocked_until)>now);
   if(blocked)return finish('blocked');
   const attempts=logs.filter(x=>x.event_type==='consume'&&x.line_subject_hash===subject&&ms(x.created_at)>now-60000);
   if(attempts.length>=10)return finish('rate_limited');
   // Global signed-event bound protects the shared Sheet against distributed guessing.
   if(logs.filter(x=>x.event_type==='consume'&&ms(x.created_at)>now-60000).length>=100)return finish('rate_limited');
   if(!c){
    const failures=logs.filter(x=>x.event_type==='consume'&&x.line_subject_hash===subject&&x.result==='invalid_code'&&ms(x.created_at)>now-900000);
    if(failures.length>=4)row.blocked_until=iso(now+900000);
    return finish('invalid_code',{blocked_until:row.blocked_until||null});
   }
   const u=repo.user(c.user_id);if(!u||u.account_status!=='active')return finish('account_unavailable');
   if(current(c.user_id).length||bindings.some(x=>x.line_user_id===p.lineUserId&&x.status==='active'))return finish('conflict');
   c.status='active';c.line_user_id=p.lineUserId;c.bound_at=iso(now);c.updated_at=iso(now);c.challenge_status='consumed';c.challenge_used_at=iso(now);c.operation_id=p.operationId;
   repo.updateBinding(c);row.notification_status='claimed';return finish('bound');
  }
  if(action==='unbind'){
   if(p.passwordVerified!==true||!p.bindingId||!p.passwordHash)throw Error('PASSWORD_REAUTH_REQUIRED');
   if(own.password_hash!==p.passwordHash)return finish('reauth_stale');
   const matches=current(uid);if(matches.length!==1||matches[0].binding_id!==p.bindingId)return finish('binding_changed');
   const b=matches[0],target=b.line_user_id;b.status='unbound';b.unbound_at=iso(now);b.updated_at=iso(now);b.operation_id=p.operationId;repo.updateBinding(b);
   row.notification_status='claimed';return finish('unbound',{notificationTarget:target});
  }
  throw Error('ACTION_DENIED');
 }
 return {execute,VERSION,B,A};
})();
if(typeof module!=='undefined')module.exports=IKeyLineDomain;
