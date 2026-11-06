'use strict';
(()=>{
 const get=id=>document.getElementById(id);
 const id=new URLSearchParams(location.search).get('id');
 const error=get('error'),status=get('device-status'),content=get('admin-content');
 if(!id||!/^[0-9a-f-]{36}$/i.test(id)){error.hidden=false;error.textContent='缺少有效的專案 ID。';return;}
 get('back-link').href='/project.html?id='+encodeURIComponent(id);
 const load=async()=>{
  try{
   const response=await fetch('/api/projects',{credentials:'same-origin',cache:'no-store'});
   const data=await response.json();
   if(!response.ok||!data.success)throw Error(data.message||'無法讀取專案');
   const project=(data.projects||[]).find(p=>p.project_id===id);
   if(!project)throw Error('找不到專案或沒有管理權限');
   
   get('project-label').textContent=project.project_name+' · 管理員';
   content.hidden=false;
   const deviceResponse=await fetch('/api/projects/'+encodeURIComponent(id)+'/devices',{credentials:'same-origin',cache:'no-store'});
   const inventory=await deviceResponse.json();
   if(!deviceResponse.ok||!inventory.success||!Array.isArray(inventory.devices))
    throw Error('裝置清單尚未通過後端驗證，請稍後再試。');
   const grid=get('device-grid');
   grid.replaceChildren();
   if(inventory.devices.length===0){
    const empty=document.createElement('p');
    empty.className='empty-state';
    empty.textContent='此專案目前沒有已綁定的 iBOX。裝置綁定功能尚未開放。';
    grid.append(empty);
   }
   for(const device of inventory.devices){
    const card=document.createElement('article');
    card.className='device-card';
    card.dataset.deviceId=device.device_id;
    card.dataset.deviceName=device.device_name;
    const title=document.createElement('h3');
    title.textContent=device.device_name||'iBOX';
    const detail=document.createElement('p');
    detail.textContent='裝置 ID：'+device.device_id;
    const connection=document.createElement('p');
    connection.textContent='連線狀態：尚未驗證 · 控制功能未啟用';
    card.append(title,detail,connection);
    grid.append(card);
   }
   status.textContent='已讀取 '+inventory.devices.length+' 台已綁定裝置；連線與控制狀態尚未驗證。';
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