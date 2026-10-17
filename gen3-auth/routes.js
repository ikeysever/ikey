"use strict";
// This router is NOT mounted on the live server. All writes require an injected
// trusted adapter with atomic uniqueness checks. No Sheets credentials in browser.
const express = require("express");
const crypto = require("node:crypto");
const {passwordHash,passwordVerify,safeUser,active,newSession,hashToken,SESSION_MS} = require("./core");
const COOKIE = "ikey_gen3_session";
const MAX_NAME = 80;
const rateKey=(kind,ip,identifier="")=>crypto.createHash("sha256").update(kind+":"+ip+":"+identifier).digest("hex");
const RATE = new Map(); // per-process preliminary throttle; production requires shared storage
function throttle(key, limit=10, windowMs=15*60*1000) {
  const now=Date.now(), row=RATE.get(key);
  if(!row || now>row.until){RATE.set(key,{n:1,until:now+windowMs});return true;}
  row.n++;return row.n<=limit;
}
function getCookie(req,name) {
  const value=String(req.headers.cookie||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(name+"="));
  return value?value.slice(name.length+1):null;
}
function cookieOptions(req) {
  return {httpOnly:true,secure: Boolean(req.secure || req.get("x-forwarded-proto")==="https"),
    sameSite:"lax",path:"/",maxAge:SESSION_MS};
}
function sameOrigin(req) {
  const origin=req.get("origin");
  if(!origin)return true;
  try {
    const u=new URL(origin);
    const host=req.get("host");
    const scheme=req.secure||req.get("x-forwarded-proto")==="https"?"https:":"http:";
    return u.protocol===scheme && u.host===host;
  } catch {return false;}
}
function createRouter(store) {
  const router=express.Router();
  router.use((req,res,next)=>{
    res.set("Cache-Control","no-store");
    if(["POST","PUT","PATCH","DELETE"].includes(req.method) && !sameOrigin(req))
      return res.status(403).json({success:false,message:"來源驗證失敗"});
    next();
  });
  const ready=Boolean(store && ["registerAtomic","findByLogin","recordLoginFailureAtomic","recordLoginSuccessAtomic","createSession","findSessionByHash","findById","touchSession","revokeSession","audit","throttleAtomic"].every(k=>typeof store[k]==="function"));
  router.use((req,res,next)=>ready?next():res.status(503).json({success:false,code:"REGISTRATION_NOT_CONFIGURED",message:"註冊登入服務尚未完成安全資料庫串接"}));
  router.post("/register",async(req,res)=>{
    try{
      if(!throttle("register:"+req.ip,5)||!(await store.throttleAtomic(rateKey("register",req.ip),5,15*60000)))
        return res.status(429).json({success:false,message:"請稍後再試"});
      const display_name=String(req.body?.display_name||"").trim();
      if(!display_name||display_name.length>MAX_NAME)return res.status(400).json({success:false,message:"顯示名稱不符合規定"});
      const username=String(req.body?.username||"").trim().toLowerCase();
      if(!/^[a-z][a-z0-9_]{3,23}$/.test(username))
        return res.status(400).json({success:false,message:"帳號須為 4 至 24 字元英數字或底線，並以字母開頭"});
      const password_hash=passwordHash(req.body?.password);
      const now=new Date().toISOString();
      const user={user_id:crypto.randomUUID(),username,password_hash,display_name,
        global_role:"user",account_status:"active",failed_login_attempts:0,
        locked_until:"",created_at:now,updated_at:now};
      const inserted=await store.registerAtomic(user);
      if(!inserted)return res.status(409).json({success:false,message:"此帳號已被使用"});
      await store.audit({user_id:user.user_id,event_type:"register",result:"success",auth_method:"password"});
      return res.status(201).json({success:true,user:safeUser(user),message:"帳號建立成功，請使用帳號與密碼登入"});
    }catch(err){
      if(err.message==="INVALID_PASSWORD")return res.status(400).json({success:false,message:"密碼須為 8 至 128 字元"});
      console.error("Gen3 registration error",err.code||err.message);
      return res.status(503).json({success:false,message:"暫時無法註冊，請稍後再試"});
    }
  });
  router.post("/login",async(req,res)=>{
    try {
      const identifier=String(req.body?.identifier||"").trim().toLowerCase();
      if(!/^[a-z][a-z0-9_]{3,23}$/.test(identifier))return res.status(401).json({success:false,message:"帳號或密碼錯誤"});
      if(!throttle("login:"+req.ip+":"+identifier,10)||!(await store.throttleAtomic(rateKey("login",req.ip,identifier),10,15*60000))) return res.status(429).json({success:false,message:"請稍後再試"});
      const user=await store.findByLogin(identifier);
      // Use a dummy hash to reduce timing differences for nonexistent users.
      const dummy="scrypt:v1:AAAAAAAAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
      const matches=passwordVerify(req.body?.password,user?.password_hash||dummy);
      if(!user || !matches) {
        if(user && active(user)) await store.recordLoginFailureAtomic(user.user_id,5,15*60*1000);
        await store.audit({user_id:user?.user_id||"",event_type:"login",result:"failure",auth_method:"password"});
        return res.status(401).json({success:false,message:"帳號或密碼錯誤，或帳號暫時無法登入"});
      }
      if(!active(user)) return res.status(403).json({success:false,message:"帳號目前無法登入"});
      // Must recheck account status inside atomic adapter operation.
      const updated=await store.recordLoginSuccessAtomic(user.user_id);
      if(!updated || !active(updated)) return res.status(403).json({success:false,message:"帳號目前無法登入"});
      const s=newSession(user.user_id);
      await store.createSession(s.record);
      await store.audit({user_id:user.user_id,event_type:"login",result:"success",auth_method:"password"});
      res.cookie(COOKIE,s.raw,cookieOptions(req));
      return res.json({success:true,user:safeUser(updated)});
    } catch(err) {
      console.error("Gen3 login error",err.code||err.message);
      return res.status(503).json({success:false,message:"登入服務暫時無法使用"});
    }
  });
  router.get("/me",async(req,res)=>{
    try {
      const raw=getCookie(req,COOKIE);
      if(!raw || raw.length>256) return res.status(401).json({authenticated:false});
      const s=await store.findSessionByHash(hashToken(raw));
      if(!s || s.revoked_at || Date.parse(s.expires_at)<=Date.now()) return res.status(401).json({authenticated:false});
      const user=await store.findById(s.user_id);
      if(!active(user)) return res.status(401).json({authenticated:false});
      const expiry=new Date(Date.now()+SESSION_MS).toISOString();
      if(Date.parse(s.expires_at)-Date.now()<SESSION_MS-60*60*1000){
        const renewed=await store.touchSession(s.session_id,expiry,new Date().toISOString());
        if(!renewed)return res.status(401).json({authenticated:false});
        res.cookie(COOKIE,raw,cookieOptions(req));
      }
      return res.json({authenticated:true,user:safeUser(user)});
    } catch(err){return res.status(503).json({authenticated:false,message:"暫時無法驗證登入狀態"})}
  });
  router.post("/logout",async(req,res)=>{
    try {
      const raw=getCookie(req,COOKIE);
      if(raw){const s=await store.findSessionByHash(hashToken(raw));if(s) await store.revokeSession(s.session_id,"logout");}
      res.clearCookie(COOKIE,{httpOnly:true,secure:cookieOptions(req).secure,sameSite:"lax",path:"/"});
      return res.json({success:true});
    } catch(err){return res.status(503).json({success:false,message:"登出暫時無法完成"})}
  });
  return router;
}
module.exports={createRouter};
