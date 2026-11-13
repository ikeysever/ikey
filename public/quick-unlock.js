'use strict';
(()=>{
 const $=id=>document.getElementById(id),dialog=$('quick-unlock-dialog');
 if(!dialog)return;
 const device=$('quick-device'),manual=$('quick-device-input'),status=$('quick-unlock-status'),submit=$('quick-unlock-submit');
 let devices=[],busy=false,loading=false,loadSequence=0;
 const setStatus=s=>{status.textContent=s};
 const request=async url=>{const r=await fetch(url,{credentials:'same-origin',cache:'no-store'});const data=await r.json();if(!r.ok||data.success!==true)throw Error(data.message||'無法取得資料');return data};
 const selected=()=>{
  const typed=manual.value.trim().toUpperCase();
  if(typed){const matches=devices.filter(d=>d.device_id===typed&&d.control_ready===true);return matches.length===1?matches[0]:null;}
  return devices.find(d=>d.project_id+':'+d.device_id===device.value&&d.control_ready===true)||null;
 };
 const update=()=>{submit.disabled=busy||loading||!selected();};
 async function loadDevices(){
  const sequence=++loadSequence;loading=true;devices=[];manual.value='';device.disabled=true;device.replaceChildren(new Option('正在載入所有專案的裝置…',''));update();
  try{
   const result=await request('/api/projects');
   const projects=(result.projects||[]).filter(p=>p.project_id&&p.status!=='deleted');
   const outcomes=await Promise.allSettled(projects.map(p=>request('/api/projects/'+encodeURIComponent(p.project_id)+'/devices')));
   if(sequence!==loadSequence)return;
   const errors=[];const seen=new Set();
   for(let i=0;i<projects.length;i++){
    const outcome=outcomes[i],p=projects[i];
    if(outcome.status==='rejected'){errors.push(p.project_name||p.project_id);continue;}
    for(const d of outcome.value.devices||[]){
     if(d.project_id!==p.project_id)continue;
     const key=d.project_id+':'+d.device_id;
     if(seen.has(key))continue;seen.add(key);
     devices.push({...d,project_name:p.project_name||'未命名專案'});
    }
   }
   device.replaceChildren(new Option('請選擇 iBOX（所有專案）',''));
   for(const d of devices){
    const label=d.project_name+' / '+(d.device_name||'iBOX')+' · '+d.device_id+(d.control_ready===true?'':'（尚不可開鎖）');
    const option=new Option(label,d.project_id+':'+d.device_id);
    option.disabled=d.control_ready!==true;
    device.add(option);
   }
   device.disabled=!devices.some(d=>d.control_ready===true);
   const count=devices.filter(d=>d.control_ready===true).length;
   setStatus(count?'已載入 '+projects.length+' 個專案、'+devices.length+' 台裝置，其中 '+count+' 台顯示可選取。'+(errors.length?'部分專案讀取失敗：'+errors.join('、'):''):'目前沒有已驗證、可開鎖的 iBOX。'+(errors.length?'部分專案讀取失敗：'+errors.join('、'):''));
  }catch(e){if(sequence===loadSequence){device.replaceChildren(new Option('裝置資料載入失敗',''));setStatus('無法取得專案裝置：'+e.message)}}
  finally{if(sequence===loadSequence){loading=false;update()}}
 }
 $('quick-unlock-open').addEventListener('click',()=>{dialog.showModal();loadDevices();loadAdminRegistration()});
 device.addEventListener('change',()=>{manual.value='';update()});
 manual.addEventListener('input',()=>{
  const normalized=manual.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
  if(manual.value!==normalized)manual.value=normalized;
  update();
  if(normalized.length===8){
   const matches=devices.filter(d=>d.device_id===normalized&&d.control_ready===true);
   if(matches.length>1)setStatus('此裝置出現在多個專案，請改用上方清單選擇所屬專案。');
   else if(!matches.length)setStatus('此裝置不在已加入專案的可開鎖清單，請確認編號及授權狀態。');
   else setStatus('已找到 '+matches[0].project_name+' 的裝置 '+normalized+'。');
  }
 });
 $('quick-nfc-start').addEventListener('click',async()=>{
  if(!('NDEFReader' in window)){setStatus('此瀏覽器不支援 Web NFC。iPhone 請使用系統 NFC 標籤讀取功能；尚未設定裝置專屬的安全連結。');return;}
  try{
   const reader=new NDEFReader();await reader.scan();setStatus('請將手機靠近 NFC 標籤。');
   reader.onreading=event=>{
    let id='';
    for(const record of event.message.records){if(record.recordType==='text'){try{id=new TextDecoder(record.encoding||'utf-8').decode(record.data).trim().toUpperCase()}catch{}}}
    if(!/^[A-HJ-NP-Z2-9]{8}$/.test(id)){setStatus('無法識別裝置標籤，請手動輸入。');return;}
    const matches=devices.filter(d=>d.device_id===id&&d.control_ready===true);
    if(matches.length!==1){setStatus(matches.length?'此裝置出現在多個專案，請用清單選擇。':'裝置不屬於已加入專案或尚未授權。');return;}
    manual.value=id;device.value='';update();setStatus('已辨識 '+matches[0].project_name+' / '+id+'，請確認後開鎖。');
   };
  }catch(e){setStatus('NFC 無法啟動：'+e.message)}
 });
 submit.addEventListener('click',async()=>{
  const target=selected();if(!target||busy)return;
  busy=true;update();setStatus('正在確認裝置授權與送出開鎖請求…');
  try{
   const r=await fetch('/api/projects/'+encodeURIComponent(target.project_id)+'/devices/'+encodeURIComponent(target.device_id)+'/unlock',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}',cache:'no-store'});
   const data=await r.json();
   if(!r.ok||data.success!==true)throw Error(data.message||'開鎖服務未就緒');
   if(data.execution_verified===true&&data.execution_status==='completed'&&data.device_id===target.device_id&&data.project_id===target.project_id)setStatus('✓ 開鎖完成');
   else setStatus('開鎖請求已受理，但尚未收到實體裝置成功回報；不能判定開鎖完成。');
  }catch(e){setStatus('未確認開鎖完成：'+e.message)}
  finally{busy=false;update()}
 });
 const renameProject=$('quick-rename-project'),renameDevice=$('quick-rename-device'),renameName=$('quick-rename-name'),renameStatus=$('quick-rename-status');
 function renderRenameDevices(){
  renameDevice.replaceChildren(new Option('請選擇 iBOX',''));
  for(const d of managedDevices.filter(x=>x.project_id===renameProject.value))renameDevice.add(new Option((d.device_name||'iBOX')+' · '+d.device_id,d.device_id));
 }
 renameProject.addEventListener('change',renderRenameDevices);
 renameDevice.addEventListener('change',()=>{const d=managedDevices.find(x=>x.project_id===renameProject.value&&x.device_id===renameDevice.value);renameName.value=d?.device_name||''});
 $('quick-rename-submit').addEventListener('click',async()=>{
  const projectId=renameProject.value,deviceId=renameDevice.value,name=renameName.value.trim();
  if(!projectId||!deviceId||!name||name.length>80){renameStatus.textContent='請選擇專案、iBOX 並輸入 1～80 字元名稱。';return;}
  renameStatus.textContent='正在儲存…';
  try{
   const response=await fetch('/api/projects/'+encodeURIComponent(projectId)+'/devices/'+encodeURIComponent(deviceId)+'/display-name',{method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({display_name:name})});
   const result=await response.json();if(!response.ok||!result.success)throw Error(result.message||'更新失敗');
   const d=managedDevices.find(x=>x.project_id===projectId&&x.device_id===deviceId);if(d)d.device_name=name;
   renderRenameDevices();renameDevice.value=deviceId;renameStatus.textContent='已更新 iBOX 名稱：'+name+'（裝置 ID 不變）';await loadDevices();
  }catch(e){renameStatus.textContent='更新失敗：'+e.message}
 });
 const registerProject=$('quick-slot-project'),registerDevice=$('quick-slot-device'),registerMessage=$('quick-slot-register-status');
 let managedDevices=[];
 function renderRegisterDevices(){
  const p=registerProject.value;
  registerDevice.replaceChildren(new Option('請選擇 iBOX',''));
  for(const d of managedDevices.filter(x=>x.project_id===p))registerDevice.add(new Option((d.device_name||'iBOX')+' · '+d.device_id,d.device_id));
 }
 registerProject.addEventListener('change',renderRegisterDevices);
 async function loadAdminRegistration(){
  registerProject.replaceChildren(new Option('正在讀取可管理專案…',''));registerDevice.replaceChildren(new Option('請先選擇專案',''));
  try{
   const data=await request('/api/projects');
   const projects=(data.projects||[]).filter(p=>p.project_id&&p.status!=='deleted');
   const outcomes=await Promise.allSettled(projects.map(p=>request('/api/projects/'+encodeURIComponent(p.project_id)+'/devices')));
   managedDevices=[];registerProject.replaceChildren(new Option('請選擇專案',''));renameProject.replaceChildren(new Option('請選擇專案',''));
   for(let i=0;i<projects.length;i++){
    const o=outcomes[i],p=projects[i];
    if(o.status!=='fulfilled'||o.value.can_manage!==true)continue;
    registerProject.add(new Option(p.project_name,p.project_id));renameProject.add(new Option(p.project_name,p.project_id));
    managedDevices.push(...(o.value.devices||[]).filter(d=>d.project_id===p.project_id));
   }
   renderRenameDevices();registerMessage.textContent=registerProject.options.length>1?'可登錄管理專案的格位。':'目前沒有可管理的專案。';
  }catch(e){registerMessage.textContent='無法載入管理專案：'+e.message}
 }
 $('quick-slot-register').addEventListener('click',async()=>{
  const project_id=registerProject.value,device_id=registerDevice.value;
  const slot_code=$('quick-slot-register-code').value.trim().toUpperCase();
  const slot_number=Number($('quick-slot-number').value);
  if(!project_id||!device_id||!/^[A-Z0-9_-]{4,40}$/.test(slot_code)||!Number.isSafeInteger(slot_number)||slot_number<1){registerMessage.textContent='請填寫專案、iBOX、4～40 位格位編號與正整數格位序號。';return;}
  registerMessage.textContent='正在登錄格位…';
  try{
   const response=await fetch('/api/admin/slots/register',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({project_id,device_id,slot_code,slot_number}),cache:'no-store'});
   const result=await response.json();if(!response.ok||result.success!==true)throw Error(result.message||'登錄失敗');
   registerMessage.textContent='已登錄格位 '+slot_code+'，對應 '+device_id+' 第 '+slot_number+' 格。實體開鎖尚未啟用。';
   slotInput.value=slot_code;verifiedSlot=null;slotOpen.disabled=true;
  }catch(e){registerMessage.textContent='登錄失敗：'+e.message}
 });
 const slotInput=$('quick-slot-code'),slotStatus=$('quick-slot-status'),slotOpen=$('quick-slot-unlock');
 let verifiedSlot=null,slotBusy=false;
 const slotCode=()=>slotInput.value.trim().toUpperCase();
 const slotMessage=s=>{slotStatus.textContent=s};
 const slotPost=async(path,code)=>{
  const response=await fetch(path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({slot_code:code}),cache:'no-store'});
  const result=await response.json();if(!response.ok||result.success!==true)throw Error(result.message||'操作未完成');
  return result;
 };
 slotInput.addEventListener('input',()=>{slotInput.value=slotInput.value.toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,40);verifiedSlot=null;slotOpen.disabled=true;slotMessage('請查詢格位與管理權限。')});
 $('quick-slot-resolve').addEventListener('click',async()=>{
  const code=slotCode();if(!/^[A-Z0-9_-]{4,40}$/.test(code)){slotMessage('請輸入 4～40 位有效格位編號。');return;}
  slotMessage('正在驗證格位與專案管理員權限…');slotOpen.disabled=true;verifiedSlot=null;
  try{const result=await slotPost('/api/admin/slots/resolve',code);verifiedSlot=result;slotOpen.disabled=false;slotMessage('已驗證：'+result.project_name+' / '+result.device_id+' / 第 '+result.slot_number+' 格。裝置指令服務尚未啟用，無法實際開鎖。')}
  catch(e){slotMessage('驗證失敗：'+e.message)}
 });
 slotOpen.addEventListener('click',async()=>{
  if(!verifiedSlot||verifiedSlot.slot_code!==slotCode()||slotBusy)return;
  slotBusy=true;slotOpen.disabled=true;slotMessage('正在由伺服器重新確認管理員權限與指令狀態…');
  try{const result=await slotPost('/api/admin/slots/unlock',slotCode());slotMessage(result.execution_verified===true?'裝置已確認執行':'請求已受理，尚未收到裝置執行回報')}
  catch(e){slotMessage('未開鎖：'+e.message)}
  finally{slotBusy=false;slotOpen.disabled=!verifiedSlot}
 });
 $('quick-slot-scan').addEventListener('click',async()=>{
  if(!('NDEFReader' in window)){slotMessage('此瀏覽器不支援 Web NFC，請手動輸入格位編號。');return;}
  try{
   const reader=new NDEFReader();await reader.scan();slotMessage('請靠近格位 NFC 標籤。');
   reader.onreading=event=>{
    let code='';
    for(const record of event.message.records){if(record.recordType==='text'){try{code=new TextDecoder(record.encoding||'utf-8').decode(record.data).trim().toUpperCase()}catch{}}}
    if(!/^[A-Z0-9_-]{4,40}$/.test(code)){slotMessage('標籤沒有有效格位編號，請手動輸入。');return;}
    slotInput.value=code;verifiedSlot=null;slotOpen.disabled=true;slotMessage('已掃描格位 '+code+'，請按「查詢格位與管理權限」。');
   };
  }catch(e){slotMessage('NFC 掃描失敗：'+e.message)}
 });
})();
