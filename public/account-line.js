'use strict';
(async()=>{
 const status=document.getElementById('line-binding-status');
 const message=document.getElementById('line-binding-message');
 const button=document.getElementById('line-bind-button');
 if(!status||!message||!button)return;
 button.disabled=true;button.setAttribute('aria-disabled','true');
 try{
  const response=await fetch('/api/line/status',{credentials:'same-origin',cache:'no-store'});
  const data=await response.json();
  if(response.status===401){status.textContent='請先登入 iKey';message.textContent='請登入後再查看 LINE 綁定狀態。';return;}
  status.textContent=data.available===true?'功能待驗證':'尚未開放';
  message.textContent='尚未建立可持久保存的 LINE 綁定資料庫，為避免錯誤綁定，暫不開放操作。';
 }catch{status.textContent='暫時無法查詢';message.textContent='無法確認 LINE 服務狀態，請稍後再試。';}
})();
