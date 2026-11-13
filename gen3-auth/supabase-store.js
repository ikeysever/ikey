'use strict';
const {randomUUID}=require('node:crypto');
const {createSupabaseDataAdapter}=require('../lib/supabase-data-adapter');
function createSupabaseStore(options){
 const adapter=createSupabaseDataAdapter(options);
 const select=async(table,where,limit=1)=>(await adapter.dbCall('db.select',{table,where,limit})).rows;
 const insert=async(table,primary_key,data)=>adapter.dbCall('db.insert',{table,primary_key,data});
 const update=async(table,where,data)=>adapter.dbCall('db.update',{table,where,data});
 const one=async(table,where)=>(await select(table,where))[0]||null;
 const now=()=>new Date().toISOString();
 async function throttleAtomic(key,limit,windowMs){
   const result=await adapter.rpc('ikey_auth_throttle',{p_key:key,p_limit:limit,p_window_ms:windowMs});
   if(typeof result!=='boolean')throw Error('SUPABASE_THROTTLE_UNCONFIRMED');
   return result;
 }
 async function findById(user_id){return one('Gen3_Users',{user_id});}
 async function findByLogin(identifier){return one('Gen3_Users',{username:String(identifier).toLowerCase()});}
 async function audit(event){await insert('Auth_Audit_Logs','audit_id',{audit_id:randomUUID(),user_id:event.user_id||'',event_type:event.event_type||'',result:event.result||'',auth_method:event.auth_method||'',created_at:now()});}
 async function registerAtomic(user){
   if(await findByLogin(user.username))return false;
   try{await insert('Gen3_Users','user_id',user);return true;}
   catch(e){if(e.message==='SUPABASE_DUPLICATE_KEY')return false;throw e;}
 }
 async function recordLoginFailureAtomic(user_id){
   const result=await adapter.rpc('ikey_auth_failure',{p_user_id:user_id});
   return Array.isArray(result)?result[0]||null:null;
 }
 async function completeLoginAtomic(user_id,session){
   const result=await adapter.rpc('ikey_auth_login',{p_user_id:user_id,p_session:session});
   return Array.isArray(result)?result[0]||null:null;
 }
 async function recordLoginSuccessAtomic(user_id){
   const user=await findById(user_id);
   if(!user) return null;
   await update('Gen3_Users',{user_id},{failed_login_attempts:'0',locked_until:'',account_status:'active',updated_at:now()});
   return findById(user_id);
 }
 async function createSession(session){await insert('Auth_Sessions','session_id',session);return session;}
 async function findSessionByHash(session_token_hash){return one('Auth_Sessions',{session_token_hash});}
 async function resolveSession(hash){
   const session=await findSessionByHash(hash);
   if(!session||session.revoked_at||Date.parse(session.expires_at)<=Date.now())return null;
   const user=await findById(session.user_id);
   return user?{session,user}:null;
 }
 async function revokeSessionByHash(hash){
   const session=await findSessionByHash(hash);if(!session)return false;
   await update('Auth_Sessions',{session_id:session.session_id},{revoked_at:now(),revoked_reason:'logout'});return true;
 }
 async function touchSession(session_id,expires_at,last_seen_at){
   const result=await update('Auth_Sessions',{session_id},{expires_at,last_seen_at});
   return result.count===1;
 }
 async function revokeSession(session_id,reason='revoked'){
   const result=await update('Auth_Sessions',{session_id},{revoked_at:now(),revoked_reason:reason});
   return result.count===1;
 }
 async function adminAccountList(actor_session_hash){
   const actor=await resolveSession(actor_session_hash);
   if(!actor||actor.user.global_role!=='super_admin')throw Error('ADMIN_DENIED');
   const rows=await select('Gen3_Users',{},100);
   return {accounts:rows.map(({password_hash,...safe})=>safe),limited:rows.length===100};
 }
 async function adminAccountAction(action,payload){
   const actor=await resolveSession(payload.actor_session_hash);
   if(!actor||actor.user.global_role!=='super_admin')throw Error('ADMIN_DENIED');
   const target=await findById(payload.target_user_id);
   if(!target||target.global_role==='super_admin'||target.user_id===actor.user.user_id)throw Error('ADMIN_TARGET_DENIED');
   if(action==='adminAccountSetStatus'){
     if(!['active','disabled'].includes(payload.status))throw Error('INVALID_STATUS');
     await update('Gen3_Users',{user_id:target.user_id},{account_status:payload.status,updated_at:now()});
   }else if(action==='adminAccountResetPassword'){
     if(typeof payload.password_hash!=='string'||!payload.password_hash.startsWith('scrypt:v1:'))throw Error('INVALID_HASH');
     await update('Gen3_Users',{user_id:target.user_id},{password_hash:payload.password_hash,updated_at:now()});
   }else if(action!=='adminAccountRevokeSessions')throw Error('ACTION_DENIED');
   const sessions=await select('Auth_Sessions',{user_id:target.user_id},100);
   let revoked_sessions=0;
   for(const s of sessions)if(!s.revoked_at){await revokeSession(s.session_id,'admin');revoked_sessions++;}
   await audit({user_id:actor.user.user_id,event_type:action,result:'success',auth_method:'session'});
   return {target:{user_id:target.user_id},revoked_sessions};
 }
 return {...adapter,throttleAtomic,findById,findByLogin,registerAtomic,recordLoginFailureAtomic,recordLoginSuccessAtomic,completeLoginAtomic,createSession,findSessionByHash,resolveSession,revokeSessionByHash,touchSession,revokeSession,audit,adminAccountList,adminAccountAction,
   // Pending integrations remain explicitly disabled instead of silently calling GAS.
   lineCall:async()=>{throw Error('LINE_NOT_IMPLEMENTED');},
   projectCall:async()=>{throw Error('PROJECT_LEGACY_ACTION_NOT_IMPLEMENTED');},
   commandProbe:async()=>{throw Error('COMMAND_PROBE_DISABLED');}
 };
}
module.exports={createSupabaseStore};
