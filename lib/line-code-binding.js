'use strict';
// Messaging API account binding: durable store adapter required before activation.
// Never use in-memory tokens or acknowledge an unpersisted webhook event.
const crypto=require('node:crypto');
const CODE_RE=/^[0-9]{6}$/;
function newCode(){return String(crypto.randomInt(0,1000000)).padStart(6,'0');}
function digestCode(code,secret){
 if(typeof secret!=='string'||secret.length<32)throw Error('LINE_BINDING_SECRET_NOT_CONFIGURED');
 if(!CODE_RE.test(code))throw Error('INVALID_BINDING_CODE');
 return crypto.createHmac('sha256',secret).update('ikey-line-bind-v2:'+code).digest('hex');
}
function parseBindingMessage(event){
 if(!event||event.type!=='message'||event.message?.type!=='text')return null;
 if(event.source?.type!=='user'||typeof event.source.userId!=='string'||!event.source.userId)return null;
 const code=String(event.message.text||'').trim();
 if(!CODE_RE.test(code))return null;
 return {code,lineUserId:event.source.userId,eventId:event.webhookEventId||null};
}
// Presence is only a capability check; activation also requires signed GAS v2 health.
function ready(store){return !!store&&typeof store.invoke==='function';}
module.exports={newCode,digestCode,parseBindingMessage,ready,CODE_RE};
