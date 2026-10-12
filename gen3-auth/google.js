"use strict";
const crypto=require("node:crypto");
const {newSession,hashToken,safeUser,active}=require("./core");
const COOKIE="ikey_gen3_session";
const BASE="https://ikey.onrender.com";
const REDIRECT=BASE+"/api/auth/google/callback";
function enabled(){return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID&&process.env.GOOGLE_OAUTH_CLIENT_SECRET);}
const random=()=>crypto.randomBytes(32).toString("base64url");
function cookie(req,name){return String(req.headers.cookie||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(name+"="))?.slice(name.length+1)||"";}
function secureCookie(res,name,value,maxAge){res.cookie(name,value,{httpOnly:true,secure:true,sameSite:"lax",path:"/api/auth/google",maxAge});}
function clear(res){for(const n of ["ikey_gstate","ikey_gnonce","ikey_gmode"])res.clearCookie(n,{httpOnly:true,secure:true,sameSite:"lax",path:"/api/auth/google"});}
function begin(req,res,mode="login"){
 if(!enabled())return res.status(503).send("Google 登入尚未設定");
 const state=random(),nonce=random();
 secureCookie(res,"ikey_gstate",state,5*60*1000);secureCookie(res,"ikey_gnonce",nonce,5*60*1000);secureCookie(res,"ikey_gmode",mode,5*60*1000);
 const q=new URLSearchParams({client_id:process.env.GOOGLE_OAUTH_CLIENT_ID,redirect_uri:REDIRECT,response_type:"code",scope:"openid email profile",state,nonce,prompt:"select_account"});
 return res.redirect("https://accounts.google.com/o/oauth2/v2/auth?"+q);
}
async function callback(req,res,store){
 const state=req.query.state,code=req.query.code;
 const expected=cookie(req,"ikey_gstate"),nonce=cookie(req,"ikey_gnonce"),mode=cookie(req,"ikey_gmode");
 clear(res);
 if(!enabled()||typeof state!=="string"||!expected||state.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(state),Buffer.from(expected))||!nonce||!["login","link"].includes(mode)||typeof code!=="string")return res.status(403).send("Google 驗證已失效，請重新登入");
 try{
  const t=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({code,client_id:process.env.GOOGLE_OAUTH_CLIENT_ID,client_secret:process.env.GOOGLE_OAUTH_CLIENT_SECRET,redirect_uri:REDIRECT,grant_type:"authorization_code"})});
  if(!t.ok)throw Error("TOKEN_EXCHANGE_FAILED");
  const data=await t.json();
  const verify=await fetch("https://oauth2.googleapis.com/tokeninfo?id_token="+encodeURIComponent(data.id_token));
  if(!verify.ok)throw Error("GOOGLE_TOKEN_INVALID");
  const profile=await verify.json();
  if(!["accounts.google.com","https://accounts.google.com"].includes(profile.iss)||profile.aud!==process.env.GOOGLE_OAUTH_CLIENT_ID||profile.nonce!==nonce||profile.email_verified!== "true"||Date.now()>=Number(profile.exp)*1000||!profile.sub||!profile.email)throw Error("GOOGLE_IDENTITY_INVALID");
  let user=await store.findByGoogleSub(profile.sub);
  if(mode==="link"){
   const raw=cookie(req,COOKIE);
   if(!raw)return res.status(401).send("請先登入 iKey 帳號再進行 Google 綁定");
   const session=await store.findSessionByHash(hashToken(raw));
   if(!session||session.revoked_at||Date.parse(session.expires_at)<=Date.now())return res.status(401).send("登入已失效");
   const owner=await store.findById(session.user_id);
   if(!active(owner)||owner.email.toLowerCase()!==profile.email.toLowerCase())return res.status(403).send("Google 電子郵件必須與已登入帳號一致");
   if(user&&user.user_id!==owner.user_id)return res.status(409).send("此 Google 帳號已綁定其他使用者");
   user=await store.linkGoogleAtomic(owner.user_id,profile.sub);
   if(!user)return res.status(409).send("無法綁定 Google 帳號");
  }else if(!user){
   // Never automatically merge an existing email account: that enables unsafe account linking.
   const existing=await store.findByEmail(profile.email.toLowerCase());
   if(existing)return res.status(409).send("此電子郵件已有帳號。請先以密碼登入，再於帳號設定綁定 Google。");
   const now=new Date().toISOString();
   user={user_id:crypto.randomUUID(),email:profile.email.toLowerCase(),password_hash:"",display_name:String(profile.name||profile.email).slice(0,80),global_role:"user",account_status:"active",failed_login_attempts:0,locked_until:"",created_at:now,updated_at:now,google_sub:profile.sub,google_linked_at:now,email_verified_at:now};
   user=await store.registerGoogleAtomic(user);
   if(!user)throw Error("GOOGLE_REGISTRATION_CONFLICT");
  }
  if(!active(user))return res.status(403).send("帳號無法登入");
  if(mode==="login"){
   const s=newSession(user.user_id);await store.createSession(s.record);
   res.cookie(COOKIE,s.raw,{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:7*24*60*60*1000});
  }
  await store.audit({user_id:user.user_id,event_type:mode==="link"?"google_link":"login",result:"success",auth_method:"google"});
  return res.redirect("/gen3/login.html?google=success");
 }catch(err){console.error("Gen3 Google OAuth",err.message);return res.status(503).send("Google 驗證暫時無法完成，請稍後重試");}
}
module.exports={enabled,begin,callback};
