'use strict';
(()=>{
 const pane=document.querySelector('[data-pc-pane="members"]');
 const status=document.getElementById('pc-member-status');
 const list=document.getElementById('pc-member-list');
 const button=document.querySelector('[data-pc-open="members"]');
 if(!pane||!status||!list||!button)return;
 const projectId=new URLSearchParams(location.search).get('id');
 let ready=false,loading=false;
 document.addEventListener('ikey:project-loaded',event=>{ready=event.detail?.project?.project_id===projectId;});
 button.addEventListener('click',async()=>{
  if(!ready||loading)return;
  loading=true;status.textContent='正在驗證專案成員…';list.replaceChildren();
  try{
   const response=await fetch('/api/projects/'+encodeURIComponent(projectId)+'/members',{credentials:'same-origin',cache:'no-store'});
   const data=await response.json();
   if(!response.ok||data.success!==true||!Array.isArray(data.members))throw Error('成員資料驗證失敗');
   for(const member of data.members){
    if(member.role!=='owner'||member.source!=='project_creator'||typeof member.user_id!=='string')continue;
    const item=document.createElement('li');
    const role=document.createElement('strong');role.textContent='專案建立者（Owner）';
    const user=document.createElement('span');user.textContent='使用者 ID：'+member.user_id;
    item.append(role,user);list.append(item);
   }
   status.textContent=data.membership_inventory_complete===false?'已驗證專案建立者；其他成員名冊尚未完成整合。':'成員資料已載入。';
  }catch(err){status.textContent='無法讀取成員資料，請稍後重試。';}
  finally{loading=false;}
 });
})();
