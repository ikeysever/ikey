"use strict";
// Primary Gen3 login. The legacy administrator form is opt-in and never uses Gen3 credentials.
document.addEventListener("DOMContentLoaded",()=>{
  const $=id=>document.getElementById(id);
  const panel=$("gen3LoginPanel"),legacy=$("legacyLoginPanel");
  const form=$("gen3LoginForm"),submit=$("gen3LoginSubmit");
  const message=$("gen3LoginMessage"),status=$("gen3AuthStatus");
  if(!panel||!legacy||!form||!submit||!message||!status)return;
  const legacyRequested=new URLSearchParams(location.search).get("legacy")==="1";
  panel.hidden=legacyRequested;
  legacy.hidden=!legacyRequested;
  let ready=false;
  async function checkStatus(){
    submit.disabled=true;
    try{
      const response=await fetch("/api/auth/status",{credentials:"same-origin",cache:"no-store"});
      if(!response.ok)throw Error("STATUS_UNAVAILABLE");
      const data=await response.json();
      ready=data.enabled===true;
      status.textContent=!ready
        ?"帳號服務尚未完成後端連線驗證（"+(data.reason||"STATUS_UNKNOWN")+"）。管理員可使用專用入口。"
        :!data.mail
          ?"帳號登入已可使用；註冊與重設密碼仍待寄信授權。"
          :"";
      submit.disabled=!ready;
    }catch{
      ready=false;
      status.textContent="目前無法確認帳號服務狀態，請稍後再試。";
    }
  }
  form.addEventListener("submit",async event=>{
    event.preventDefault();
    if(!form.reportValidity()||!ready)return;
    submit.disabled=true;
    submit.textContent="正在驗證帳號…";
    message.textContent="";
    try{
      const response=await fetch("/api/auth/login",{
        method:"POST",credentials:"same-origin",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          identifier:$("gen3Account").value.trim(),
          password:$("gen3Password").value
        })
      });
      const data=await response.json();
      if(!response.ok||data.success!==true)throw Error(data.message||"登入失敗");
      $("gen3Password").value="";
      message.textContent="登入成功，正在播放歡迎動畫…";
      if(typeof window.iKeyGen3Enter!=="function")throw Error("首頁程式尚未準備完成，請重新整理。");
      await window.iKeyGen3Enter();
    }catch(error){
      message.textContent=error.message||"登入失敗，請稍後再試。";
    }finally{
      submit.textContent="登入系統";
      submit.disabled=!ready;
    }
  });
  checkStatus();
});
