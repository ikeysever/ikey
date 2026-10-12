"use strict";
document.addEventListener("DOMContentLoaded",async()=>{
  const google=document.getElementById("googleLoginLink");
  const status=document.getElementById("gen3AuthStatus");
  if(!google||!status)return;
  let message="第三代帳號服務連線狀態尚未確認";
  let googleReady=false;
  try{
    const response=await fetch("/api/auth/status",{credentials:"same-origin",cache:"no-store"});
    if(!response.ok)throw Error("AUTH_STATUS_UNAVAILABLE");
    const data=await response.json();
    googleReady=data.enabled===true&&data.google===true;
    if(!data.enabled)message="第三代帳號服務尚未啟用；可先查看註冊與重設密碼頁面，暫時無法提交。";
    else if(!googleReady)message="註冊與密碼重設服務已開啟；Google 登入尚待完成 OAuth 設定。";
    else message="第三代註冊、密碼重設與 Google 登入入口已開放。";
  }catch{
    message="暫時無法確認第三代帳號服務狀態，請稍後再試。";
  }
  status.textContent=message;
  if(!googleReady){
    google.setAttribute("aria-disabled","true");
    google.title="Google 登入尚未完成設定";
    google.addEventListener("click",event=>{
      event.preventDefault();
      status.textContent="目前無法使用 Google 登入，請先使用既有登入方式。";
    });
  }
});
