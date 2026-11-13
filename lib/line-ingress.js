'use strict';
// Inactive LINE entrypoints: fail closed until durable binding storage is available.
// Mount BEFORE express.json() so webhook signatures cover the original raw bytes.
const express=require('express');
const {verifyWebhookSignature}=require('./line-security');
function mountLineIngress(app,{getService=()=>null,getMenuService=()=>null}={}){
 app.post('/api/line/webhook',express.raw({type:'application/json',limit:'128kb'}),async(req,res)=>{
  res.set('Cache-Control','no-store');
  const diagnostic=(code,status)=>console.info('LINE_WEBHOOK_DIAGNOSTIC',JSON.stringify({code,status}));
  const secret=process.env.LINE_MESSAGING_CHANNEL_SECRET;
  if(!secret){diagnostic('SECRET_MISSING',503);return res.status(503).json({success:false,code:'LINE_WEBHOOK_NOT_CONFIGURED'});}
  const signature=req.get('x-line-signature')||'';
  if(!verifyWebhookSignature(req.body,signature,secret)){
   diagnostic('SIGNATURE_INVALID',401);
   return res.status(401).json({success:false,code:'INVALID_LINE_SIGNATURE'});
  }
  // LINE Developers Verify sends a signed request with an empty events array.
  // Acknowledge ONLY that no-op probe; never claim real events were processed.
  let payload;
  try{payload=JSON.parse(req.body.toString('utf8'));}catch{
   diagnostic('PAYLOAD_INVALID',400);
   return res.status(400).json({success:false,code:'INVALID_LINE_PAYLOAD'});
  }
  if(payload&&typeof payload==='object'&&!Array.isArray(payload)&&
     Array.isArray(payload.events)&&payload.events.length===0&&
     Object.keys(payload).every(key=>key==='destination'||key==='events')&&
     (payload.destination===undefined||typeof payload.destination==='string')){
   diagnostic('EMPTY_EVENTS_ACCEPTED',200);
   return res.status(200).json({success:true,processed:0});
  }
  if(!payload||!Array.isArray(payload.events)||payload.events.length>100)return res.status(400).json({success:false,code:'INVALID_LINE_PAYLOAD'});
  const service=getService();
  const menu=getMenuService();
  if(!service?.enabled()&&!menu?.enabled())return res.status(503).json({success:false,code:'LINE_WEBHOOK_DISABLED'});
  try{
   let uncertain=false;
   for(const event of payload.events){
    const menuResult=menu?.enabled()?await menu.handle(event):{status:'ignored'};
    if(menuResult.status==='handled')continue;
    if(menuResult.status==='unknown'){uncertain=true;continue;}
    if(service?.enabled()){
     const result=await service.event(event);
     if(result.status==='unknown')uncertain=true;
    }
   }
   return res.status(uncertain?503:200).json({success:!uncertain,code:uncertain?'LINE_RESULT_UNKNOWN':'LINE_EVENTS_HANDLED'});
  }catch{return res.status(503).json({success:false,code:'LINE_EVENT_UNCONFIRMED'});}

 });
 app.get('/api/line/diagnostics',(req,res)=>{
  res.set('Cache-Control','no-store');
  const secret=Boolean(process.env.LINE_MESSAGING_CHANNEL_SECRET);
  const token=Boolean(process.env.LINE_MESSAGING_ACCESS_TOKEN);
  const menu=getMenuService();
  const binding=getService();
  res.json({success:true,webhook_path:'/api/line/webhook',channel_secret_configured:secret,channel_access_token_configured:token,menu_enabled:Boolean(menu?.enabled()),binding_enabled:Boolean(binding?.enabled()),note:'No secret values are exposed. A successful deploy does not verify LINE Developers webhook configuration.'});
 });
 app.get('/api/line/callback',(req,res)=>{
  res.set('Cache-Control','no-store');
  // No OAuth state transaction or token exchange is performed here.
  // Never accept code/ID tokens until durable one-time transaction storage exists.
  return res.status(503).type('text/plain; charset=utf-8').send('iKey LINE 帳號綁定尚未開放，請返回帳號管理頁面。');
 });
}
module.exports={mountLineIngress};
