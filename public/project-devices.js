'use strict';
(()=>{
 const get=id=>document.getElementById(id);
 const id=new URLSearchParams(location.search).get('id');
 const error=get('error'),status=get('device-status'),content=get('admin-content');
 if(!id||!/^[0-9a-f-]{36}$/i.test(id)){error.hidden=false;error.textContent='缺少有效的專案 ID。';return;}
 get('back-link').href='/project.html?id='+encodeURIComponent(id);
 const load=async()=>{
  try{
   const response=await fetch('/api/projects/'+encodeURIComponent(id),{credentials:'same-origin',cache:'no-store'});
   const data=await response.json();
   if(!response.ok||!data.success||!data.project)throw Error(data.message||'無法讀取專案');
   if(data.project.project_role&&data.project.project_role!=='admin')throw Error('只有專案管理員可以開啟裝置管理');
   get('project-label').textContent=data.project.project_name+' · 管理員';
   content.hidden=false;
   // Fail closed: no registered-device API exists yet. Never invent devices.
   status.textContent='裝置登錄與讀取 API 尚未啟用，無法驗證實際裝置清單。';
   get('device-grid').replaceChildren();
   const empty=document.createElement('p');
   empty.className='empty-state';
   empty.textContent='目前無法取得已驗證的裝置。完成出廠登錄、權限與資料庫串接後，裝置會以格狀顯示在這裡。';
   get('device-grid').append(empty);
  }catch(e){error.hidden=false;error.textContent=e.message||'無法載入裝置管理';}
 };
 get('add-device').addEventListener('click',()=>get('add-dialog').showModal());
 get('add-dialog').addEventListener('close',()=>{get('factory-device-id').value='';get('factory-device-password').value='';});
 get('device-search').addEventListener('input',()=>{
  // Search is ready for real device cards; empty/unverified state remains explicit.
  const q=get('device-search').value.trim().toLocaleLowerCase();
  for(const card of get('device-grid').querySelectorAll('[data-device-id]')){
   card.hidden=!(card.dataset.deviceId+' '+card.dataset.deviceName).toLocaleLowerCase().includes(q);
  }
 });
 load();
})();