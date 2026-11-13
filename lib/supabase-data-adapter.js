'use strict';
// Staging-only Supabase data adapter. Never expose the secret key to browser code.
// This adapter deliberately implements only generic select/insert; auth and device
// command transactions MUST remain on the legacy store until ported atomically.
const TABLES=Object.freeze({
  Gen3_Users:'gen3_users',Auth_Tokens:'auth_tokens',Auth_Sessions:'auth_sessions',
  Auth_Audit_Logs:'auth_audit_logs',Projects:'projects',Devices:'devices',
  System_Announcements:'system_announcements',
  System_Announcement_Reads:'system_announcement_reads',
  Project_Access:'project_access',Project_Devices:'project_devices',
  LINE_Bindings:'line_bindings',LINE_Notification_Preferences:'line_notification_preferences',
  LINE_Audit_Logs:'line_audit_logs'
});
const KEYS=Object.freeze({
  gen3_users:'user_id',auth_tokens:'token_id',auth_sessions:'session_id',
  auth_audit_logs:'audit_id',projects:'project_id',devices:'device_id',
  system_announcements:'announcement_id',system_announcement_reads:'read_id',
  project_access:'entry_id',project_devices:'binding_id',line_bindings:'binding_id',
  line_notification_preferences:'preference_id',line_audit_logs:'audit_id'
});
function createSupabaseDataAdapter({url=process.env.IKEY_SUPABASE_URL,key=process.env.IKEY_SUPABASE_SECRET_KEY,fetchImpl=globalThis.fetch}={}){
  if(!url||!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)||!key||typeof fetchImpl!=='function')
    throw Error('SUPABASE_STORAGE_NOT_CONFIGURED');
  const base=url.replace(/\/$/,'')+'/rest/v1/';
  async function request(table,{method='GET',query='',body}={}){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetchImpl(base+table+query,{
        method,signal:controller.signal,
        headers:{apikey:key,
          'Content-Type':'application/json',Prefer:'return=representation'},
        ...(body===undefined?{}:{body:JSON.stringify(body)})
      });
      if(!response.ok){
        if(response.status===409)throw Error('SUPABASE_DUPLICATE_KEY');
        // Only emit known, non-sensitive API error codes. Never log response messages,
        // headers, request details, credentials or arbitrary server-provided strings.
        let category='UNCLASSIFIED';
        if(response.status===401||response.status===403){
          try{
            const payload=await response.json();
            const code=payload && typeof payload.code==='string' ? payload.code : '';
            const known={
              PGRST301:'JWT_INVALID',
              PGRST302:'JWT_MISSING',
              '42501':'DATABASE_PERMISSION',
              invalid_api_key:'INVALID_API_KEY',
              missing_api_key:'MISSING_API_KEY',
              bad_jwt:'JWT_INVALID',
              unauthorized:'UNAUTHORIZED'
            };
            category=Object.prototype.hasOwnProperty.call(known,code)?known[code]:'UNCLASSIFIED';
          }catch(_ignored){category='UNCLASSIFIED';}
        }
        throw Error('SUPABASE_STORAGE_HTTP_'+response.status+'_'+category);
      }
      return response.json();
    }finally{clearTimeout(timer);}
  }
  async function dbCall(action,payload={}){
    if(!['db.select','db.insert','db.update','db.delete'].includes(action))throw Error('SUPABASE_ACTION_NOT_IMPLEMENTED');
    const table=TABLES[payload.table];
    if(!table)throw Error('SUPABASE_TABLE_DENIED');
    if(action==='db.select'){
      const limit=payload.limit===undefined?100:Number(payload.limit);
      if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw Error('SUPABASE_INVALID_LIMIT');
      const params=new URLSearchParams({select:'*',limit:String(limit)});
      const where=payload.where||{};
      if(typeof where!=='object'||Array.isArray(where))throw Error('SUPABASE_INVALID_FILTER');
      const allowed=Object.keys(KEYS).includes(table);
      if(!allowed)throw Error('SUPABASE_TABLE_DENIED');
      const columns=COLUMNS[table];
      for(const [field,value] of Object.entries(where)){
        if(!columns.includes(field)||value===null||typeof value==='object')throw Error('SUPABASE_INVALID_FILTER');
        params.set(field,'eq.'+String(value));
      }
      const rows=await request(table,{query:'?'+params});
      if(!Array.isArray(rows))throw Error('SUPABASE_INVALID_RESPONSE');
      return {rows,limited:rows.length===limit};
    }
    if(action==='db.update'||action==='db.delete'){
      const where=payload.where||{};
      if(typeof where!=='object'||Array.isArray(where)||Object.keys(where).length===0)throw Error('SUPABASE_INVALID_FILTER');
      const params=new URLSearchParams({select:'*'});
      for(const [field,value] of Object.entries(where)){
        if(!COLUMNS[table].includes(field)||value===null||typeof value==='object')throw Error('SUPABASE_INVALID_FILTER');
        params.set(field,'eq.'+String(value));
      }
      if(action==='db.delete' && table==='devices')throw Error('SUPABASE_DEVICE_DELETE_DISABLED');
      if(action==='db.update'){
        if(!payload.data||typeof payload.data!=='object'||Array.isArray(payload.data)||!Object.keys(payload.data).length||Object.keys(payload.data).some(k=>!COLUMNS[table].includes(k)||k===KEYS[table]))throw Error('SUPABASE_INVALID_UPDATE');
      }
      const rows=await request(table,{method:action==='db.update'?'PATCH':'DELETE',query:'?'+params,body:action==='db.update'?payload.data:undefined});
      if(!Array.isArray(rows))throw Error('SUPABASE_INVALID_RESPONSE');
      return {updated:action==='db.update',deleted:action==='db.delete',count:rows.length,rows};
    }
    if(payload.primary_key!==KEYS[table]||!payload.data||typeof payload.data!=='object'||Array.isArray(payload.data))
      throw Error('SUPABASE_INVALID_INSERT');
    if(!Object.keys(payload.data).length||Object.keys(payload.data).some(k=>!COLUMNS[table].includes(k)))
      throw Error('SUPABASE_INVALID_INSERT');
    const rows=await request(table,{method:'POST',body:payload.data});
    if(!Array.isArray(rows)||rows.length!==1)throw Error('SUPABASE_INSERT_UNCONFIRMED');
    return {inserted:true,record:rows[0]};
  }
  async function health(){
    const result=await dbCall('db.select',{table:'Projects',limit:1});
    return {storage:Array.isArray(result.rows),version:'gen3-username-v3'};
  }
  async function deviceAuthFindById(device_id){
    if(typeof device_id!=='string'||!/^[A-HJ-NP-Z2-9]{8}$/.test(device_id))throw Error('INVALID_DEVICE_ID');
    const result=await dbCall('db.select',{table:'Devices',where:{device_id},limit:1});
    return result.rows[0]||null;
  }
  return {dbCall,health,deviceAuthFindById};
}
// Explicit column allowlist: no arbitrary SQL identifiers or PostgREST operators.
const COLUMNS=Object.freeze({
  gen3_users:['user_id','password_hash','display_name','global_role','account_status','failed_login_attempts','locked_until','created_at','updated_at','username'],
  auth_tokens:['token_id','user_id','token_hash','purpose','created_at','expires_at','used_at'],
  auth_sessions:['session_id','user_id','session_token_hash','created_at','expires_at','last_seen_at','revoked_at','revoked_reason'],
  auth_audit_logs:['audit_id','user_id','event_type','result','auth_method','ip_address','user_agent','details','created_at'],
  projects:['project_id','project_name','description','created_by_user_id','authorization_method','scheduled_authorization','status','created_at','updated_at','notification_theme','notification_sound_pack','notification_volume'],
  devices:['device_id','password_hash','status','created_by_user_id','created_at','updated_at'],
  system_announcements:['announcement_id','title','content','category','priority','status','created_by_user_id','updated_by_user_id','created_at','updated_at','published_at','scheduled_at','expires_at','archived_at','deleted_at'],
  system_announcement_reads:['read_id','announcement_id','user_id','read_at'],
  project_access:['entry_id','project_id','entry_type','user_id','role','status','invite_hash','join_policy','created_at','updated_at','reviewed_by'],
  project_devices:['binding_id','project_id','device_id','display_name','lock_mode','heartbeat_interval_minutes','auto_firmware_update','bound_by','bound_at','updated_at'],
  line_bindings:['binding_id','user_id','line_user_id','line_display_name','status','bound_at','unbound_at','updated_at'],
  line_notification_preferences:['preference_id','user_id','notification_type','enabled','updated_at'],
  line_audit_logs:['audit_id','user_id','line_user_id','event_type','result','details','created_at']
});
module.exports={createSupabaseDataAdapter};
