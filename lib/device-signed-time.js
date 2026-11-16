'use strict';
const crypto=require('node:crypto');
const NONCE=/^[a-f0-9]{32}$/;
function payload(nonce,unix){return 'ikey-time-v1\n'+nonce+'\n'+unix;}
function createTimeHandler(getKey=()=>process.env.IKEY_TIME_SIGNING_PRIVATE_KEY){
 return (req,res)=>{
  res.set('Cache-Control','no-store');
  const nonce=String(req.query.nonce||'');
  if(!NONCE.test(nonce))return res.status(400).json({success:false,code:'INVALID_NONCE'});
  const pem=getKey();
  if(!pem)return res.status(503).json({success:false,code:'TIME_SIGNING_NOT_CONFIGURED'});
  try{
   const key=crypto.createPrivateKey(pem);
   if(key.asymmetricKeyType!=='ec'||key.asymmetricKeyDetails?.namedCurve!=='prime256v1')throw Error('WRONG_KEY');
   const unix=Math.floor(Date.now()/1000);
   const signature=crypto.sign('sha256',Buffer.from(payload(nonce,unix),'utf8'),key).toString('base64');
   return res.json({success:true,version:1,nonce,unix,signature,algorithm:'ES256-DER'});
  }catch{return res.status(503).json({success:false,code:'TIME_SIGNING_UNAVAILABLE'});}
 };
}
module.exports={payload,createTimeHandler};
