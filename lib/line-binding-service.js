'use strict';
const crypto=require('node:crypto');
const {newCode,digestCode,parseBindingMessage}=require('./line-code-binding');
const {passwordVerify}=require('../gen3-auth/core');
const {createLineBindingTransport}=require('./line-binding-transport');
function createLineBindingService(store,env=process.env,fetcher=fetch){
 const enabled=()=>env.IKEY_LINE_BINDING_ENABLED==='true'&&typeof store?.lineCall==='function'&&[env.IKEY_LINE_TRUST_SECRET,env.IKEY_LINE_CODE_SECRET].every(s=>typeof s==='string'&&s.length>=32)&&!!env.LINE_MESSAGING_CHANNEL_SECRET&&!!env.LINE_MESSAGING_ACCESS_TOKEN;
 function transport(){if(!enabled())throw Error('LINE_BINDING_DISABLED');return createLineBindingTransport(store.lineCall,env.IKEY_LINE_TRUST_SECRET);}
 async function invoke(action,p){const t=transport();const health=await t.invoke('health');if(health.version!=='line-binding-v2'||health.storage!==true)throw Error('LINE_STORAGE_NOT_READY');return t.invoke(action,p);}
 const subject=s=>crypto.createHmac('sha256',env.IKEY_LINE_CODE_SECRET).update('line-subject-v2:'+s).digest('hex');
 const op=()=>crypto.randomUUID();
 async function notify(target,text,replyToken){
  let status='unknown';
  try{
   const body=replyToken?{replyToken,messages:[{type:'text',text}]}:{to:target,messages:[{type:'text',text}]};
   const response=await fetcher('https://api.line.me/v2/bot/message/'+(replyToken?'reply':'push'),{method:'POST',headers:{Authorization:'Bearer '+env.LINE_MESSAGING_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(5000)});
   status=response.ok?'sent':'failed';
  }catch{/* No retry: network failure can follow accepted delivery. */}
  return status;
 }
 return {enabled,
  async status(sessionHash){return invoke('status',{sessionHash});},
  async admin(sessionHash){return invoke('admin',{sessionHash});},
  async start(sessionHash,source){
   for(let i=0;i<3;i++){
    const code=newCode(),r=await invoke('create',{sessionHash,sourceHash:subject('ip:'+source),codeDigest:digestCode(code,env.IKEY_LINE_CODE_SECRET),operationId:op()});
    if(r.status==='collision')continue;
    if(r.status==='pending'&&Number.isFinite(Date.parse(r.expires_at)))return {...r,code,server_time:new Date().toISOString()};
    return r;
   }throw Error('LINE_CODE_UNAVAILABLE');
  },
  async unbind(sessionHash,user,password,bindingId,csrf){
   if(!enabled())throw Error('LINE_BINDING_DISABLED');
   if(!csrf||typeof password!=='string'||password.length>128||!bindingId)return {status:'invalid_request'};
   // Persistent shared password throttle; do not alter existing login counters.
   const key=subject('reauth:'+user.user_id);
   if(!await store.throttleAtomic(key,5,900000))return {status:'rate_limited'};
   const fresh=await store.findById(user.user_id);
   if(!fresh||!passwordVerify(password,fresh.password_hash))return {status:'wrong_password'};
   const r=await invoke('unbind',{sessionHash,bindingId,passwordVerified:true,passwordHash:fresh.password_hash,operationId:op()});
   if(r.status!=='unbound')return r;
   const notificationStatus=await notify(r.notificationTarget,'iKey：你的 LINE 帳號綁定已解除。');
   try{await invoke('notification',{sessionHash,targetOperationId:r.operationId,operationId:op(),notificationStatus});}catch{/* Binding stays confirmed. */}
   return {status:'unbound',notification_status:notificationStatus};
  },
  async event(event){
   const c=parseBindingMessage(event);if(!c)return {status:'ignored'};
   if(!c.eventId)throw Error('LINE_EVENT_ID_REQUIRED');
   const r=await invoke('consume',{eventId:c.eventId,lineUserId:c.lineUserId,subjectHash:subject(c.lineUserId),codeDigest:digestCode(c.code,env.IKEY_LINE_CODE_SECRET),operationId:op()});
   if(r.status==='bound'){
    // A claimed notification is attempted once. Never re-send on a duplicate event.
    const notificationStatus=await notify(c.lineUserId,'iKey：LINE 帳號綁定成功。',event.replyToken);
    // Webhook has no user Session: signed dedicated receipt action, below.
    try{await transport().invoke('webhookNotification',{targetOperationId:r.operationId,operationId:op(),notificationStatus,subjectHash:subject(c.lineUserId)});}catch{/* Remains claimed/unknown, never rollback. */}
   }
   return {status:r.status};
  }
 };
}
module.exports={createLineBindingService};
