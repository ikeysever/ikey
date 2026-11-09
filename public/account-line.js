'use strict';
(()=>{
 const byId=id=>document.getElementById(id),status=byId('line-binding-status'),message=byId('line-binding-message'),bind=byId('line-bind-button'),unbind=byId('line-unbind-button'),form=byId('line-unbind-form'),password=byId('line-password'),code=byId('line-code'),count=byId('line-countdown');
 if(!status||!bind)return;
 let csrf='',bindingId=null,expiry=0,poll=null,tick=null,busy=false,stopped=false,waiting=false,generation=0,mutable=false;
 const stop=()=>{clearTimeout(poll);clearInterval(tick);poll=tick=null;};
 function countdown(){const seconds=Math.max(0,Math.ceil((expiry-Date.now())/1000));count.textContent=seconds?'有效時間 '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'):'驗證碼已到期';if(!seconds){waiting=false;code.textContent='';stop();}}
 async function request(path,body){
  const response=await fetch(path,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000),...(body?{method:'POST',headers:{'Content-Type':'application/json','X-Ikey-Line-Csrf':csrf},body:JSON.stringify(body)}:{})});
  const data=await response.json();if(response.status===401){stop();csrf='';bind.disabled=true;unbind.hidden=true;form.hidden=true;password.value='';code.textContent='';}
  if(!response.ok)throw Error(data.status==='wrong_password'?'密碼錯誤。':data.status==='rate_limited'?'操作太頻繁，請稍後再試。':response.status===401?'請重新登入。':data.message||'服務暫時無法確認操作，請查詢狀態後再試。');
  return data;
 }
 function schedule(){clearTimeout(poll);if(waiting&&!document.hidden&&!stopped)poll=setTimeout(refresh,5000);}
 async function refresh(){
  if(stopped)return;
  const current=++generation;
  try{
   const data=await request('/api/line/status');if(current!==generation||stopped)return;csrf=data.csrf_token||'';bindingId=data.binding_id;
   mutable=data.challenge_status!=='unknown';const bound=data.binding_status==='bound';status.textContent=bound?'已綁定':'未綁定';
   unbind.hidden=!bound;bind.hidden=bound;bind.disabled=busy||!csrf||!mutable;unbind.disabled=busy||!mutable;bind.textContent=waiting?'重新產生驗證碼':'綁定 LINE';
   if(bound&&data.challenge_status!=='unknown'){waiting=false;code.textContent='';count.textContent='';stop();message.textContent='LINE 綁定已完成。';}
   else if(data.challenge_status==='unknown'){waiting=false;stop();bind.disabled=true;code.textContent='';message.textContent='操作結果尚待核對，暫停新綁定，請聯絡系統維護人員。';}
   else if(data.challenge_status==='pending'){
    waiting=true;expiry=Date.now()+Math.max(0,Date.parse(data.expires_at)-Date.parse(data.server_time));
    message.textContent=code.textContent?'請將這組六位驗證碼傳送至 iKey 官方 LINE。':'有一組待驗證申請；若已離開原畫面，可重新產碼。';
    clearInterval(tick);tick=setInterval(countdown,1000);countdown();schedule();
   }else{waiting=false;stop();code.textContent='';count.textContent='';message.textContent='可產生驗證碼，傳送至既有 iKey 官方 LINE 完成綁定。';}
  }catch(error){if(current!==generation||stopped)return;stop();waiting=false;mutable=false;code.textContent='';bind.disabled=true;unbind.disabled=true;message.textContent=error.message;status.textContent='暫時無法查詢';}
 }
 bind.addEventListener('click',async()=>{
  if(busy)return;busy=true;generation++;bind.disabled=true;stop();
  try{const data=await request('/api/line/bind/start',{});code.textContent=data.code;waiting=true;expiry=Date.now()+Date.parse(data.expires_at)-Date.parse(data.server_time);countdown();await refresh();}
  catch(error){code.textContent='';message.textContent=error.message;}
  finally{busy=false;bind.disabled=!csrf||!mutable||status.textContent==='暫時無法查詢';}
 });
 unbind.addEventListener('click',()=>{form.hidden=false;password.focus();});
 byId('line-unbind-cancel').addEventListener('click',()=>{form.hidden=true;password.value='';});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;busy=true;generation++;stop();const submit=form.querySelector('[type=submit]');submit.disabled=true;
  try{await request('/api/line/unbind',{password:password.value,binding_id:bindingId});form.hidden=true;await refresh();}
  catch(error){message.textContent=error.message;}
  finally{password.value='';busy=false;submit.disabled=false;}
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden){generation++;stop();}else refresh();});
 window.addEventListener('pagehide',()=>{stopped=true;generation++;stop();password.value='';code.textContent='';});
 window.addEventListener('pageshow',event=>{if(event.persisted){stopped=false;refresh();}});
 byId('logout')?.addEventListener('click',()=>{stopped=true;generation++;stop();password.value='';code.textContent='';});
 byId('line-refresh-button').addEventListener('click',refresh);
 refresh();
})();
