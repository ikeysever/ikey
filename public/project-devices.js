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
    const settings=document.createElement('button');settings.type='button';settings.textContent='設定';
    settings.addEventListener('click',()=>{
     get('device-id').value=String(device.device_id||'');
     get('device-name').value=String(device.display_name||device.device_id||'');
     get('device-lock-mode').value=device.lock_mode==='open'?'open':'locked';
     get('device-heartbeat').value=String(device.heartbeat_interval_minutes||5);
     get('device-auto-update').checked=device.auto_firmware_update===true;
     get('settings-message').textContent='';get('settings-dialog').showModal();
    });
    card.append(title,detail,settings);grid.append(card);
   }
   if(!deviceData.devices.length){const empty=document.createElement('p');empty.className='empty-state';empty.textContent='此專案尚無已綁定裝置。';grid.append(empty);}
   status.textContent='已讀取 '+deviceData.devices.length+' 台已綁定裝置（不代表設備在線）。';
  }catch(e){error.hidden=false;error.textContent=e.message||'無法載入裝置管理';}
 };
 get('add-device').addEventListener('click',()=>get('add-dialog').showModal());
 get('add-dialog').addEventListener('close',()=>{get('factory-device-id').value='';get('factory-device-password').value='';});
 get('bind-device').addEventListener('click',async()=>{
  const deviceId=get('factory-device-id').value.trim();
  const password=get('factory-device-password').value;
  const message=get('bind-message');
  const button=get('bind-device');
  message.textContent='';
  if(!/^[A-Za-z0-9_-]{6,64}$/.test(deviceId)||password.length<8){message.textContent='請輸入有效的出廠裝置 ID 與密碼。';return;}
  button.disabled=true;
  try{
   const response=await fetch('/api/projects/'+encodeURIComponent(id)+'/devices/bind',{
    method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({device_id:deviceId,password})
   });
   const data=await response.json();
   if(!response.ok||!data.success)throw Error(data.message||'綁定失敗');
   get('factory-device-password').value='';
   get('add-dialog').close();
   await load();
  }catch(e){message.textContent=e.message||'裝置服務未就緒，請稍後再試。';}
  finally{get('factory-device-password').value='';button.disabled=false;}
 });
 get('save-device-settings').addEventListener('click',async()=>{
  const button=get('save-device-settings'),message=get('settings-message');
  const deviceId=get('device-id').value;
  const body={display_name:get('device-name').value.trim(),lock_mode:get('device-lock-mode').value,
   heartbeat_interval_minutes:Number(get('device-heartbeat').value),auto_firmware_update:get('device-auto-update').checked};
  if(!body.display_name||body.display_name.length>64||!Number.isInteger(body.heartbeat_interval_minutes)||
   body.heartbeat_interval_minutes<1||body.heartbeat_interval_minutes>1440){message.textContent='請檢查裝置名稱與心跳間隔。';return;}
  button.disabled=true;message.textContent='正在儲存…';
  try{
   const response=await fetch('/api/projects/'+encodeURIComponent(id)+'/devices/'+encodeURIComponent(deviceId),{
    method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
   });
   const data=await response.json();
   if(!response.ok||!data.success)throw Error(data.message||'儲存失敗');
   get('settings-dialog').close();await load();
  }catch(e){message.textContent=e.message||'裝置設定服務尚未就緒';}
  finally{button.disabled=false;}
 });
 get('device-search').addEventListener('input',()=>{
  // Search is ready for real device cards; empty/unverified state remains explicit.
  const q=get('device-search').value.trim().toLocaleLowerCase();
  for(const card of get('device-grid').querySelectorAll('[data-device-id]')){
   card.hidden=!(card.dataset.deviceId+' '+card.dataset.deviceName).toLocaleLowerCase().includes(q);
  }
 });
 load();
})();