'use strict';
const express=require('express');
const crypto=require('node:crypto');
function mountLineBindingRoutes(app,{service,requireUser,csrfSecret}){
 function csrf(req){return typeof csrfSecret==='string'&&csrfSecret.length>=32?crypto.createHmac('sha256',csrfSecret).update('line-csrf-v2:'+req.projectSessionHash).digest('hex'):null;}
 function guarded(req,res,next){
  const expected=csrf(req),supplied=req.get('x-ikey-line-csrf')||'';
  const origin=req.get('origin');
  let valid=false;try{const url=new URL(origin);valid=url.origin===(req.secure||req.get('x-forwarded-proto')==='https'?'https://':'http://')+req.get('host');}catch{}
  if(!expected||!valid||!(/^[a-f0-9]{64}$/.test(supplied))||!crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)))return res.status(403).json({success:false,code:'INVALID_ORIGIN_OR_CSRF'});
  next();
 }
 const safe=fn=>async(req,res)=>{
  res.set('Cache-Control','no-store');
  if(!service.enabled())return res.status(503).json({success:false,code:'LINE_BINDING_DISABLED',message:'LINE 綁定功能尚未開放'});
  try{await fn(req,res);}catch{res.status(503).json({success:false,code:'LINE_STORAGE_UNAVAILABLE',message:'無法確認操作結果，請先查詢狀態，勿重複提交'});}
 };
 app.get('/api/line/status',requireUser,safe(async(req,res)=>res.json({success:true,available:true,...await service.status(req.projectSessionHash),csrf_token:csrf(req)})));
 app.post('/api/line/bind/start',requireUser,guarded,safe(async(req,res)=>{
  const r=await service.start(req.projectSessionHash,req.ip);
  res.status(r.status==='pending'?201:r.status==='rate_limited'?429:r.status==='unknown'?503:409).json({success:r.status==='pending',...r});
 }));
 app.post('/api/line/unbind',requireUser,guarded,safe(async(req,res)=>{
  const r=await service.unbind(req.projectSessionHash,req.projectUser,req.body?.password,req.body?.binding_id,true);
  res.status(r.status==='unbound'?200:r.status==='rate_limited'?429:r.status==='wrong_password'?401:r.status==='unknown'?503:409).json({success:r.status==='unbound',...r});
 }));
 app.get('/api/admin/line-bindings',requireUser,safe(async(req,res)=>{
  if(!['admin','super_admin'].includes(req.projectUser.global_role))return res.status(403).json({success:false,code:'FORBIDDEN'});
  return res.json({success:true,...await service.admin(req.projectSessionHash)});
 }));
}
module.exports={mountLineBindingRoutes};
