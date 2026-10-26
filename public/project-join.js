'use strict';
(()=>{
 const form=document.getElementById('project-join-form'),input=document.getElementById('join-code'),button=document.getElementById('join-submit'),status=document.getElementById('join-status');
 if(!form||!input||!button||!status)return;
 // The published API does not yet expose authenticated projectAccessJoin.
 // Keep the form non-operational until its GAS + Render authorization tests pass.
 button.disabled=true;
 form.addEventListener('submit',event=>{event.preventDefault();status.textContent='加入服務尚未發布，邀請碼沒有送出。';});
})();
