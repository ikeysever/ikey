'use strict';
// Messaging API account binding: durable store adapter required before activation.
// Never use in-memory tokens or acknowledge an unpersisted webhook event.
const crypto=require('node:crypto');
const CODE_RE=/^IK-[A-Z2-9]{4}-[A-Z2-9]{4}$/;
const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode(){
 const bytes=crypto.randomBytes(8);
 const chars=Array.from(bytes,b=>ALPHABET[b%ALPHABET.length]).join('');
 return 'IK-'+chars.slice(0,4)+'-'+chars.slice(4);
}
function digestCode(code,secret){
 if(typeof secret!=='string'||secret.length<32)throw Error('LINE_BINDING_SECRET_NOT_CONFIGURED');
 if(!CODE_RE.test(code))throw Error('INVALID_BINDING_CODE');
 return crypto.createHmac('sha256',secret).update('ikey-line-bind-v1:'+code).digest('hex');
}
function parseBindingMessage(event){
 if(!event||event.type!=='message'||event.message?.type!=='text')return null;
 if(event.source?.type!=='user'||typeof event.source.userId!=='string'||!event.source.userId)return null;
 const code=String(event.message.text||'').trim().toUpperCase();
 if(!CODE_RE.test(code))return null;
 return {code,lineUserId:event.source.userId,eventId:event.webhookEventId||null};
}
// Store must atomically create, consume, enforce expiry and uniqueness and retain webhook event IDs.
// No fallback storage: fail closed until GAS implements and verifies these transactions.
function ready(store){return !!store&&['createChallengeAtomic','consumeChallengeAtomic','getBindingByUser','unbindAtomic','recordWebhookEventAtomic'].every(k=>typeof store[k]==='function');}
module.exports={newCode,digestCode,parseBindingMessage,ready,CODE_RE};
