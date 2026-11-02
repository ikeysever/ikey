'use strict';
const crypto=require('node:crypto');
const {passwordVerify}=require('./gen3-auth/core');
module.exports=function mountDeviceAuth(app,authStore){
 const attempts=new Map(),ttlMs=15*60*1000,secret=process.env.IKEY_DEVICE_TOKEN_SECRET;
 const idPattern=/^[A-HJ-NP-Z2-9]{8}$/;
 const dummySalt=Buffer.alloc(16,0);
 const dummyHash='scrypt:v1:'+dummySalt.toString('base64url')+':'+crypto.scryptSync('ikey-device-auth-dummy-verifier-never-use',dummySalt,64).toString('base64url');
 function limited(key){
  const now=Date.now();if(attempts.size>5000)for(const [k,v] of attempts)if(v.until<=now)attempts.delete(k);
  const state=attempts.get(key);if(!state||state.until<=now){attempts.set(key,{count:1,until:now+60000});return false;}
  state.count++;return state.count>5;
 }
 function sign(data){return crypto.createHmac('sha256',secret).update(data).digest('base64url');}
 function makeToken(id){
  const iat=Date.now(),payload=Buffer.from(JSON.stringify({iss:'ikey-render',aud:'ikey-device-api',sub:id,iat,exp:iat+ttlMs,nonce:crypto.randomBytes(16).toString('base64url')})).toString('base64url');
  return payload+'.'+sign(payload);
 }
 function validateToken(token){
  if(!secret||Buffer.byteLength(secret,'utf8')<32||typeof token!=='string'||token.length>2048)return null;
  const parts=token.split('.');
  if(parts.length!==2||!/^[A-Za-z0-9_-]+$/.test(parts[0])||!/^[A-Za-z0-9_-]+$/.test(parts[1]))return null;
  const expected=Buffer.from(sign(parts[0])),actual=Buffer.from(parts[1]);
  if(expected.length!==actual.length||!crypto.timingSafeEqual(expected,actual))return null;
  try{
   const o=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8')),now=Date.now();
   return o.iss==='ikey-render'&&o.aud==='ikey-device-api'&&idPattern.test(o.sub)&&Number.isSafeInteger(o.iat)&&
    Number.isSafeInteger(o.exp)&&o.iat<=now+30000&&o.exp>now&&o.exp-o.iat===ttlMs&&o.exp<=now+ttlMs+30000&&
    typeof o.nonce==='string'&&/^[A-Za-z0-9_-]{22}$/.test(o.nonce)?o.sub:null;
  }catch{return null;}
 }
 async function findActiveDevice(id){
  if(!authStore||typeof authStore.deviceAuthFindById!=='function')throw Error('DEVICE_AUTH_STORAGE_NOT_CONFIGURED');
  const row=await authStore.deviceAuthFindById(id);
  return row&&row.device_id===id&&row.status==='pre_registered'?row:null;
 }
 app.post('/api/device/auth',async(req,res)=>{
  res.set('Cache-Control','no-store');
  if(!secret||Buffer.byteLength(secret,'utf8')<32)return res.status(503).json({success:false,code:'DEVICE_AUTH_NOT_CONFIGURED'});
  const id=req.body?.device_id,password=req.body?.password;
  if(typeof id!=='string'||!idPattern.test(id)||typeof password!=='string'||password.length<8||password.length>128)
   return res.status(400).json({success:false,code:'INVALID_REQUEST'});
  if(limited(String(req.ip||'unknown')+':'+id))return res.status(429).json({success:false,code:'RATE_LIMITED'});
  try{
   const row=await findActiveDevice(id),valid=passwordVerify(password,row?.password_hash||dummyHash);
   if(!row||!valid)return res.status(401).json({success:false,code:'INVALID_CREDENTIALS'});
   return res.json({success:true,device_id:id,access_token:makeToken(id),token_type:'Bearer',expires_in:ttlMs/1000});
  }catch(err){console.warn('Device auth storage unavailable',err.name||'Error');return res.status(503).json({success:false,code:'DEVICE_AUTH_UNAVAILABLE'});}
 });
 async function requireDevice(req,res,next){
  res.set('Cache-Control','no-store');
  if(!secret||Buffer.byteLength(secret,'utf8')<32||!authStore)return res.status(503).json({success:false,code:'DEVICE_AUTH_NOT_CONFIGURED'});
  const h=req.get('Authorization')||'',id=h.startsWith('Bearer ')?validateToken(h.slice(7)):null;
  if(!id)return res.status(401).json({success:false,code:'UNAUTHORIZED'});
  try{const row=await findActiveDevice(id);if(!row)return res.status(401).json({success:false,code:'UNAUTHORIZED'});
   req.verifiedDevice=Object.freeze({authenticated:true,device_id:id});return next();
  }catch{return res.status(503).json({success:false,code:'DEVICE_AUTH_UNAVAILABLE'});}
 }
 app.get('/api/device/me',async(req,res)=>{
  res.set('Cache-Control','no-store');
  if(!secret||Buffer.byteLength(secret,'utf8')<32)return res.status(503).json({success:false,code:'DEVICE_AUTH_NOT_CONFIGURED'});
  const h=req.get('Authorization')||'',id=h.startsWith('Bearer ')?validateToken(h.slice(7)):null;
  if(!id)return res.status(401).json({success:false,code:'UNAUTHORIZED'});
  try{const row=await findActiveDevice(id);if(!row)return res.status(401).json({success:false,code:'UNAUTHORIZED'});
   return res.json({success:true,device_id:id,authenticated:true});
  }catch(err){console.warn('Device auth check unavailable',err.name||'Error');return res.status(503).json({success:false,code:'DEVICE_AUTH_UNAVAILABLE'});}
 });
 return requireDevice;
};
