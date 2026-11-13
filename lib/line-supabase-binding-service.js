'use strict';
const crypto=require('node:crypto');
const {newCode,digestCode,parseBindingMessage}=require('./line-code-binding');
const {passwordVerify}=require('../gen3-auth/core');
function createSupabaseLineBindingService(store,env=process.env,fetcher=globalThis.fetch){
 const enabled=()=>Boolean(store?.dbCall&&store?.rpc&&typeof env.IKEY_LINE_CODE_SECRET==='string'&&env.IKEY_LINE_CODE_SECRET.length>=32&&env.LINE_MESSAGING_CHANNEL_SECRET&&env.LINE_MESSAGING_ACCESS_TOKEN);
 const status=async(sessionHash)=>{
  const session=await store.resolveSession(sessionHash);if(!session)throw Error('SESSION_INVALID');
  const rows=(await store.dbCall('db.select',{table:'LINE_Bindings',where:{user_id:session.user.user_id,status:'bound'},limit:2})).rows;
  if(rows.length>1)throw Error('AMBIGUOUS_BINDING');
  const b=rows[0];const challenge=b?{challenge_status:'none',server_time:new Date().toISOString()}:await store.rpc('ikey_line_code_status',{p_user:session.user.user_id});return {binding_status:b?'bound':'unbound',binding_id:b?.binding_id||null,bound_at:b?.bound_at||null,...challenge};
 };
 async function start(sessionHash){
  const session=await store.resolveSession(sessionHash);if(!session)throw Error('SESSION_INVALID');
  for(let i=0;i<3;i++){
   const code=newCode();
   try{const result=await store.rpc('ikey_line_start',{p_user:session.user.user_id,p_digest:digestCode(code,env.IKEY_LINE_CODE_SECRET)});if(result?.status==='pending')return {...result,server_time:new Date().toISOString(),code};return result;}catch(e){if(e.message==='SUPABASE_DUPLICATE_KEY')continue;throw e;}
  }throw Error('CODE_UNAVAILABLE');
 }
 async function unbind(sessionHash,user,password,bindingId,csrf){
  if(!csrf||typeof password!=='string'||password.length>128||!bindingId)return {status:'invalid_request'};
  const allowed=await store.throttleAtomic('line-unbind:'+user.user_id,5,900000);
  if(!allowed)return {status:'rate_limited'};
  const fresh=await store.findById(user.user_id);
  if(!fresh||!passwordVerify(password,fresh.password_hash))return {status:'wrong_password'};
  const result=await store.dbCall('db.update',{table:'LINE_Bindings',where:{binding_id:bindingId,user_id:user.user_id,status:'bound'},data:{status:'unbound',unbound_at:new Date().toISOString(),updated_at:new Date().toISOString()}});
  if(result.count!==1)return {status:'not_bound'};
  await store.dbCall('db.insert',{table:'LINE_Audit_Logs',primary_key:'audit_id',data:{audit_id:crypto.randomUUID(),user_id:user.user_id,line_user_id:result.rows[0].line_user_id,event_type:'binding_unbound',result:'success',created_at:new Date().toISOString()}});
  return {status:'unbound'};
 }
 async function event(e){
  const c=parseBindingMessage(e);if(!c)return {status:'ignored'};
  if(!enabled())return {status:'unknown'};
  if(!c.eventId)return {status:'unknown'};
  const result=await store.rpc('ikey_line_consume',{p_event:c.eventId,p_line:c.lineUserId,p_digest:digestCode(c.code,env.IKEY_LINE_CODE_SECRET)});
  if(result?.status==='bound'){
   try{await fetcher('https://api.line.me/v2/bot/message/reply',{method:'POST',headers:{Authorization:'Bearer '+env.LINE_MESSAGING_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({replyToken:e.replyToken,messages:[{type:'text',text:'iKey：LINE 帳號綁定成功！請返回網站重新查詢綁定狀態。'}]}),signal:AbortSignal.timeout(5000)})}catch(err){console.warn('LINE binding reply unknown',err.message)}
  }
  return {status:result?.status||'unknown'};
 }
 async function admin(sessionHash){const s=await store.resolveSession(sessionHash);if(!s||!['admin','super_admin'].includes(s.user.global_role))throw Error('ADMIN_DENIED');const r=await store.dbCall('db.select',{table:'LINE_Bindings',where:{status:'bound'},limit:100});return {bindings:r.rows.map(x=>({binding_id:x.binding_id,user_id:x.user_id,bound_at:x.bound_at})),truncated:r.limited};}
 return {enabled,status,start,unbind,event,admin};
}
module.exports={createSupabaseLineBindingService};