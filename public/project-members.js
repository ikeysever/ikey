'use strict';
(()=>{
 const pane=document.querySelector('[data-pc-pane="members"]');
 const status=document.getElementById('pc-member-status');
 const list=document.getElementById('pc-member-list');
 const button=document.querySelector('[data-pc-open="members"]');
 if(!pane||!status||!list||!button)return;
 const projectId=new URLSearchParams(location.search).get('id');
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 if(!projectId||!uuid.test(projectId)){status.textContent='專案 ID 無效，無法載入成員。';return;}
 const roleLabels=Object.freeze({owner:'專案擁有者',admin:'專案管理員',manager:'管理員',member:'專案成員',viewer:'檢視者'});
 let ready=false,loading=false,pending=false;
 document.addEventListener('ikey:project-loaded',event=>{
  ready=event.detail?.project?.project_id===projectId;
  if(ready&&pending){pending=false;loadMembers();}
 });
 button.addEventListener('click',()=>{loadMembers();});
 async function loadMembers(){
  if(!ready){pending=true;status.textContent='正在載入專案資料，完成後會自動驗證成員…';return;}
  if(loading)return;
  loading=true;status.textContent='正在驗證專案成員…';list.replaceChildren();
  try{
   const response=await fetch('/api/projects/'+encodeURIComponent(projectId)+'/members',{credentials:'same-origin',cache:'no-store'});
   const data=await response.json();
   if(!response.ok||data.success!==true||!Array.isArray(data.members))throw Error('成員資料驗證失敗');
   // Display only records the authorized API actually returned; never fabricate members.
   let shown=0;
   for(const member of data.members){
    if(!member||typeof member.user_id!=='string'||!uuid.test(member.user_id))continue;
    const item=document.createElement('li');
    const role=document.createElement('strong');
    role.textContent=member.role==='owner'&&member.source==='project_creator'
     ?'專案建立者（Owner）':(roleLabels[member.role]||'專案成員（角色待確認）');
    const user=document.createElement('span');
    user.textContent='使用者 ID：'+member.user_id;
    item.append(role,user);list.append(item);shown++;
   }
   const complete=data.membership_inventory_complete===true;
   if(!shown){
    const empty=document.createElement('li');
    empty.textContent=complete?'目前沒有可顯示的成員。':'目前沒有可驗證的成員資料。';
    list.append(empty);
   }
   status.textContent=complete
    ?'已載入 '+shown+' 位成員。'
    :'已顯示 '+shown+' 位可驗證成員；後端尚未確認完整名冊，請勿將此清單視為所有成員。';
  }catch{
   status.textContent='無法讀取成員資料，請稍後重試。';
  }finally{loading=false;}
 }
})();
