'use strict';
(()=>{
 const $=id=>document.getElementById(id),dialog=$('quick-unlock-dialog');
 if(!dialog)return;
 const project=$('quick-project'),manual=$('quick-device-input'),options=$('quick-device-options'),count=$('quick-device-count'),status=$('quick-unlock-status'),submit=$('quick-unlock-submit');
 let devices=[],projects=[],loading=false,loadSequence=0;
 const checked=new Set();
 const setStatus=s=>{status.textContent=s};
 const request=async url=>{const r=await fetch(url,{credentials:'same-origin',cache:'no-store'});const data=await r.json();if(!r.ok||data.success!==true)throw Error(data.message||'無法取得資料');return data};
 const scoped=()=>devices.filter(d=>d.project_id===project.value);
 const key=d=>d.project_id+':'+d.device_id;
 const chosen=()=>scoped().filter(d=>checked.has(key(d)));
 const update=()=>{
  const n=chosen().length;
  count.textContent='已選 '+n+' 台';
  // Physical unlock execution is not available; selection must never imply readiness.
  submit.disabled=true;
 };
 function renderDevices(){
  const query=manual.value.trim().toLocaleLowerCase();
  const matches=scoped().filter(d=>(d.device_id+' '+(d.device_name||'iBOX')).toLocaleLowerCase().includes(query));
  options.replaceChildren();
  if(!project.value||!matches.length){
   const p=document.createElement('p');p.textContent=!project.value?'請先選擇專案。':scoped().length?'找不到符合搜尋條件的 iBOX。':'此專案尚未綁定 iBOX。';options.append(p);
  }
  for(const d of matches){
   const label=document.createElement('label');label.className='quick-device-option';
   const box=document.createElement('input');box.type='checkbox';box.checked=checked.has(key(d));
   box.addEventListener('change',()=>{if(box.checked)checked.add(key(d));else checked.delete(key(d));update()});
   const info=document.createElement('span');const name=document.createElement('strong');name.textContent=d.device_name||'iBOX';
   const details=document.createElement('small');details.textContent=d.device_id+' · '+(d.control_ready===true?'待驗證指令服務':'開鎖服務未就緒');
   info.append(name,details);label.append(box,info);options.append(label);
  }
  update();
 }
 function changeProject(){
  checked.clear();manual.value='';renderDevices();
  setStatus(!project.value?'請先選擇專案。':'可搜尋並勾選此專案的 iBOX；目前開鎖指令服務尚未啟用。');
 }
 async function loadDevices(){
  const sequence=++loadSequence;loading=true;devices=[];projects=[];checked.clear();manual.value='';project.disabled=true;
  project.replaceChildren(new Option('正在載入專案…',''));renderDevices();
  try{
   const result=await request('/api/projects');
   projects=(result.projects||[]).filter(p=>p.project_id&&p.status!=='deleted');
   const outcomes=await Promise.allSettled(projects.map(p=>request('/api/projects/'+encodeURIComponent(p.project_id)+'/devices')));
   if(sequence!==loadSequence)return;
   const errors=[];project.replaceChildren(new Option('請選擇專案',''));
   for(let i=0;i<projects.length;i++){
    const p=projects[i],o=outcomes[i];
    if(o.status==='rejected'){errors.push(p.project_name||p.project_id);continue;}
    project.add(new Option(p.project_name||'未命名專案',p.project_id));
    for(const d of o.value.devices||[])if(d.project_id===p.project_id)devices.push({...d,project_name:p.project_name});
   }
   project.disabled=project.options.length<2;changeProject();
   if(errors.length)setStatus('部分專案讀取失敗：'+errors.join('、')+'。請稍後重試。');
  }catch(e){if(sequence===loadSequence){project.replaceChildren(new Option('專案資料載入失敗',''));setStatus('無法取得專案資料：'+e.message)}}
  finally{if(sequence===loadSequence){loading=false;update()}}
 }
 $('quick-unlock-open').addEventListener('click',()=>{dialog.showModal();loadDevices();loadAdminRegistration()});
 project.addEventListener('change',changeProject);
 manual.addEventListener('input',renderDevices);
 $('quick-device-select-all').addEventListener('click',()=>{
  const q=manual.value.trim().toLocaleLowerCase();
  for(const d of scoped())if((d.device_id+' '+(d.device_name||'iBOX')).toLocaleLowerCase().includes(q))checked.add(key(d));
  renderDevices();
 });
 $('quick-device-clear').addEventListener('click',()=>{checked.clear();renderDevices()});
 $('quick-nfc-start').addEventListener('click',async()=>{
  if(!project.value){setStatus('請先選擇專案。');return;}
  if(!('NDEFReader' in window)){setStatus('此瀏覽器不支援 Web NFC，請手動搜尋裝置編號。');return;}
  try{
   const reader=new NDEFReader();await reader.scan();setStatus('請靠近 iBOX NFC 標籤。');
   reader.onreading=event=>{
    let id='';
    for(const record of event.message.records)if(record.recordType==='text'){try{id=new TextDecoder(record.encoding||'utf-8').decode(record.data).trim().toUpperCase()}catch{}}
    const d=scoped().find(d=>d.device_id===id);
    if(!d){setStatus('NFC 裝置未綁定至所選專案。');return;}
    checked.add(key(d));manual.value='';renderDevices();setStatus('已勾選 '+d.device_id+'；實體開鎖服務尚未啟用。');
   };
  }catch(e){setStatus('NFC 無法啟動：'+e.message)}
 });
 submit.addEventListener('click',()=>setStatus('實體開鎖服務尚未啟用，未發送控制指令。'));
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
