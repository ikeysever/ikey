'use strict';
const express = require('express');
const path = require('node:path');
const app = express();
app.disable('x-powered-by');
// LINE webhook requires raw request bytes for HMAC verification.
let lineService, lineMenuService;
require('./lib/line-ingress').mountLineIngress(app, { getService: () => lineService, getMenuService: () => lineMenuService });
app.use(express.json({ limit: '16kb' }));
// Server-side API request timing and per-minute counts; no credentials or payloads logged.
const requestMinuteStats = new Map();
let statsMinute = -1;
app.use('/api', (req, res, next) => {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
    const minute = Math.floor(Date.now() / 60000);
    const key = minute + ':' + req.method + ':' + (req.route?.path || 'middleware');
    const stat = requestMinuteStats.get(key) || { count: 0, totalMs: 0, maxMs: 0, errors: 0 };
    stat.count++;
    stat.totalMs += elapsedMs;
    stat.maxMs = Math.max(stat.maxMs, elapsedMs);
    if (res.statusCode >= 400) stat.errors++;
    requestMinuteStats.set(key, stat);
    if (elapsedMs >= 3000) console.info('API slow request', req.method, req.path.split('?')[0], res.statusCode, Math.round(elapsedMs) + 'ms');
    if (minute === statsMinute) return;
    statsMinute = minute;
    for (const [k, v] of requestMinuteStats) {
      if (Number(k.split(':', 1)[0]) >= minute) continue;
      console.info('API minute stats', k, 'count', v.count, 'avg_ms', Math.round(v.totalMs / v.count), 'max_ms', Math.round(v.maxMs), 'errors', v.errors);
      requestMinuteStats.delete(k);
    }
  });
  next();
});

// Configurable per-minute protection for expensive auth endpoints.
// Process-local limiter: protects this instance, not a distributed global quota.
const apiRateBuckets = new Map();
const apiRateDefaults = {
  'POST /auth/login': 30,
  'POST /auth/register': 10,
  'POST /auth/prefetch': 30,
  'GET /auth/status': 120,
  'GET /auth/me': 120
};
const configuredLimit = (route, fallback) => {
  const name = 'IKEY_RPM_' + route.replace(/[^A-Z0-9]/gi, '_').toUpperCase();
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number(raw);
  return Number.isSafeInteger(value) && value >= 1 && value <= 10000 ? value : fallback;
};
app.use('/api', (req, res, next) => {
  const route = req.method + ' ' + req.path;
  const fallback = apiRateDefaults[route];
  if (!fallback) return next();
  const limit = configuredLimit(route, fallback);
  const now = Date.now();
  const windowMs = 60000;
  // req.ip is the connection IP, not a user-supplied forwarded header.
  const key = req.ip + '|' + route;
  let bucket = apiRateBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    apiRateBuckets.set(key, bucket);
  }
  const remaining = Math.max(0, limit - bucket.count - 1);
  const waitSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  res.set('X-RateLimit-Limit', String(limit));
  res.set('X-RateLimit-Remaining', String(remaining));
  if (bucket.count >= limit) {
    res.set('Retry-After', String(waitSeconds));
    console.warn('API rate limited', route, 'retry_after_s', waitSeconds);
    return res.status(429).json({ success: false, code: 'RATE_LIMITED', message: '請求太頻繁，請稍後再試', retry_after_seconds: waitSeconds });
  }
  bucket.count++;
  if (apiRateBuckets.size > 5000) {
    for (const [k, v] of apiRateBuckets) if (v.resetAt <= now) apiRateBuckets.delete(k);
  }
  next();
});

// Serve public CSS/JS/images before authenticated API routers; never expose protected HTML here.
app.use((req,res,next)=>{if((req.method==='GET'||req.method==='HEAD')&&/^\/(?:style\.css|app\.js|home\.css|home\.js|quick-unlock\.(?:css|js)|announcements-home\.(?:css|js)|assets\/)/.test(req.path)){return express.static(path.join(__dirname,'public'),{fallthrough:true,immutable:false})(req,res,next);}next();});
// Public entry point must never require a project session. Auth is enforced on APIs and protected pages.
app.get('/',(_req,res)=>{res.set('Cache-Control','no-store');return res.sendFile(path.join(__dirname,'public','index.html'));});
app.get('/ping', (_req, res) => res.status(200).json({ ok: true, service: 'ikey', version: '3.1' }));
app.get('/api/health', (_req, res) => res.status(200).json({ ok: true, service: 'ikey-api', version: '3.1' }));
// Select only an explicitly configured storage backend.
let authStore = null;
try {
  if(process.env.IKEY_STORAGE_BACKEND==='supabase'){
    const {createSupabaseStore}=require('./gen3-auth/supabase-store');
    authStore=createSupabaseStore();
    console.info('iKey storage backend: SUPABASE');
  }else if(process.env.IKEY_STORAGE_BACKEND==='gas'){
    const {createSheetsStore}=require('./gen3-auth/sheets-store');
    authStore=createSheetsStore();
    console.info('iKey storage backend: GAS');
  }else throw Error('IKEY_STORAGE_BACKEND_INVALID');
} catch (error) {
  console.warn('Gen3 authentication storage is not configured:', error.message);
}
// Non-blocking, read-only Supabase connectivity check. No secret or row contents logged.
// Report only the configured key family, never its length, prefix bytes, or contents.
if(process.env.IKEY_SUPABASE_SECRET_KEY){
  const key=process.env.IKEY_SUPABASE_SECRET_KEY;
  const keyFamily=key.startsWith('sb_secret_')?'SECRET_OPAQUE':
    key.startsWith('sb_publishable_')?'PUBLISHABLE_WRONG_ROLE':
    key.split('.').length===3?'JWT_LEGACY':'UNRECOGNIZED';
  console.info('Supabase credential family:',keyFamily);
}
// Non-blocking, read-only Supabase connectivity check. No secret or row contents logged.
// Check project reads independently of auth readiness.
if(process.env.IKEY_SUPABASE_URL && process.env.IKEY_SUPABASE_SECRET_KEY){
  try{
    const {createSupabaseDataAdapter}=require('./lib/supabase-data-adapter');
    const probe=createSupabaseDataAdapter();
    probe.dbCall('db.select',{table:'Projects',limit:1})
      .then(result=>console.info('Supabase probe:',Array.isArray(result.rows)?'READY':'INVALID_RESPONSE'))
      .catch(err=>console.warn('Supabase probe: FAILED',String(err.message||'UNKNOWN').replace(/[^A-Z0-9_]/gi,'').slice(0,60)));
  }catch(_err){console.warn('Supabase probe: CONFIG_ERROR');}
}else{
  console.info('Supabase probe: NOT_CONFIGURED');
}
const { createRouter } = require('./gen3-auth/routes');
app.get(['/api/auth/status', '/api/ready'], async (req, res) => {
  const unavailable = body => res.status(req.path === '/api/ready' ? 503 : 200).json(body);
  res.set('Cache-Control', 'no-store');
  if (!authStore) return unavailable({ ready: false, enabled: false, registration: false, reason: 'CONFIG_MISSING' });
  try {
    const health = await authStore.health();
    const ready = health?.storage === true && health?.version === 'gen3-username-v3';
    return res.status(!ready && req.path === '/api/ready' ? 503 : 200).json({ ready, enabled: ready, registration: ready, reason: ready ? null : 'SCHEMA_NOT_READY' });
  } catch (_error) {
    return unavailable({ ready: false, enabled: false, registration: false, reason: 'STORAGE_UNAVAILABLE' });
  }
});
app.use('/api/auth', createRouter(authStore));
// Device identity API only; physical commands remain disabled.
require('./device-auth')(app,authStore);
// Project operations are always scoped to the authenticated account on the server.
const { hashToken, active } = require('./gen3-auth/core');
const { randomUUID } = require('node:crypto');
async function requireProjectUser(req,res,next){
  res.set('Cache-Control','no-store');
  if(!authStore)return res.status(503).json({success:false,message:'專案服務尚未就緒'});
  try{
    const raw=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('ikey_gen3_session='))?.slice('ikey_gen3_session='.length);
    if(!raw||raw.length>256)return res.status(401).json({success:false,message:'請先登入'});
    const resolved=await authStore.resolveSession(hashToken(raw));
    if(!resolved||resolved.session.revoked_at||Date.parse(resolved.session.expires_at)<=Date.now()||!active(resolved.user))return res.status(401).json({success:false,message:'登入已失效'});
    req.projectUser=resolved.user;req.projectSessionHash=hashToken(raw);next();
  }catch{return res.status(503).json({success:false,message:'無法驗證登入狀態'});}
}
function sameProjectOrigin(req){
 const origin=req.get('origin');if(!origin)return true;
 try{const u=new URL(origin);const proto=req.secure||req.get('x-forwarded-proto')==='https'?'https:':'http:';return u.protocol===proto&&u.host===req.get('host');}catch{return false;}
}
// Project invitations and membership operations use the authenticated project session.
require('./lib/project-members-router')(app,{store:authStore,requireUser:requireProjectUser,sameOrigin:sameProjectOrigin});
require('./lib/project-access-requests-router')(app,{store:authStore,requireUser:requireProjectUser,sameOrigin:sameProjectOrigin});
require('./lib/admin-slot-unlock-router')(app,{store:authStore,requireProjectUser,sameProjectOrigin});
// LINE is opt-in and fails closed until matching GAS v2 schema and trust are ready.
lineService=require('./lib/line-supabase-binding-service').createSupabaseLineBindingService(authStore);
lineMenuService=require('./lib/line-menu-service').createLineMenuService(authStore);
require('./lib/line-binding-router').mountLineBindingRoutes(app,{service:lineService,requireUser:requireProjectUser,csrfSecret:process.env.IKEY_LINE_TRUST_SECRET||process.env.IKEY_LINE_CODE_SECRET});
require('./lib/line-notification-preferences-router')(app,{store:authStore,requireUser:requireProjectUser,sameOrigin:sameProjectOrigin});
app.get('/api/projects',requireProjectUser,async(req,res)=>{
 try{const result=await authStore.dbCall('db.select',{table:'Projects',where:{created_by_user_id:req.projectUser.user_id},limit:100});const own=(result?.rows||[]).filter(row=>row.status!=='deleted');const access=await authStore.dbCall('db.select',{table:'Project_Access',where:{entry_type:'member',user_id:req.projectUser.user_id,status:'approved'},limit:100});for(const a of access.rows||[]){if(own.some(p=>p.project_id===a.project_id))continue;const p=await authStore.dbCall('db.select',{table:'Projects',where:{project_id:a.project_id},limit:1});if(p.rows?.[0]&&p.rows[0].status!=='deleted')own.push(p.rows[0]);}return res.json({success:true,projects:own});}
 catch(err){console.warn('Project list unavailable',err.message);return res.status(503).json({success:false,message:'專案資料服務尚未就緒'});}
});
// Project settings update: owner-only, strict allowlist, verified persistence, no physical commands.
app.post('/api/projects',requireProjectUser,async(req,res)=>{
 if(!sameProjectOrigin(req))return res.status(403).json({success:false,message:'來源驗證失敗'});
 const name=typeof req.body?.project_name==='string'?req.body.project_name.trim():'';
 const description=typeof req.body?.description==='string'?req.body.description.trim():'';
 const authorization=req.body?.authorization_method;
 const schedule=req.body?.scheduled_authorization;
 const theme=req.body?.notification_theme??'midnight';
 const soundPack=req.body?.notification_sound_pack??'pulse';
 const volume=req.body?.notification_volume??50;
 const allowedThemes=['midnight','polar','emerald','copper','violet','graphite'];
 const allowedSoundPacks=['pulse','crystal','air','wood','future','click'];
 if(!name||name.length>80||description.length>1000||!['application','self_registration'].includes(authorization)||typeof schedule!=='boolean'||!allowedThemes.includes(theme)||!allowedSoundPacks.includes(soundPack)||!Number.isInteger(volume)||volume<0||volume>100)return res.status(400).json({success:false,message:'專案設定資料不正確'});
 try{
  const now=new Date().toISOString();
  const project={project_id:randomUUID(),project_name:name,description,created_by_user_id:req.projectUser.user_id,authorization_method:authorization,scheduled_authorization:String(schedule),notification_theme:theme,notification_sound_pack:soundPack,notification_volume:String(volume),status:'active',created_at:now,updated_at:now};
  const result=await authStore.dbCall('db.insert',{table:'Projects',primary_key:'project_id',data:project});
  if(result?.inserted!==true||result?.record?.project_id!==project.project_id)return res.status(503).json({success:false,message:'專案尚未成功儲存'});
  return res.status(201).json({success:true,project});
 }catch(err){console.warn('Project creation unavailable',err.message);return res.status(503).json({success:false,message:'專案資料服務尚未就緒，未確認建立成功'});}
});
// Unlock readiness is read-only. It never creates, queues or dispatches physical commands.
app.get('/api/projects/:projectId/unlock-readiness',requireProjectUser,async(req,res)=>{
 res.set('Cache-Control','no-store');
 const projectId=String(req.params.projectId||'');
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId))return res.status(400).json({success:false,code:'INVALID_PROJECT_ID'});
 try{
  const result=await authStore.dbCall('db.select',{table:'Projects',where:{project_id:projectId},limit:1});
  const project=(result?.rows||[]).find(p=>p.project_id===projectId&&p.status!=='deleted');
  if(!project)return res.status(404).json({success:false,code:'PROJECT_NOT_FOUND'});
  if(project.created_by_user_id!==req.projectUser.user_id)return res.status(403).json({success:false,code:'NOT_PROJECT_OWNER'});
  return res.json({success:true,project_id:projectId,physical_unlock_enabled:false,command_api_ready:false,device_authorization_verified:false,anti_replay_verified:false,execution_receipts_verified:false,reason:'UNLOCK_CONTROL_NOT_VERIFIED'});
 }catch(err){console.warn('Unlock readiness unavailable',err.name||'Error');return res.status(503).json({success:false,code:'UNLOCK_READINESS_UNAVAILABLE'});}
});
// Verified owner-only member baseline. Invitations and roles remain disabled until the
// membership schema and atomic authorization transactions are established.
// Device pre-registration: only verified global super admins may create devices.
// Storage must support atomic primary-key uniqueness for the Devices table.
const { randomBytes } = require('node:crypto');
const { passwordHash } = require('./gen3-auth/core');
app.post('/api/devices/pre-register',requireProjectUser,async(req,res)=>{
  if(!sameProjectOrigin(req))return res.status(403).json({success:false,message:'來源驗證失敗'});
  if(req.projectUser.global_role!=='super_admin')return res.status(403).json({success:false,message:'需要超級管理員權限'});
  const password=req.body?.password;
  if(typeof password!=='string'||password.length<8||password.length>128)
    return res.status(400).json({success:false,message:'裝置密碼須為 8 至 128 字元'});
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  try{
    const hash=passwordHash(password);
    for(let attempt=0;attempt<3;attempt++){
      const bytes=randomBytes(8);
      const device_id=Array.from(bytes,b=>alphabet[b%alphabet.length]).join('');
      const now=new Date().toISOString();
      const device={device_id,password_hash:hash,status:'pre_registered',created_by_user_id:req.projectUser.user_id,created_at:now,updated_at:now};
      try{
        const result=await authStore.dbCall('db.insert',{table:'Devices',primary_key:'device_id',data:device});
        if(result?.inserted===true&&result?.record?.device_id===device_id)
          return res.status(201).json({success:true,device_id});
        // Unknown storage response is not a verified insert.
        return res.status(503).json({success:false,message:'無法確認裝置已建立，請聯絡管理員'});
      }catch(err){
        // Do not retry ambiguous storage failures: the insert may already have committed.
        console.warn('Device pre-registration storage unavailable',err.message);
        return res.status(503).json({success:false,message:'裝置資料服務尚未就緒，請勿重複提交'});
      }
    }
    return res.status(503).json({success:false,message:'無法產生裝置 ID'});
  }catch(err){console.warn('Device pre-registration failed',err.name);return res.status(503).json({success:false,message:'裝置建立失敗'});}
});
// Read-only device list: limited to preregistered records; no secrets returned.
app.get('/api/devices',requireProjectUser,async(req,res)=>{
  if(req.projectUser.global_role!=='super_admin')return res.status(403).json({success:false,message:'需要超級管理員權限'});
  try{
    const result=await authStore.dbCall('db.select',{table:'Devices',where:{status:'pre_registered'},limit:100});
    if(!Array.isArray(result?.rows))throw Error('INVALID_DEVICE_LIST');
    const devices=result.rows.filter(r=>/^[A-HJ-NP-Z2-9]{8}$/.test(String(r.device_id||''))).map(r=>({
      device_id:String(r.device_id),registration_status:'pre_registered',connection_status:'unverified'
    }));
    return res.json({success:true,devices,limited:Boolean(result?.limited)});
  }catch(err){
    console.warn('Device list unavailable',err.message);
    return res.status(503).json({success:false,message:'裝置清單暫時無法讀取'});
  }
});
// Permanent deletion is deliberately unavailable until the storage layer supports
// an atomic physical row removal. Existing db.delete may only soft-delete records.
app.delete('/api/devices/:deviceId',requireProjectUser,async(req,res)=>{
  if(!sameProjectOrigin(req))return res.status(403).json({success:false,message:'來源驗證失敗'});
  if(req.projectUser.global_role!=='super_admin')return res.status(403).json({success:false,message:'需要超級管理員權限'});
  const id=String(req.params.deviceId||'').toUpperCase();
  if(!/^[A-HJ-NP-Z2-9]{8}$/.test(id))return res.status(400).json({success:false,message:'裝置 ID 格式不正確'});
  if(req.body?.confirm_device_id!==id)return res.status(400).json({success:false,message:'第二次確認的裝置 ID 不符'});
  return res.status(501).json({success:false,message:'永久刪除尚未啟用：資料庫需先支援實體刪除及稽核紀錄；裝置資料未變更'});
});
// Read-only device lookup for the super-admin test console.
// Device control remains disabled until authenticated device polling and acknowledgements exist.
app.get('/api/devices/:deviceId/status',requireProjectUser,async(req,res)=>{
  if(req.projectUser.global_role!=='super_admin')
    return res.status(403).json({success:false,message:'需要超級管理員權限'});
  const id=String(req.params.deviceId||'').toUpperCase();
  if(!/^[A-HJ-NP-Z2-9]{8}$/.test(id))
    return res.status(400).json({success:false,message:'裝置 ID 格式不正確'});
  try{
    const result=await authStore.dbCall('db.select',{table:'Devices',where:{device_id:id},limit:1});
    const row=(result?.rows||[]).find(item=>item.device_id===id);
    if(!row)return res.status(404).json({success:false,message:'找不到此裝置'});
    // No stored credentials or personally identifying data in the response.
    return res.json({success:true,device_id:id,registration_status:row.status||'unknown',
      connection_status:'unverified',control_ready:false});
  }catch(err){
    console.warn('Device status lookup unavailable',err.message);
    return res.status(503).json({success:false,message:'裝置資料服務尚未就緒'});
  }
});
// Project device inventory and binding: project owners/admins may bind; members can only view authorization.
async function projectDeviceContext(projectId,userId){
 const result=await authStore.dbCall('db.select',{table:'Projects',where:{project_id:projectId},limit:1});
 const project=(result.rows||[]).find(p=>p.project_id===projectId&&p.status!=='deleted');
 if(!project)return null;
 const owner=project.created_by_user_id===userId;
 const access=owner?null:(await authStore.dbCall('db.select',{table:'Project_Access',where:{project_id:projectId,user_id:userId,entry_type:'member',status:'approved'},limit:2})).rows?.[0];
 if(!owner&&!access)return {project,denied:true};
 return {project,owner,role:owner?'owner':access.role,can_manage:owner||access.role==='admin'};
}
const validProjectDeviceId=id=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
app.get('/api/projects/:projectId/settings-permissions',requireProjectUser,async(req,res)=>{
 res.set('Cache-Control','no-store');
 const id=String(req.params.projectId||'');
 if(!validProjectDeviceId(id))return res.status(400).json({success:false,code:'INVALID_PROJECT_ID'});
 try{
  const ctx=await projectDeviceContext(id,req.projectUser.user_id);
  if(!ctx)return res.status(404).json({success:false,code:'PROJECT_NOT_FOUND'});
  if(ctx.denied)return res.status(403).json({success:false,code:'NOT_PROJECT_MEMBER'});
  const canManage=ctx.can_manage===true;
  return res.json({success:true,project_id:id,role:ctx.role,permissions:{basic:canManage,auth:canManage,notify:canManage,devices:canManage,members:canManage,advanced:ctx.owner===true}});
 }catch(e){console.warn('Project settings permissions unavailable',e.message);return res.status(503).json({success:false,code:'PERMISSIONS_UNAVAILABLE'});}
});
app.get('/api/projects/:projectId/devices',requireProjectUser,async(req,res)=>{
 res.set('Cache-Control','no-store');
 const id=String(req.params.projectId||'');
 if(!validProjectDeviceId(id))return res.status(400).json({success:false,code:'INVALID_PROJECT_ID'});
 try{
  const ctx=await projectDeviceContext(id,req.projectUser.user_id);
  if(!ctx)return res.status(404).json({success:false,code:'PROJECT_NOT_FOUND'});
  if(ctx.denied)return res.status(403).json({success:false,code:'NOT_PROJECT_MEMBER'});
  const rows=await authStore.dbCall('db.select',{table:'Project_Devices',where:{project_id:id},limit:100});
  if(!Array.isArray(rows?.rows)||rows.limited)return res.status(503).json({success:false,code:'DEVICE_LIST_UNVERIFIED'});
  return res.json({success:true,can_manage:ctx.can_manage,role:ctx.role,devices:rows.rows.filter(d=>d.project_id===id&&/^[A-HJ-NP-Z2-9]{8}$/.test(String(d.device_id||''))).map(d=>({
   project_id:id,device_id:d.device_id,device_name:String(d.display_name||'iBOX').slice(0,80),
   registration_status:'pre_registered',control_ready:false,connection_status:'unverified'
  }))});
 }catch(e){console.warn('Project device list unavailable',e.message);return res.status(503).json({success:false,code:'DEVICE_LIST_UNAVAILABLE',message:'裝置清單暫時無法驗證'});}
});
app.patch('/api/projects/:projectId/devices/:deviceId/display-name',requireProjectUser,async(req,res)=>{
 res.set('Cache-Control','no-store');
 if(!sameProjectOrigin(req))return res.status(403).json({success:false,code:'INVALID_ORIGIN'});
 const projectId=String(req.params.projectId||''),deviceId=String(req.params.deviceId||'').toUpperCase();
 const name=typeof req.body?.display_name==='string'?req.body.display_name.trim():'';
 if(!validProjectDeviceId(projectId)||!/^[A-HJ-NP-Z2-9]{8}$/.test(deviceId)||!name||name.length>80||/[\\x00-\\x1f]/.test(name))
  return res.status(400).json({success:false,code:'INVALID_DISPLAY_NAME',message:'名稱需為 1～80 個字元'});
 try{
  const ctx=await projectDeviceContext(projectId,req.projectUser.user_id);
  if(!ctx)return res.status(404).json({success:false,code:'PROJECT_NOT_FOUND'});
  if(!ctx.can_manage)return res.status(403).json({success:false,code:'NOT_PROJECT_ADMIN'});
  const result=await authStore.dbCall('db.update',{table:'Project_Devices',where:{project_id:projectId,device_id:deviceId},data:{display_name:name,updated_at:new Date().toISOString()}});
  if(result.count!==1)return res.status(404).json({success:false,code:'DEVICE_NOT_BOUND',message:'找不到專案綁定裝置'});
  return res.json({success:true,device_id:deviceId,display_name:name});
 }catch(e){console.warn('Device rename failed',e.message);return res.status(503).json({success:false,code:'RENAME_UNAVAILABLE',message:'裝置名稱更新失敗'});}
});
app.get('/api/projects/:projectId/devices/available',requireProjectUser,async(req,res)=>{
 res.set('Cache-Control','no-store');
 const id=String(req.params.projectId||'');
 if(!validProjectDeviceId(id))return res.status(400).json({success:false,code:'INVALID_PROJECT_ID'});
 try{
  const ctx=await projectDeviceContext(id,req.projectUser.user_id);
  if(!ctx)return res.status(404).json({success:false,code:'PROJECT_NOT_FOUND'});
  if(!ctx.can_manage)return res.status(403).json({success:false,code:'NOT_PROJECT_ADMIN'});
  const devices=await authStore.dbCall('db.select',{table:'Devices',where:{status:'pre_registered'},limit:100});
  const bound=await authStore.dbCall('db.select',{table:'Project_Devices',where:{project_id:id},limit:100});
  if(devices.limited||bound.limited)return res.status(503).json({success:false,code:'INVENTORY_LIMIT'});
  const attached=new Set((bound.rows||[]).map(x=>x.device_id));
  return res.json({success:true,devices:(devices.rows||[]).filter(x=>/^[A-HJ-NP-Z2-9]{8}$/.test(String(x.device_id||''))).map(x=>({device_id:x.device_id,registration_status:'pre_registered',connection_status:'unverified',already_added:attached.has(x.device_id)}))});
 }catch(e){console.warn('Available device inventory unavailable',e.message);return res.status(503).json({success:false,message:'無法讀取預登錄裝置'});}
});
app.post('/api/projects/:projectId/devices/bind',requireProjectUser,async(req,res)=>{
 if(!sameProjectOrigin(req))return res.status(403).json({success:false,code:'INVALID_ORIGIN'});
 const projectId=String(req.params.projectId||''),deviceId=String(req.body?.device_id||'').toUpperCase();
 if(!validProjectDeviceId(projectId)||!/^[A-HJ-NP-Z2-9]{8}$/.test(deviceId))
  return res.status(400).json({success:false,code:'INVALID_BINDING'});
 try{
  const ctx=await projectDeviceContext(projectId,req.projectUser.user_id);
  if(!ctx)return res.status(404).json({success:false,code:'PROJECT_NOT_FOUND'});
  if(!ctx.can_manage)return res.status(403).json({success:false,code:'NOT_PROJECT_ADMIN'});
  const device=(await authStore.dbCall('db.select',{table:'Devices',where:{device_id:deviceId},limit:1})).rows?.[0];
  if(!device||device.status!=='pre_registered')return res.status(404).json({success:false,code:'DEVICE_NOT_AVAILABLE'});
  const exists=await authStore.dbCall('db.select',{table:'Project_Devices',where:{project_id:projectId,device_id:deviceId},limit:1});
  if(exists.rows?.length)return res.status(409).json({success:false,code:'DEVICE_ALREADY_BOUND',message:'此裝置已加入專案'});
  const now=new Date().toISOString();
  const result=await authStore.dbCall('db.insert',{table:'Project_Devices',primary_key:'binding_id',data:{
   binding_id:randomUUID(),project_id:projectId,device_id:deviceId,
   display_name:String(req.body?.display_name||'iBOX').slice(0,80),
   lock_mode:'manual',heartbeat_interval_minutes:'5',auto_firmware_update:'false',
   bound_by:req.projectUser.user_id,bound_at:now,updated_at:now
  }});
  if(!result.inserted)return res.status(503).json({success:false,code:'BINDING_UNAVAILABLE'});
  return res.status(201).json({success:true,binding_id:result.record.binding_id,device_id:deviceId});
 }catch(e){
  if(e.message==='SUPABASE_DUPLICATE_KEY')return res.status(409).json({success:false,code:'DEVICE_ALREADY_BOUND',message:'此裝置已加入專案'});
  console.warn('Device binding unavailable',e.message);
  return res.status(503).json({success:false,code:'BINDING_UNAVAILABLE',message:'無法加入裝置'});
 }
});
app.delete('/api/projects/:projectId/devices/:deviceId/binding',requireProjectUser,async(req,res)=>{
 if(!sameProjectOrigin(req))return res.status(403).json({success:false,code:'INVALID_ORIGIN'});
 const projectId=String(req.params.projectId||''),deviceId=String(req.params.deviceId||'').toUpperCase();
 if(!validProjectDeviceId(projectId)||!/^[A-HJ-NP-Z2-9]{8}$/.test(deviceId)||req.body?.confirm_device_id!==deviceId)
  return res.status(400).json({success:false,code:'INVALID_UNBIND_REQUEST'});
 try{
  const ctx=await projectDeviceContext(projectId,req.projectUser.user_id);
  if(!ctx)return res.status(404).json({success:false,code:'PROJECT_NOT_FOUND'});
  if(!ctx.can_manage)return res.status(403).json({success:false,code:'NOT_PROJECT_ADMIN'});
  const result=await authStore.dbCall('db.delete',{table:'Project_Devices',where:{project_id:projectId,device_id:deviceId}});
  return res.json({success:true,removed:result.count});
 }catch(e){return res.status(503).json({success:false,code:'UNBIND_UNAVAILABLE'});}
});
// Fail closed: never acknowledge an unlock until device execution receipts are verified.
app.post('/api/projects/:projectId/devices/:deviceId/unlock',requireProjectUser,(req,res)=>{
 res.set('Cache-Control','no-store');
 if(!sameProjectOrigin(req))return res.status(403).json({success:false,code:'INVALID_ORIGIN'});
 return res.status(503).json({success:false,code:'UNLOCK_EXECUTION_NOT_READY',message:'實體開鎖回報尚未串接，未發送開鎖指令'});
});
// Reserved authenticated device command API. No physical action is possible
// until durable GAS command storage, device authentication and replay safety pass.
app.post('/api/devices/:deviceId/commands',requireProjectUser,(req,res)=>{
 res.set('Cache-Control','no-store');
 if(!sameProjectOrigin(req)||req.projectUser.global_role!=='super_admin')
  return res.status(403).json({success:false,code:'NOT_AUTHORIZED'});
 if(!/^[A-HJ-NP-Z2-9]{8}$/.test(String(req.params.deviceId||'')))
  return res.status(400).json({success:false,code:'INVALID_DEVICE_ID'});
 return res.status(503).json({success:false,code:'COMMAND_BACKEND_NOT_READY',
  message:'裝置指令服務尚未啟用，未送出任何控制指令'});
});
// Opt-in, authenticated, non-actuating GAS signature probe. No create/claim/report.
app.post('/api/admin/command-probe',requireProjectUser,async(req,res)=>{
 res.set('Cache-Control','no-store');
 if(process.env.IKEY_COMMAND_PROBE_ENABLED!=='true')
  return res.status(404).json({success:false,code:'PROBE_DISABLED'});
 if(!sameProjectOrigin(req)||req.projectUser.global_role!=='super_admin')
  return res.status(403).json({success:false,code:'NOT_AUTHORIZED'});
 if(!authStore||typeof authStore.commandProbe!=='function')
  return res.status(503).json({success:false,code:'PROBE_UNAVAILABLE'});
 const project_id=req.body?.project_id;
 const device_id=req.body?.device_id;
 if(!req.body||Object.keys(req.body).sort().join(',')!=='device_id,project_id')
  return res.status(400).json({success:false,code:'INVALID_PROBE_INPUT'});
 if(typeof project_id!=='string'||typeof device_id!=='string')
  return res.status(400).json({success:false,code:'INVALID_PROBE_INPUT'});
 try{
  // GAS independently enforces project ownership and device binding.
  // Random nonexistent command ID ensures this endpoint cannot fetch live commands.
  await authStore.commandProbe({project_id,device_id,
   actor_user_id:req.projectUser.user_id,command_id:randomUUID()});
  return res.json({success:true,code:'PROBE_ACCEPTED'});
 }catch(err){
  console.warn('Command probe rejected',String(err.message||'').slice(0,90));
  return res.status(409).json({success:false,code:'PROBE_REJECTED'});
 }
});
// Read-only account directory. Authorize on the server, never trust UI role claims.
app.get('/api/admin/accounts',requireProjectUser,async(req,res)=>{
 res.set('Cache-Control','no-store');
 if(req.projectUser.global_role!=='super_admin')return res.status(403).json({success:false,message:'需要超級管理員權限'});
 try{
  const result=await authStore.adminAccountList(req.projectSessionHash);
  const userRows=Array.isArray(result)?result:(Array.isArray(result?.accounts)?result.accounts:null);
  if(!userRows)throw Error('INVALID_ADMIN_ACCOUNT_LIST');
  const accounts=userRows.map(u=>({user_id:String(u.user_id||''),username:String(u.username||''),display_name:String(u.display_name||''),global_role:String(u.global_role||'user'),account_status:String(u.account_status||'unknown'),created_at:String(u.created_at||'')}));
  return res.json({success:true,accounts,limited:Boolean(result?.limited)});
 }catch(err){console.warn('Admin directory unavailable',err.message);return res.status(503).json({success:false,message:'帳號資料服務尚未就緒'});}
});
// Mutations require an authenticated super-admin, same-origin request, and explicit confirmation.
app.post('/api/admin/accounts/action',requireProjectUser,async(req,res)=>{
 res.set('Cache-Control','no-store');
 if(req.projectUser.global_role!=='super_admin')return res.status(403).json({success:false,message:'需要超級管理員權限'});
 if(!sameProjectOrigin(req)||req.get('sec-fetch-site')==='cross-site')return res.status(403).json({success:false,message:'來源驗證失敗'});
 const {action,target_user_id,status,password,confirm}=req.body||{};
 const permitted=['adminAccountSetStatus','adminAccountRevokeSessions','adminAccountResetPassword'];
 if(!permitted.includes(action)||confirm!==true)return res.status(400).json({success:false,message:'操作未確認或不允許'});
 if(typeof target_user_id!=='string'||!/^[0-9a-f-]{36}$/i.test(target_user_id))return res.status(400).json({success:false,message:'帳號識別碼無效'});
 if(target_user_id===req.projectUser.user_id)return res.status(403).json({success:false,message:'不可操作自己的帳號'});
 // Fail closed for protected super-admin targets even if the UI is bypassed.
 try {
  const directory=await authStore.adminAccountList(req.projectSessionHash);
  const entries=Array.isArray(directory?.accounts)?directory.accounts:[];
  const target=entries.find(u=>u.user_id===target_user_id);
  if(!target)return res.status(409).json({success:false,message:'無法確認目標帳號，操作已取消'});
  if(target.global_role==='super_admin')return res.status(403).json({success:false,message:'不可操作超級管理員帳號'});
 }catch{return res.status(503).json({success:false,message:'無法驗證目標帳號，操作已取消'});}
 const payload={actor_session_hash:req.projectSessionHash,target_user_id};
 if(action==='adminAccountSetStatus'){
  if(!['active','disabled'].includes(status))return res.status(400).json({success:false,message:'帳號狀態無效'});
  payload.status=status;
 }
 if(action==='adminAccountResetPassword'){
  if(typeof password!=='string'||password.length<8||password.length>128)return res.status(400).json({success:false,message:'密碼長度須為 8 至 128 字元'});
  payload.password_hash=require('./gen3-auth/core').passwordHash(password);
 }
 try{
  // GAS independently validates the actor, target, and audit trail.
  const result=await authStore.adminAccountAction(action,payload);
  return res.json({success:true,target:result.target,revoked_sessions:result.revoked_sessions});
 }catch(err){
  console.warn('Admin account mutation failed',action,String(err.message||'').slice(0,120));
  return res.status(409).json({success:false,message:'操作未完成，請確認帳號狀態及管理權限'});
 }
});
// System announcements: public reads and authenticated super-admin management.
const { createAnnouncementRouter } = require('./gen3-auth/announcement-router');
app.use('/api', createAnnouncementRouter(authStore));
app.use('/api', (_req, res) => res.status(404).json({ ok: false, code: 'NOT_FOUND' }));
// Guard management HTML on the server as well as the navigation. Static assets
// are not authorization boundaries; every management API must verify its own actor.
const protectedAdminPages = new Set([
  '/super-admin.html', '/admin-accounts.html', '/admin-accounts-preview.html'
]);
app.use(async (req,res,next)=>{
  if(req.method!=='GET' && req.method!=='HEAD')return next();
  const requested=req.path.toLowerCase().replace(/\/+$/,'');
  if(!protectedAdminPages.has(requested))return next();
  res.set('Cache-Control','no-store');
  if(!authStore)return res.status(503).send('管理服務尚未就緒');
  try{
    const raw=String(req.headers.cookie||'').split(';').map(x=>x.trim())
      .find(x=>x.startsWith('ikey_gen3_session='))?.slice('ikey_gen3_session='.length);
    if(!raw||raw.length>256)return res.redirect(302,'/');
    const resolved=await authStore.resolveSession(hashToken(raw));
    if(!resolved||resolved.session.revoked_at||
       Date.parse(resolved.session.expires_at)<=Date.now()||!active(resolved.user))
      return res.redirect(302,'/');
    if(resolved.user.global_role!=='super_admin')return res.status(403).send('無權存取管理頁面');
    return next();
  }catch(error){
    console.warn('Admin page authorization unavailable',error.name||'error');
    return res.status(503).send('暫時無法驗證管理權限');
  }
});
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));
app.use((_err, _req, res, _next) => res.status(400).json({ ok: false, code: 'BAD_REQUEST' }));

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => console.log('iKey 3.1 API listening on ' + port));
}
module.exports = app;
