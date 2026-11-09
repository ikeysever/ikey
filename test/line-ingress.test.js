'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const express=require('express');
const {mountLineIngress}=require('../lib/line-ingress');
(async()=>{
 const app=express();
 mountLineIngress(app);
 const server=app.listen(0,'127.0.0.1');
 try{
  await new Promise(resolve=>server.once('listening',resolve));
  const url='http://127.0.0.1:'+server.address().port;
  const callback=await fetch(url+'/api/line/callback?code=fake&state=fake');
  assert.equal(callback.status,503);
  const raw='{"events":[]}';
  const secret='local-test-only';
  process.env.LINE_MESSAGING_CHANNEL_SECRET=secret;
  const invalid=await fetch(url+'/api/line/webhook',{method:'POST',headers:{'content-type':'application/json','x-line-signature':'invalid'},body:raw});
  assert.equal(invalid.status,401);
  const signature=crypto.createHmac('sha256',secret).update(raw).digest('base64');
  const valid=await fetch(url+'/api/line/webhook',{method:'POST',headers:{'content-type':'application/json','x-line-signature':signature},body:raw});
  assert.equal(valid.status,503);
  const result=await valid.json();
  assert.equal(result.processed,false);
  assert.equal(result.code,'LINE_WEBHOOK_DISABLED');
  console.log('LINE ingress tests passed');
 }finally{server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
