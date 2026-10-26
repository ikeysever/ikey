'use strict';
const express = require('express');
const path = require('node:path');
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
// Server-side API request timing and per-minute counts; no credentials or payloads logged.
const requestMinuteStats = new Map();
app.use('/api', (req, res, next) => {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
    const minute = Math.floor(Date.now() / 60000);
    const key = minute + ':' + req.method + ':' + req.path;
    const stat = requestMinuteStats.get(key) || { count: 0, totalMs: 0, maxMs: 0, errors: 0 };
    stat.count++;
    stat.totalMs += elapsedMs;
    stat.maxMs = Math.max(stat.maxMs, elapsedMs);
    if (res.statusCode >= 400) stat.errors++;
    requestMinuteStats.set(key, stat);
    if (elapsedMs >= 3000) console.info('API slow request', req.method, req.path.split('?')[0], res.statusCode, Math.round(elapsedMs) + 'ms');
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

app.get('/ping', (_req, res) => res.status(200).json({ ok: true, service: 'ikey', version: '3.1' }));
app.get('/api/health', (_req, res) => res.status(200).json({ ok: true, service: 'ikey-api', version: '3.1' }));
// Fail closed until the existing Gen3 Apps Script and its schema are verified.
let authStore = null;
try {
  const { createSheetsStore } = require('./gen3-auth/sheets-store');
  authStore = createSheetsStore();
} catch (error) {
  console.warn('Gen3 authentication storage is not configured:', error.message);
}
const { createRouter } = require('./gen3-auth/routes');
app.get('/api/auth/status', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!authStore) return res.json({ ready: false, enabled: false, registration: false, reason: 'CONFIG_MISSING' });
  try {
    const health = await authStore.health();
    const ready = health?.storage === true && health?.version === 'gen3-username-v3';
    return res.json({ ready, enabled: ready, registration: ready, reason: ready ? null : 'SCHEMA_NOT_READY' });
  } catch (_error) {
    return res.json({ ready: false, enabled: false, registration: false, reason: 'STORAGE_UNAVAILABLE' });
  }
});
app.use('/api/auth', createRouter(authStore));
// Project operations are always scoped to the authenticated account on the server.
const { hashToken, active } = require('./gen3-auth/core');
const { randomUUID, randomBytes, createHash } = require('node:crypto');
async function requireProjectUser(req,res,next){
  res.set('Cache-Control','no-store');
  if(!authStore)return res.status(503).json({success:false,message:'專案服務尚未就緒'});
  try{
    const raw=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('ikey_gen3_session='))?.slice('ikey_gen3_session='.length);
    if(!raw||raw.length>256)return res.status(401).json({success:false,message:'請先登入'});
    const resolved=await authStore.resolveSession(hashToken(raw));
    if(!resolved||resolved.session.revoked_at||Date.parse(resolved.session.expires_at)<=Date.now()||!active(resolved.user))return res.status(401).json({success:false,message:'登入已失效'});
    req.projectUser=resolved.user;next();
  }catch{return res.status(503).json({success:false,message:'無法驗證登入狀態'});}
}
function sameProjectOrigin(req){
 const origin=req.get('origin');if(!origin)return true;
 try{const u=new URL(origin);const proto=req.secure||req.get('x-forwarded-proto')==='https'?'https:':'http:';return u.protocol===proto&&u.host===req.get('host');}catch{return false;}
}
// Deployment readiness: verifies the live GAS has BOTH project schemas.
// Does not return credentials, sheet IDs, or underlying provider error strings.
app.get('/api/projects/readiness',async(_req,res)=>{
 res.set('Cache-Control','no-store');
 if(!authStore)return res.status(503).json({ready:false,component:'projects'});
 try{
  const check=await authStore.dbCall('db.health',{});
  const ready=check?.ready===true&&check?.version==='ikey-projects-v1'&&check?.access_schema==='project-access-v1';
  return res.status(ready?200:503).json({ready,component:'projects',version:ready?'ikey-projects-v1':null});
 }catch(error){
  console.warn('Project readiness failed',error.name||'unknown');
  return res.status(503).json({ready:false,component:'projects'});
 }
});
// Factory device preregistration. All writes fail closed until the GAS adapter implements
// the dedicated atomic factoryDeviceRegister / factoryDeviceBind operations.
const { scryptSync, timingSafeEqual } = require('node:crypto');
const factoryAttempts = new Map();
function factoryRateLimit(req,res,next){
 const key=String(req.projectUser.user_id)+'|'+req.ip;
 const now=Date.now();let v=factoryAttempts.get(key);
 if(!v||v.until<=now)v={count:0,until:now+60000};
 if(v.count>=5)return res.status(429).json({success:false,message:'操作過於頻繁，請稍後再試'});
 v.count++;factoryAttempts.set(key,v);
 if(factoryAttempts.size>2000)for(const [k,x] of factoryAttempts)if(x.until<=now)factoryAttempts.delete(k);
 next();
}
function isFactorySuperAdmin(user){
 const ids=(process.env.IKEY_SUPER_ADMIN_USER_IDS||'').split(',').map(x=>x.trim()).filter(Boolean);
 return ids.length>0&&ids.includes(String(user.user_id));
}
function factoryId(value){return typeof value==='string'&&/^[A-Za-z0-9_-]{6,64}$/.test(value);}
function factoryPassword(value){return typeof value==='string'&&value.length>=16&&value.length<=128;}
app.post('/api/admin/factory-devices',requireProjectUser,factoryRateLimit,async(req,res)=>{
 if(!sameProjectOrigin(req))return res.status(403).json({success:false,message:'來源驗證失敗'});
 if(!isFactorySuperAdmin(req.projectUser))return res.status(403).json({success:false,message:'僅限超級管理員'});
 const b=req.body;
 if(!b||Array.isArray(b)||Object.keys(b).sort().join(',')!=='device_id,password'||!factoryId(b.device_id)||!factoryPassword(b.password))return res.status(400).json({success:false,message:'裝置 ID 或密碼格式錯誤（密碼至少 16 字元）'});
 const salt=randomBytes(32);const hash=scryptSync(b.password,salt,64,{N:16384,r:8,p:1});
 try{
  const result=await authStore.projectCall('factoryDeviceRegister',{actor_user_id:req.projectUser.user_id,device_id:b.device_id,credential_kdf:'scrypt-n16384-r8-p1',credential_salt:salt.toString('hex'),credential_hash:hash.toString('hex')});
  if(!result?.registered)return res.status(409).json({success:false,message:'裝置已存在或尚未完成登錄'});
  return res.status(201).json({success:true,device_id:b.device_id});
 }catch(e){console.warn('Factory registration unavailable',e.name||'unknown');return res.status(503).json({success:false,message:'出廠裝置資料服務尚未就緒'});}
});
app.post('/api/projects/:id/devices/bind',requireProjectUser,factoryRateLimit,async(req,res)=>{
 if(!sameProjectOrigin(req))return res.status(403).json({success:false,message:'來源驗證失敗'});
 const projectId=String(req.params.id||''),b=req.body;
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(projectId)||!b||Array.isArray(b)||Object.keys(b).sort().join(',')!=='device_id,password'||!factoryId(b.device_id)||!factoryPassword(b.password))return res.status(400).json({success:false,message:'參數格式錯誤'});
 try{
  const project=await authStore.projectCall('projectAccessGet',{actor_user_id:req.projectUser.user_id,project_id:projectId});
  if(!project||project.project_role!=='admin')return res.status(403).json({success:false,message:'僅限專案管理員'});
  const credential=await authStore.projectCall('factoryDeviceCredentialGet',{actor_user_id:req.projectUser.user_id,device_id:b.device_id});
  if(!credential||credential.credential_kdf!=='scrypt-n16384-r8-p1'||!/^([a-f0-9]{64})$/.test(credential.credential_salt||'')||!/^([a-f0-9]{128})$/.test(credential.credential_hash||''))return res.status(403).json({success:false,message:'裝置 ID 或密碼無效'});
  const candidate=scryptSync(b.password,Buffer.from(credential.credential_salt,'hex'),64,{N:16384,r:8,p:1});
  const expected=Buffer.from(credential.credential_hash,'hex');
  if(!timingSafeEqual(candidate,expected))return res.status(403).json({success:false,message:'裝置 ID 或密碼無效'});
  const result=await authStore.projectCall('factoryDeviceBind',{actor_user_id:req.projectUser.user_id,project_id:projectId,device_id:b.device_id});
  if(!result?.bound)return res.status(409).json({success:false,message:'裝置已綁定或目前無法綁定'});
  return res.status(201).json({success:true,device_id:b.device_id,project_id:projectId});
 }catch(e){console.warn('Device binding unavailable',e.name||'unknown');return res.status(503).json({success:false,message:'裝置綁定服務尚未就緒'});}
});
app.get('/api/projects/:id/devices',requireProjectUser,async(req,res)=>{
 const id=String(req.params.id||'');
 if(!/^[0-9a-f-]{36}$/i.test(id))return res.status(400).json({success:false,message:'專案 ID 格式錯誤'});
 try{
  const project=await authStore.projectCall('projectAccessGet',{actor_user_id:req.projectUser.user_id,project_id:id});
  if(!project||project.project_role!=='admin')return res.status(403).json({success:false,message:'僅限專案管理員'});
  const result=await authStore.projectCall('factoryDeviceList',{actor_user_id:req.projectUser.user_id,project_id:id});
  if(!Array.isArray(result?.devices))throw Error('INVALID_DEVICE_LIST');
  const devices=result.devices.map(d=>({device_id:d.device_id,display_name:d.display_name,lock_mode:d.lock_mode,heartbeat_interval_minutes:d.heartbeat_interval_minutes,auto_firmware_update:d.auto_firmware_update,bound_at:d.bound_at}));
  return res.json({success:true,devices});
 }catch(e){console.warn('Device list unavailable',e.name||'unknown');return res.status(503).json({success:false,message:'裝置清單服務尚未就緒'});}
});
app.get('/api/projects',requireProjectUser,async(req,res)=>{
 try{const result=await authStore.projectCall('projectAccessMine',{actor_user_id:req.projectUser.user_id});if(!Array.isArray(result?.projects))throw Error('PROJECT_LIST_INVALID');return res.json({success:true,projects:result.projects});}
 catch(err){console.warn('Project list unavailable',err.message);return res.status(503).json({success:false,message:'專案資料服務尚未就緒'});}
});
// Fetch one project with server-side ownership checks; never expose other users' projects.
app.get('/api/projects/:id',requireProjectUser,async(req,res)=>{
 const id=String(req.params.id||'');
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id))return res.status(400).json({success:false,message:'專案 ID 格式錯誤'});
 try{
  const project=await authStore.projectCall('projectAccessGet',{actor_user_id:req.projectUser.user_id,project_id:id});
  if(!project)return res.status(404).json({success:false,message:'找不到專案或無存取權限'});
  return res.json({success:true,project});
 }catch(err){console.warn('Project details unavailable',err.message);return res.status(503).json({success:false,message:'專案資料服務暫時無法使用'});}
});
app.patch('/api/projects/:id/other-settings',requireProjectUser,async(req,res)=>{
 if(!sameProjectOrigin(req))return res.status(403).json({success:false,message:'來源驗證失敗'});
 const id=String(req.params.id||''),body=req.body;
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id))return res.status(400).json({success:false,message:'專案 ID 格式錯誤'});
 if(!body||typeof body!=='object'||Array.isArray(body)||!Object.keys(body).length||
    Object.keys(body).some(k=>!['status','authorization_method','scheduled_authorization'].includes(k)))return res.status(400).json({success:false,message:'不支援的設定欄位'});
 const changes={};
 if('status'in body){if(!['active','inactive'].includes(body.status))return res.status(400).json({success:false,message:'狀態無效'});changes.status=body.status;}
 if('authorization_method'in body){if(!['application','self_registration'].includes(body.authorization_method))return res.status(400).json({success:false,message:'授權方式無效'});changes.authorization_method=body.authorization_method;}
 if('scheduled_authorization'in body){if(typeof body.scheduled_authorization!=='boolean')return res.status(400).json({success:false,message:'排程授權必須是布林值'});changes.scheduled_authorization=String(body.scheduled_authorization);}
 try{
  const result=await authStore.projectCall('projectSettingsUpdate',{actor_user_id:req.projectUser.user_id,project_id:id,changes});
  if(!result?.updated||!result.project)return res.status(503).json({success:false,message:'資料庫未確認儲存'});
  return res.json({success:true,project:result.project});
 }catch(err){console.warn('Other project settings unavailable',err.message);return res.status(503).json({success:false,message:'設定無法儲存，請確認管理員權限及資料庫版本'});}
});
// Invite codes are high-entropy bearer secrets: they are returned once, never stored in cleartext.
const inviteAttempts=new Map();
function limitProjectAccess(req,res,next){
 const key=req.projectUser.user_id+'|'+req.path;
 const now=Date.now(),previous=inviteAttempts.get(key);
 const state=!previous||now>=previous.until?{count:0,until:now+60000}:previous;
 if(state.count>=10){res.set('Retry-After',String(Math.ceil((state.until-now)/1000)));return res.status(429).json({success:false,message:'請求太頻繁，請稍後再試'});}
 state.count++;inviteAttempts.set(key,state);
 if(inviteAttempts.size>1500)for(const [id,item] of inviteAttempts)if(item.until<=now)inviteAttempts.delete(id);
 next();
}
app.post('/api/projects/join',requireProjectUser,limitProjectAccess,async(req,res)=>{
 if(!sameProjectOrigin(req))return res.status(403).json({success:false,message:'來源驗證失敗'});
 const code=req.body?.invite_code;
 if(!req.body||typeof req.body!=='object'||Array.isArray(req.body)||Object.keys(req.body).length!==1||typeof code!=='string'||!/^[A-Za-z0-9_-]{24}$/.test(code))return res.status(400).json({success:false,message:'邀請碼格式不正確'});
 try{
  const hash=createHash('sha256').update(code).digest('hex');
  const result=await authStore.projectCall('projectAccessJoin',{actor_user_id:req.projectUser.user_id,invite_hash:hash});
  if(!result?.joined){
   if(result?.reason==='ALREADY_OWNER')return res.status(409).json({success:false,message:'你已經是此專案的建立者'});
   return res.status(404).json({success:false,message:'邀請碼無效，或該專案目前無法加入'});
  }
  return res.status(result.status==='pending'?202:200).json({success:true,project_id:result.project_id,project_name:result.project_name,status:result.status,already_member:Boolean(result.already_member)});
 }catch(err){console.warn('Project joining unavailable',err.message);return res.status(503).json({success:false,message:'加入專案服務暫時無法使用'});}
});
app.post('/api/projects/:id/invite',requireProjectUser,limitProjectAccess,async(req,res)=>{
 if(!sameProjectOrigin(req))return res.status(403).json({success:false,message:'來源驗證失敗'});
 const id=String(req.params.id||''),policy=req.body?.join_policy;
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)||!req.body||typeof req.body!=='object'||Array.isArray(req.body)||Object.keys(req.body).join(',')!=='join_policy'||!['direct','approval'].includes(policy))return res.status(400).json({success:false,message:'專案或加入方式不正確'});
 const code=randomBytes(18).toString('base64url');
 try{
  const result=await authStore.projectCall('projectAccessConfigure',{actor_user_id:req.projectUser.user_id,project_id:id,join_policy:policy,invite_hash:createHash('sha256').update(code).digest('hex')});
  if(!result?.configured)return res.status(503).json({success:false,message:'邀請碼未確認儲存'});
  return res.json({success:true,project_id:id,join_policy:policy,invite_code:code,message:'邀請碼只顯示一次。產生新邀請碼會使舊邀請碼失效。'});
 }catch(err){console.warn('Project invite setup unavailable',err.message);return res.status(503).json({success:false,message:'邀請設定暫時無法使用，請確認你是專案建立者'});}
});
app.get('/api/projects/:id/access',requireProjectUser,async(req,res)=>{
 const id=String(req.params.id||'');
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id))return res.status(400).json({success:false,message:'專案 ID 格式錯誤'});
 try{
  const result=await authStore.projectCall('projectAccessList',{actor_user_id:req.projectUser.user_id,project_id:id});
  if(!Array.isArray(result?.members))throw Error('ACCESS_LIST_INVALID');
  return res.json({success:true,join_policy:result.join_policy,members:result.members});
 }catch(err){console.warn('Project member listing unavailable',err.message);return res.status(503).json({success:false,message:'成員清單暫時無法使用，或沒有管理員權限'});}
});
app.post('/api/projects/:id/access/:entryId/review',requireProjectUser,limitProjectAccess,async(req,res)=>{
 if(!sameProjectOrigin(req))return res.status(403).json({success:false,message:'來源驗證失敗'});
 const id=String(req.params.id||''),entryId=String(req.params.entryId||''),decision=req.body?.decision;
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)||!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(entryId)||
  !req.body||typeof req.body!=='object'||Array.isArray(req.body)||Object.keys(req.body).join(',')!=='decision'||!['approve','reject'].includes(decision))return res.status(400).json({success:false,message:'審核資料不正確'});
 try{
  const result=await authStore.projectCall('projectAccessReview',{actor_user_id:req.projectUser.user_id,project_id:id,entry_id:entryId,decision});
  if(!result?.reviewed)return res.status(409).json({success:false,message:'這筆申請已被處理或不存在'});
  return res.json({success:true,entry_id:entryId,status:result.status});
 }catch(err){console.warn('Project member review unavailable',err.message);return res.status(503).json({success:false,message:'無法完成審核，請確認管理員權限'});}
});
// P1: update only existing project settings; ownership is verified server-side.
app.patch('/api/projects/:id',requireProjectUser,async(req,res)=>{
 if(!sameProjectOrigin(req))return res.status(403).json({success:false,message:'來源驗證失敗'});
 const id=String(req.params.id||'');
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id))return res.status(400).json({success:false,message:'專案 ID 格式錯誤'});
 const allowed=['project_name','description','notification_theme','notification_sound_pack','notification_volume'];
 const body=req.body;
 if(!body||typeof body!=='object'||Array.isArray(body)||!Object.keys(body).length||Object.keys(body).some(k=>!allowed.includes(k)))return res.status(400).json({success:false,message:'不支援的設定欄位'});
 const updates={};
 if('project_name'in body){if(typeof body.project_name!=='string'||!body.project_name.trim()||body.project_name.trim().length>80)return res.status(400).json({success:false,message:'專案名稱不正確'});updates.project_name=body.project_name.trim();}
 if('description'in body){if(typeof body.description!=='string'||body.description.length>1000)return res.status(400).json({success:false,message:'專案說明過長'});updates.description=body.description.trim();}
 if('notification_theme'in body){if(!['midnight','polar','emerald','copper','violet','graphite'].includes(body.notification_theme))return res.status(400).json({success:false,message:'視覺風格不正確'});updates.notification_theme=body.notification_theme;}
 if('notification_sound_pack'in body){if(!['pulse','crystal','air','wood','future','click'].includes(body.notification_sound_pack))return res.status(400).json({success:false,message:'音效風格不正確'});updates.notification_sound_pack=body.notification_sound_pack;}
 if('notification_volume'in body){if(!Number.isInteger(body.notification_volume)||body.notification_volume<0||body.notification_volume>100)return res.status(400).json({success:false,message:'音量不正確'});updates.notification_volume=String(body.notification_volume);}
 try{
  const found=await authStore.dbCall('db.select',{table:'Projects',where:{project_id:id,created_by_user_id:req.projectUser.user_id},limit:1});
  const existing=(found?.rows||[]).find(p=>p.project_id===id&&p.created_by_user_id===req.projectUser.user_id&&p.status!=='deleted');
  if(!existing)return res.status(404).json({success:false,message:'找不到專案或無修改權限'});
  updates.updated_at=new Date().toISOString();
  const changed=await authStore.dbCall('db.update',{table:'Projects',where:{project_id:id,created_by_user_id:req.projectUser.user_id},data:updates});
  // GAS adapters may return different update envelopes. Read back the persisted row
  // rather than trusting a particular response field or reporting a false success.
  if(!changed)return res.status(503).json({success:false,message:'資料庫未確認更新請求'});
  const check=await authStore.dbCall('db.select',{table:'Projects',where:{project_id:id,created_by_user_id:req.projectUser.user_id},limit:1});
  const persisted=(check?.rows||[]).find(p=>p.project_id===id&&p.created_by_user_id===req.projectUser.user_id&&p.status!=='deleted');
  if(!persisted||Object.entries(updates).filter(([key])=>key!=='updated_at').some(([key,value])=>String(persisted[key]??'')!==String(value)))return res.status(503).json({success:false,message:'設定未通過資料庫寫入覆核，請重新整理確認'});
  return res.json({success:true,project_id:id,project:persisted});
 }catch(err){console.warn('Project settings unavailable',err.message);return res.status(503).json({success:false,message:'設定儲存服務暫時無法使用'});}
});
// Destructive actions use a dedicated per-account limiter in addition to origin checks.
const projectDeleteAttempts=new Map();
function limitProjectDelete(req,res,next){
 const key=req.projectUser.user_id;
 const now=Date.now();
 const previous=projectDeleteAttempts.get(key);
 const state=!previous||now>=previous.until?{count:0,until:now+60000}:previous;
 if(state.count>=5){res.set('Retry-After',String(Math.ceil((state.until-now)/1000)));return res.status(429).json({success:false,message:'刪除確認嘗試過於頻繁，請稍後再試'});}
 state.count++;
 projectDeleteAttempts.set(key,state);
 if(projectDeleteAttempts.size>1000)for(const [id,b] of projectDeleteAttempts)if(b.until<=now)projectDeleteAttempts.delete(id);
 next();
}
// Soft-delete only: ownership, same-origin, exact name and an explicit second confirmation are required.
app.post('/api/projects/:id/delete',requireProjectUser,limitProjectDelete,async(req,res)=>{
 if(!sameProjectOrigin(req))return res.status(403).json({success:false,message:'來源驗證失敗'});
 const id=String(req.params.id||'');
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id))return res.status(400).json({success:false,message:'專案 ID 格式錯誤'});
 const body=req.body;
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join(',')!=='confirmation,project_name'||body.confirmation!=='DELETE_PROJECT'||typeof body.project_name!=='string')return res.status(400).json({success:false,message:'必須完成兩次刪除確認'});
 try{
  const where={project_id:id,created_by_user_id:req.projectUser.user_id};
  const found=await authStore.dbCall('db.select',{table:'Projects',where,limit:1});
  const project=(found?.rows||[]).find(p=>p.project_id===id&&p.created_by_user_id===req.projectUser.user_id&&p.status==='active');
  if(!project)return res.status(404).json({success:false,message:'找不到可刪除的專案或權限不足'});
  if(body.project_name!==project.project_name)return res.status(409).json({success:false,message:'專案名稱不符，請重新確認'});
  const updated=await authStore.dbCall('db.update',{table:'Projects',where:{...where,status:'active'},data:{status:'deleted',updated_at:new Date().toISOString()}});
  if(!updated)return res.status(503).json({success:false,message:'資料庫未確認刪除狀態'});
  const verified=await authStore.dbCall('db.select',{table:'Projects',where,limit:1});
  const record=(verified?.rows||[]).find(p=>p.project_id===id&&p.created_by_user_id===req.projectUser.user_id);
  if(!record||record.status!=='deleted')return res.status(503).json({success:false,message:'刪除狀態未通過資料庫覆核'});
  return res.json({success:true,project_id:id,deleted:true,mode:'soft_delete'});
 }catch(err){console.warn('Project soft deletion unavailable',err.message);return res.status(503).json({success:false,message:'刪除服務暫時無法使用'});}
});
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
app.use('/api', (_req, res) => res.status(404).json({ ok: false, code: 'NOT_FOUND' }));
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));
app.use((_err, _req, res, _next) => res.status(400).json({ ok: false, code: 'BAD_REQUEST' }));

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => console.log('iKey 3.1 API listening on ' + port));
}
module.exports = app;
