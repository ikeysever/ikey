'use strict';
// LINE security primitives. This module does not activate binding, notifications or webhook processing.
const crypto=require('node:crypto');
const LINE_ISSUER='https://access.line.me';
function verifyWebhookSignature(rawBody,signature,channelSecret){
 if(!Buffer.isBuffer(rawBody)||typeof signature!=='string'||!channelSecret)return false;
 const expected=crypto.createHmac('sha256',channelSecret).update(rawBody).digest();
 let supplied;
 try{supplied=Buffer.from(signature,'base64');}catch{return false;}
 return supplied.length===expected.length&&crypto.timingSafeEqual(supplied,expected);
}
function createOAuthTransaction(){
 const state=crypto.randomBytes(32).toString('base64url');
 const nonce=crypto.randomBytes(32).toString('base64url');
 const verifier=crypto.randomBytes(32).toString('base64url');
 const challenge=crypto.createHash('sha256').update(verifier).digest('base64url');
 return {state,nonce,verifier,challenge,expiresAt:Date.now()+5*60*1000};
}
function buildAuthorizationUrl({channelId,redirectUri,state,nonce,challenge}){
 if(!/^\d+$/.test(String(channelId||'')))throw Error('INVALID_LINE_CHANNEL_ID');
 const callback=new URL(redirectUri);
 if(callback.protocol!=='https:')throw Error('HTTPS_CALLBACK_REQUIRED');
 const url=new URL('https://access.line.me/oauth2/v2.1/authorize');
 for(const [k,v] of Object.entries({response_type:'code',client_id:String(channelId),redirect_uri:callback.toString(),state,scope:'openid profile',nonce,code_challenge:challenge,code_challenge_method:'S256'})){
  if(!v)throw Error('MISSING_OAUTH_PARAMETER');
  url.searchParams.set(k,v);
 }
 return url.toString();
}
function validateIdTokenClaims(claims,{channelId,nonce,now=Math.floor(Date.now()/1000)}){
 // Must ONLY be called after LINE verifies the ID token signature (or via LINE's verify endpoint).
 if(!claims||claims.iss!==LINE_ISSUER||String(claims.aud)!==String(channelId)||claims.nonce!==nonce||
    typeof claims.sub!=='string'||!claims.sub||
    !Number.isFinite(claims.exp)||claims.exp<=now||
    !Number.isFinite(claims.iat)||claims.iat>now+60)return false;
 return true;
}
module.exports={verifyWebhookSignature,createOAuthTransaction,buildAuthorizationUrl,validateIdTokenClaims};
