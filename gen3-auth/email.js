"use strict";
const crypto=require("node:crypto");
const {token,hashToken}=require("./core");
const BASE="https://ikey.onrender.com";
function configured(){return Boolean(process.env.GEN3_APPS_SCRIPT_URL&&process.env.GEN3_APPS_SCRIPT_KEY);}
async function sendMail(store,to,subject,body){
 if(!configured()||typeof store?.sendMail!=="function")throw Error("MAIL_NOT_CONFIGURED");
 // Gen3 always uses its dedicated Apps Script MailApp; never fall back to Resend.
 if(await store.sendMail(to,subject,body)!==true)throw Error("MAIL_DELIVERY_FAILED");
}
async function sendToken(store,user,purpose){
 if(!["verify_email","reset_password"].includes(purpose))throw Error("INVALID_MAIL_PURPOSE");
 if(!configured())throw Error("MAIL_NOT_CONFIGURED");
 const raw=token(),ttl=purpose==="reset_password"?15:30;
 const record={token_id:crypto.randomUUID(),user_id:user.user_id,token_hash:hashToken(raw),purpose,target_email:user.email,created_at:new Date().toISOString(),expires_at:new Date(Date.now()+ttl*60000).toISOString(),used_at:""};
 const ok=await store.createToken(record);if(!ok)throw Error("TOKEN_STORAGE_FAILED");
 const path=purpose==="reset_password"?"reset-password.html":"verify-email.html";
 const url=BASE+"/gen3/"+path+"?token="+encodeURIComponent(raw);
 const subject=purpose==="reset_password"?"iKey 密碼重設":"iKey 電子郵件驗證";
 const body=purpose==="reset_password"?"請在 15 分鐘內開啟連結重設密碼：\n"+url:"請在 30 分鐘內開啟連結驗證電子郵件：\n"+url;
 await sendMail(store,user.email,subject,body);
 return true;
}
module.exports={sendToken,configured};
