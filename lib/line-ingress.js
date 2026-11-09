'use strict';
// Inactive LINE entrypoints: fail closed until durable binding storage is available.
// Mount BEFORE express.json() so webhook signatures cover the original raw bytes.
const express=require('express');
const {verifyWebhookSignature}=require('./line-security');
function mountLineIngress(app){
 app.post('/api/line/webhook',express.raw({type:'application/json',limit:'128kb'}),(req,res)=>{
  res.set('Cache-Control','no-store');
  const secret=process.env.LINE_MESSAGING_CHANNEL_SECRET;
  if(!secret)return res.status(503).json({success:false,code:'LINE_WEBHOOK_NOT_CONFIGURED'});
  const signature=req.get('x-line-signature')||'';
  if(!verifyWebhookSignature(req.body,signature,secret))
   return res.status(401).json({success:false,code:'INVALID_LINE_SIGNATURE'});
  // LINE Developers Verify sends a signed request with an empty events array.
  // Acknowledge ONLY that no-op probe; never claim real events were processed.
  let payload;
  try{payload=JSON.parse(req.body.toString('utf8'));}catch{
   return res.status(400).json({success:false,code:'INVALID_LINE_PAYLOAD'});
  }
  if(payload&&typeof payload==='object'&&!Array.isArray(payload)&&
     Array.isArray(payload.events)&&payload.events.length===0&&
     Object.keys(payload).every(key=>key==='destination'||key==='events')&&
     (payload.destination===undefined||typeof payload.destination==='string')){
   return res.status(200).json({success:true,processed:0});
  }
  // Do not acknowledge unprocessed events as delivered. Binding and messaging are disabled.
  // LINE may retry delivery; enable this route only when durable event handling is ready.
  return res.status(503).json({success:false,processed:false,code:'LINE_WEBHOOK_DISABLED'});
 });
 app.get('/api/line/callback',(req,res)=>{
  res.set('Cache-Control','no-store');
  // No OAuth state transaction or token exchange is performed here.
  // Never accept code/ID tokens until durable one-time transaction storage exists.
  return res.status(503).type('text/plain; charset=utf-8').send('iKey LINE 帳號綁定尚未開放，請返回帳號管理頁面。');
 });
}
module.exports={mountLineIngress};
