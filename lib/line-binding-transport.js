'use strict';
const crypto=require('node:crypto');
const allowed=new Set(['health','create','consume','status','unbind','notification','webhookNotification','admin']);
function createLineBindingTransport(call,secret){
 if(typeof call!=='function'||typeof secret!=='string'||secret.length<32)throw Error('LINE_TRANSPORT_UNAVAILABLE');
 return {async invoke(action,payload={}){
  if(!allowed.has(action))throw Error('LINE_ACTION_DENIED');
  const body=JSON.stringify(payload),timestamp=String(Date.now()),nonce=crypto.randomUUID();
  const signature=crypto.createHmac('sha256',secret).update(action+'\n'+timestamp+'\n'+nonce+'\n'+body).digest('hex');
  const r=await call('lineBindingV2',{action,body,timestamp,nonce,signature});
  if(!r||typeof r!=='object')throw Error('LINE_INVALID_RESPONSE');return r;
 }};
}
module.exports={createLineBindingTransport};
