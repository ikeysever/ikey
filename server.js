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
app.use('/api', (_req, res) => res.status(404).json({ ok: false, code: 'NOT_FOUND' }));
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));
app.use((_err, _req, res, _next) => res.status(400).json({ ok: false, code: 'BAD_REQUEST' }));

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => console.log('iKey 3.1 API listening on ' + port));
}
module.exports = app;
