"use strict";
const crypto=require("node:crypto");
const {token,hashToken}=require("./core");
const BASE="https://ikey.onrender.com";
function configured(){return Boolean(process.env.RESEND_API_KEY&&process.env.GEN3_MAIL_FROM);}
async function sendMail(to,subject,body){
 if(!configured())throw Error("MAIL_NOT_CONFIGURED");
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
  const r=await fetch("https://api.resend.com/emails",{method:"POST",signal:controller.signal,headers:{"Authorization":"Bearer "+process.env.RESEND_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({from:process.env.GEN3_MAIL_FROM,to:[to],subject,text:body})});
  if(!r.ok)throw Error("MAIL_DELIVERY_FAILED");
 }finally{clearTimeout(timer)}
}
async function sendToken(store,user,purpose){
 if(!configured())throw Error("MAIL_NOT_CONFIGURED");
 const raw=token(),ttl=purpose==="reset_password"?15:30;
 const record={token_id:crypto.randomUUID(),user_id:user.user_id,token_hash:hashToken(raw),purpose,target_email:user.email,created_at:new Date().toISOString(),expires_at:new Date(Date.now()+ttl*60000).toISOString(),used_at:""};
 const ok=await store.createToken(record);if(!ok)throw Error("TOKEN_STORAGE_FAILED");
 const path=purpose==="reset_password"?"reset-password.html":"verify-email.html";
 const url=BASE+"/gen3/"+path+"?token="+encodeURIComponent(raw);
 const subject=purpose==="reset_password"?"iKey 密碼重設":"iKey 電子郵件驗證";
 const body=purpose==="reset_password"?"請在 15 分鐘內開啟連結重設密碼：\n"+url:"請在 30 分鐘內開啟連結驗證電子郵件：\n"+url;
 await sendMail(user.email,subject,body);
 return true;
}
module.exports={sendToken,configured};
