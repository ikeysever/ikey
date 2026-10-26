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
   if(data.project.project_role!=='admin')throw Error('只有專案管理員可以開啟裝置管理');
   get('project-label').textContent=data.project.project_name+' · 管理員';
   content.hidden=false;
   const deviceResponse=await fetch('/api/projects/'+encodeURIComponent(id)+'/devices',{credentials:'same-origin',cache:'no-store'});
   const deviceData=await deviceResponse.json();
   if(!deviceResponse.ok||!deviceData.success||!Array.isArray(deviceData.devices))throw Error(deviceData.message||'無法驗證裝置清單');
   const grid=get('device-grid');grid.replaceChildren();
   for(const device of deviceData.devices){
    const card=document.createElement('article');card.className='device-card';
    card.dataset.deviceId=String(device.device_id||'');
    card.dataset.deviceName=String(device.display_name||'');
    const title=document.createElement('h3');title.textContent=card.dataset.deviceName||card.dataset.deviceId;
    const detail=document.createElement('p');detail.textContent='裝置 ID：'+card.dataset.deviceId+' · 模式：'+String(device.lock_mode||'未設定');
    card.append(title,detail);grid.append(card);
   }
   if(!deviceData.devices.length){const empty=document.createElement('p');empty.className='empty-state';empty.textContent='此專案尚無已綁定裝置。';grid.append(empty);}
   status.textContent='已讀取 '+deviceData.devices.length+' 台已綁定裝置（不代表設備在線）。';
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