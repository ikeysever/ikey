"use strict";
const express = require("express");
const {hashToken,active} = require("./core");
const {createProjectStore} = require("./project-store");
const COOKIE = "ikey_gen3_session";
function getCookie(req) {
  const item = String(req.headers.cookie || "").split(";").map(x=>x.trim()).find(x=>x.startsWith(COOKIE+"="));
  return item ? item.slice(COOKIE.length+1) : "";
}
function sameOrigin(req) {
  const origin=req.get("origin");
  if(!origin)return true;
  try {
    const u=new URL(origin);
    const protocol=(req.secure||req.get("x-forwarded-proto")==="https")?"https:":"http:";
    return u.host===req.get("host") && u.protocol===protocol;
  }catch{return false;}
}
function createProjectRouter(authStore) {
  const router=express.Router();
  const projects=createProjectStore(authStore);
  router.use(async(req,res,next)=>{
    res.set("Cache-Control","no-store");
    if(!projects)return res.status(503).json({success:false,code:"PROJECT_STORAGE_UNAVAILABLE"});
    if(["POST","PUT","PATCH","DELETE"].includes(req.method) && !sameOrigin(req))
      return res.status(403).json({success:false,code:"INVALID_ORIGIN"});
    try{
      const raw=getCookie(req);
      if(!raw||raw.length>256)return res.status(401).json({success:false,code:"LOGIN_REQUIRED"});
      const session=await authStore.findSessionByHash(hashToken(raw));
      if(!session||session.revoked_at||Date.parse(session.expires_at)<=Date.now())
        return res.status(401).json({success:false,code:"LOGIN_REQUIRED"});
      const user=await authStore.findById(session.user_id);
      if(!active(user))return res.status(401).json({success:false,code:"LOGIN_REQUIRED"});
      req.projectActor=user.user_id;
      next();
    }catch{return res.status(503).json({success:false,code:"AUTH_UNAVAILABLE"});}
  });
  const execute=async(res,fn)=>{
    try{return res.json({success:true,result:await fn()});}
    catch(err){
      // Unsupported Apps Script actions must never be represented as successful writes.
      console.warn("Project database operation unavailable",String(err.message||"").replace(/[^A-Z0-9_]/gi,"").slice(0,60));
      return res.status(503).json({success:false,code:"PROJECT_STORAGE_NOT_READY",message:"專案資料庫服務尚未完成部署或驗證"});
    }
  };
  router.get("/requests", (req,res)=>execute(res,()=>projects.listMine(req.projectActor)));
  router.get("/requests/:id/history",(req,res)=>{
    if(!/^[a-zA-Z0-9_-]{1,100}$/.test(req.params.id))return res.status(400).json({success:false,code:"INVALID_REQUEST_ID"});
    return execute(res,()=>projects.historyMine(req.projectActor,req.params.id));
  });
  router.post("/drafts",(req,res)=>{
    const name=String(req.body?.project_name||"").trim();
    const description=String(req.body?.project_description||"").trim();
    const request_id=String(req.body?.request_id||"").trim();
    if(!name||name.length>100||description.length>2000||request_id.length>100||
      (request_id&&!/^[a-zA-Z0-9_-]+$/.test(request_id)))
      return res.status(400).json({success:false,code:"INVALID_PROJECT_DRAFT"});
    // Do not accept user_id, status or project_id from clients.
    return execute(res,()=>projects.saveDraft(req.projectActor,{request_id,project_name:name,project_description:description}));
  });
  router.post("/requests/:id/submit",(req,res)=>{
    if(!/^[a-zA-Z0-9_-]{1,100}$/.test(req.params.id))return res.status(400).json({success:false,code:"INVALID_REQUEST_ID"});
    return execute(res,()=>projects.submit(req.projectActor,req.params.id));
  });
  return router;
}
module.exports={createProjectRouter};
