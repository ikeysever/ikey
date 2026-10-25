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
const { randomUUID } = require('node:crypto');
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
app.get('/api/projects',requireProjectUser,async(req,res)=>{
 try{const result=await authStore.dbCall('db.select',{table:'Projects',where:{created_by_user_id:req.projectUser.user_id},limit:100});return res.json({success:true,projects:(result?.rows||[]).filter(row=>row.status!=='deleted')});}
 catch(err){console.warn('Project list unavailable',err.message);return res.status(503).json({success:false,message:'專案資料服務尚未就緒'});}
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
  if(!persisted||Object.entries(updates).some(([key,value])=>String(persisted[key]??'')!==String(value)))return res.status(503).json({success:false,message:'設定未通過資料庫寫入覆核，請重新整理確認'});
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
