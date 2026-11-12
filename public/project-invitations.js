'use strict';
(()=>{
 const status=document.getElementById('pc-invitation-status');
 const list=document.getElementById('pc-invitation-list');
 const button=document.querySelector('[data-pc-open="members"]');
 if(!status||!list||!button)return;
 const id=new URLSearchParams(location.search).get('id');
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 if(!uuid.test(id||'')){status.textContent='專案 ID 無效。';return;}
 const names={pending:'等待加入',redeeming:'正在核銷',redeemed:'已加入',expired:'已過期',revoked:'已撤銷'};
 let ready=false,pending=false,loading=false;
 document.addEventListener('ikey:project-loaded',event=>{
  ready=event.detail?.project?.project_id===id;
  if(ready&&pending){pending=false;load();}
 });
 button.addEventListener('click',load);
 async function load(){
  if(!ready){pending=true;status.textContent='正在等待專案身分驗證…';return;}
  if(loading)return;
  loading=true;list.replaceChildren();status.textContent='正在驗證邀請紀錄…';
  try{
   const response=await fetch('/api/projects/'+encodeURIComponent(id)+'/invitations',{credentials:'same-origin',cache:'no-store'});
   const data=await response.json();
   if(!response.ok||data.success!==true||data.project_id!==id||!Array.isArray(data.invitations))throw Error('INVITATION_LIST_UNAVAILABLE');
   for(const invite of data.invitations){
    if(!invite||!uuid.test(invite.invitation_id)||!Object.prototype.hasOwnProperty.call(names,invite.status))throw Error('INVITATION_LIST_INVALID');
    const item=document.createElement('li');
    const label=document.createElement('strong');label.textContent=names[invite.status];
    const meta=document.createElement('span');meta.textContent='邀請編號：'+invite.invitation_id+' · 到期：'+String(invite.expires_at||'');
    item.append(label,meta);list.append(item);
   }
   status.textContent=data.invitations.length?'已驗證 '+data.invitations.length+' 筆邀請紀錄。':'目前沒有邀請紀錄。';
  }catch{
   list.replaceChildren();
   status.textContent='無法驗證邀請紀錄，請稍後重試。';
  }finally{loading=false;}
 }
})();
