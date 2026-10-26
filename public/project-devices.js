'use strict';
(()=>{
 const get=id=>document.getElementById(id);
 const projectId=new URLSearchParams(location.search).get('id');
 const error=get('error'),status=get('device-status'),content=get('admin-content');
 let selectedDeviceId='';
 const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const api=async(url,options={})=>{
  const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});
  let data={};
  try{data=await response.json();}catch{}
  if(!response.ok)throw Error(data.message||data.code||('HTTP '+response.status));
  return data;
 };
 if(!projectId||!/^[0-9a-f-]{36}$/i.test(projectId)){
  error.hidden=false;error.textContent='缺少有效的專案 ID。';return;
 }
 get('back-link').href='/project.html?id='+encodeURIComponent(projectId);

 function textElement(tag,className,text){
  const el=document.createElement(tag);
  if(className)el.className=className;
  el.textContent=text;
  return el;
 }
 function normalizeDeviceStatus(device){
  const connection=device.connection_status;
  const connected=['connected','online','verified'].includes(String(connection||'').toLowerCase());
  const connecting=['connecting','pending'].includes(String(connection||'').toLowerCase());
  const lockOpen=device.lock_status==='unlocked'||device.feedback_open===true;
  const doorClosed=device.door_status==='closed'||device.cabinet_door_closed===true;
  return {
   network:connecting?{text:'連線中',className:'status-connecting'}:
    connected?{text:'連線中',className:'status-online'}:
    {text:'未連線',className:'status-offline'},
   lock:lockOpen?{text:'已解鎖',className:'status-unlocked'}:
    {text:'尚未回報',className:'status-unknown'},
   door:doorClosed?{text:'櫃門關閉',className:'status-closed'}:
    {text:'尚未回報',className:'status-unknown'}
  };
 }
 function updateLiveStatus(device){
  const s=normalizeDeviceStatus(device);
  for(const [id,value] of [['device-network-state',s.network],['device-lock-state',s.lock],['device-door-state',s.door]]){
   const el=get(id);
   if(!el)continue;
   el.textContent=value.text;
   el.className='status-pill '+value.className;
  }
  const note=get('device-live-status-note');
  if(note){
   const hasLive= ['connected','online','verified'].includes(String(device.connection_status||'').toLowerCase()) ||
    device.feedback_open===true || typeof device.lock_status==='string' ||
    typeof device.door_status==='string' || typeof device.cabinet_door_closed==='boolean';
   note.textContent=hasLive?'狀態依 API 最新回報顯示。':'目前 API 尚未提供即時心跳、開鎖回授及櫃門感測資料，因此鎖具與櫃門狀態不會被猜測。';
  }
 }
 function renderDevices(devices){
  const grid=get('device-grid');
  grid.replaceChildren();
  const q=get('device-search').value.trim().toLocaleLowerCase();
  const filtered=devices.filter(d=>(d.device_id||'').toLocaleLowerCase().includes(q));
  if(!filtered.length){
   grid.append(textElement('p','empty-state',devices.length?'沒有符合搜尋條件的裝置。':'目前沒有可顯示的預登錄裝置。'));
   return;
  }
  for(const device of filtered){
   const card=textElement('article','device-card','');
   card.dataset.deviceId=device.device_id;
   card.dataset.deviceName=device.device_id;
   card.append(textElement('h2','device-card-title','裝置 '+device.device_id));
   card.append(textElement('p','device-meta','登錄狀態：'+(device.registration_status||'unknown')));
   const live=normalizeDeviceStatus(device);
   const statusRow=textElement('div','device-status-row','');
   for(const value of [live.network,live.lock,live.door]){
    statusRow.append(textElement('span','status-pill '+value.className,value.text));
   }
   card.append(statusRow);
   const button=textElement('button','device-settings-button','裝置設定 →');
   button.type='button';
   button.addEventListener('click',()=>openSettings(device.device_id));
   card.append(button);
   grid.append(card);
  }
 }
 async function load(){
  try{
   const data=await api('/api/projects');
   const project=(data.projects||[]).find(p=>p.project_id===projectId);
   if(!project)throw Error('找不到專案或沒有管理權限');
   get('project-label').textContent=project.project_name+' · 管理員';
   content.hidden=false;
   status.textContent='正在讀取已登錄裝置…';
   const devicesData=await api('/api/devices');
   const devices=Array.isArray(devicesData.devices)?devicesData.devices:[];
   renderDevices(devices);
   status.textContent=devicesData.limited?'已載入裝置（清單達 100 筆上限）。':'已載入 '+devices.length+' 台預登錄裝置；實體連線尚未驗證。';
  }catch(e){
   error.hidden=false;
   error.textContent=e.message||'無法載入裝置管理';
  }
 }
 async function openSettings(deviceId){
  selectedDeviceId=deviceId;
  get('device-id').value=deviceId;
  get('device-registration-status').value='查詢中…';
  get('device-connection-status').value='連線中…';
  updateLiveStatus({connection_status:'connecting'});
  get('device-unlock-status');
  get('unlock-test-status').textContent='尚未執行測試。';
  get('unlock-test').disabled=false;
  get('settings-dialog').showModal();
  try{
   const data=await api('/api/devices/'+encodeURIComponent(deviceId)+'/status');
   get('device-registration-status').value=data.registration_status||'unknown';
   get('device-connection-status').value=['connected','online','verified'].includes(String(data.connection_status||'').toLowerCase())?'已連線':'未連線';
   updateLiveStatus(data);
   get('unlock-test').disabled=false;
   if(!data.control_ready)get('unlock-test-status').textContent='目前只有裝置登錄資料，實體控制尚未啟用；可嘗試 staging 模擬測試。';
  }catch(e){
   get('device-registration-status').value='無法確認';
   get('unlock-test-status').textContent='裝置狀態讀取失敗：'+e.message;
  }
 }
 async function runUnlockSimulation(){
  if(!selectedDeviceId)return;
  const button=get('unlock-test'),output=get('unlock-test-status');
  if(!window.confirm('確認對裝置 '+selectedDeviceId+' 建立一筆「模擬開鎖」測試指令？此操作不代表實體門鎖會開啟。'))return;
  button.disabled=true;
  output.textContent='正在建立 staging 模擬指令…';
  try{
   const key='unlock-'+crypto.randomUUID();
   const created=await api('/api/device-commands',{
    method:'POST',
    headers:{'Content-Type':'application/json','Idempotency-Key':key},
    body:JSON.stringify({device_id:selectedDeviceId,command:'unlock',timeout_ms:15000})
   });
   const command=created.command;
   if(!command||!command.command_id)throw Error('伺服器沒有回傳有效指令 ID');
   output.textContent='指令已建立，等待 ESP32 取得並回報。狀態：'+command.status+'。';
   const deadline=Date.now()+17000;
   while(Date.now()<deadline){
    await delay(1500);
    const state=await api('/api/device-commands/'+encodeURIComponent(command.command_id));
    const current=state.command;
    if(!current)throw Error('找不到模擬指令');
    if(['succeeded','failed','timed_out'].includes(current.status)){
     const labels={succeeded:'裝置回報執行成功（模擬流程；未證明實體門鎖已開）',failed:'裝置回報執行失敗',timed_out:'指令逾時，未收到有效結果回報'};
     output.textContent=labels[current.status]||current.status;
     return;
    }
    output.textContent='指令狀態：'+current.status+'；等待裝置回報…';
   }
   output.textContent='目前尚未收到完成回報。請確認模擬 API 已啟用且 ESP32 有輪詢指令；本次不會宣稱開鎖成功。';
  }catch(e){
   output.textContent='測試未完成：'+e.message+'。請確認 staging 模擬 API 已啟用；正式環境未受影響。';
  }finally{
   button.disabled=false;
  }
 }
 get('add-device').addEventListener('click',()=>get('add-dialog').showModal());
 get('add-dialog').addEventListener('close',()=>{
  get('factory-device-id').value='';
  get('factory-device-password').value='';
 });
 get('device-search').addEventListener('input',()=>{
  const q=get('device-search').value.trim().toLocaleLowerCase();
  for(const card of get('device-grid').querySelectorAll('[data-device-id]')){
   card.hidden=!(card.dataset.deviceId+' '+card.dataset.deviceName).toLocaleLowerCase().includes(q);
  }
 });
 get('unlock-test').addEventListener('click',runUnlockSimulation);
 load();
})();