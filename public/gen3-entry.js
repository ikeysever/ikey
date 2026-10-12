"use strict";
// Primary Gen3 login. The legacy administrator form is opt-in and never uses Gen3 credentials.
document.addEventListener("DOMContentLoaded",()=>{
  const $=id=>document.getElementById(id);
  const panel=$("gen3LoginPanel"),legacy=$("legacyLoginPanel");
  const form=$("gen3LoginForm"),submit=$("gen3LoginSubmit");
  const message=$("gen3LoginMessage"),status=$("gen3AuthStatus"),google=$("googleLoginLink");
  if(!panel||!legacy||!form||!submit||!message||!status||!google)return;
  const legacyRequested=new URLSearchParams(location.search).get("legacy")==="1";
  panel.hidden=legacyRequested;
  legacy.hidden=!legacyRequested;
  let ready=false,googleReady=false;
  async function checkStatus(){
    submit.disabled=true;
    try{
      const response=await fetch("/api/auth/status",{credentials:"same-origin",cache:"no-store"});
      if(!response.ok)throw Error("STATUS_UNAVAILABLE");
      const data=await response.json();
      ready=data.enabled===true;
      googleReady=ready&&data.google===true;
      status.textContent=!ready
        ?"第三代帳號後端尚未完成連線驗證。管理員可使用下方專用入口登入。"
        :!data.mail
          ?"帳號登入已可使用；註冊與重設密碼仍待 MailApp 寄信授權。"
          :!googleReady
            ?"第三代帳號登入、註冊與密碼重設已開放；Google 登入尚待設定。"
            :"第三代帳號系統已開放。";
      submit.disabled=!ready;
    }catch{
      ready=false;
      status.textContent="目前無法確認第三代帳號服務狀態，請稍後再試。";
    }
    if(!googleReady){
      google.setAttribute("aria-disabled","true");
      google.title="Google 登入尚未完成設定";
    }else{
      google.removeAttribute("aria-disabled");
      google.removeAttribute("title");
    }
  }
  google.addEventListener("click",event=>{
    if(googleReady)return;
    event.preventDefault();
    message.textContent="Google 登入尚未完成設定，目前無法使用。";
  });
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
