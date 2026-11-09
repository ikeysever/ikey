'use strict';
(()=>{
 const $=id=>document.getElementById(id),dialog=$('quick-unlock-dialog');
 if(!dialog)return;
 const project=$('quick-project'),device=$('quick-device'),status=$('quick-unlock-status'),submit=$('quick-unlock-submit');
 let projects=[],devices=[],busy=false;
 const setStatus=s=>{status.textContent=s};
 const valid=()=>Boolean(project.value&&device.value&&devices.some(d=>d.device_id===device.value&&d.project_id===project.value&&d.control_ready===true));
 const update=()=>{submit.disabled=busy||!valid();};
 const request=async url=>{const r=await fetch(url,{credentials:'same-origin',cache:'no-store'});const data=await r.json();if(!r.ok||data.success!==true)throw Error(data.message||'無法取得資料');return data};
 async function loadProjects(){
  project.replaceChildren(new Option('請選擇專案',''));device.replaceChildren(new Option('請先選擇專案',''));device.disabled=true;submit.disabled=true;
  try{
   const data=await request('/api/projects');
   projects=(data.projects||[]).filter(p=>p.project_id&&p.status!=='deleted');
   for(const p of projects)project.add(new Option(p.project_name,p.project_id));
   setStatus(projects.length?'請選擇專案。':'目前沒有可選擇的專案。');
  }catch(e){setStatus('專案載入失敗：'+e.message)}
 }
 async function loadDevices(){
  device.replaceChildren(new Option('正在查詢已授權裝置…',''));device.disabled=true;devices=[];update();
  if(!project.value){device.replaceChildren(new Option('請先選擇專案',''));return;}
  try{
   const data=await request('/api/projects/'+encodeURIComponent(project.value)+'/devices');
   devices=(data.devices||[]).filter(d=>d.project_id===project.value&&d.control_ready===true);
   device.replaceChildren(new Option('請選擇 iBOX',''));
   for(const d of devices)device.add(new Option((d.device_name||'iBOX')+' · '+d.device_id,d.device_id));
   device.disabled=devices.length===0;
   setStatus(devices.length?'請選擇一台 iBOX。':'目前沒有已驗證、可開鎖的 iBOX。');
  }catch(e){device.replaceChildren(new Option('裝置資料尚未就緒',''));setStatus('無法取得已授權裝置：'+e.message)}
 }
 $('quick-unlock-open').addEventListener('click',()=>{dialog.showModal();loadProjects()});
 project.addEventListener('change',loadDevices);device.addEventListener('change',update);
 $('quick-nfc-start').addEventListener('click',async()=>{
  if(!('NDEFReader' in window)){setStatus('此瀏覽器不支援 Web NFC。iPhone 請使用系統 NFC 標籤讀取功能；尚未設定裝置專屬的安全連結。');return;}
  try{
   const reader=new NDEFReader();await reader.scan();setStatus('請將手機靠近 NFC 標籤。');
   reader.onreading=event=>{
    // Never treat untrusted NFC payload as authorization or an unlock command.
    let id='';
    for(const record of event.message.records){
     if(record.recordType==='text'){try{id=new TextDecoder(record.encoding||'utf-8').decode(record.data).trim().toUpperCase()}catch{}}
    }
    if(!/^[A-HJ-NP-Z2-9]{8}$/.test(id)){setStatus('無法識別裝置標籤；請手動選擇。');return;}
    const match=devices.find(d=>d.device_id===id&&d.project_id===project.value&&d.control_ready===true);
    if(!match){setStatus('標籤已讀取，但裝置不屬於目前專案或尚未授權。');return;}
    device.value=id;update();setStatus('已辨識裝置 '+id+'，請確認後開鎖。');
   };
  }catch(e){setStatus('NFC 無法啟動：'+e.message)}
 });
 submit.addEventListener('click',async()=>{
  if(!valid()||busy)return;
  busy=true;update();setStatus('正在確認裝置授權與送出開鎖請求…');
  try{
   const r=await fetch('/api/projects/'+encodeURIComponent(project.value)+'/devices/'+encodeURIComponent(device.value)+'/unlock',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}',cache:'no-store'});
   const data=await r.json();
   if(!r.ok||data.success!==true)throw Error(data.message||'開鎖服務未就緒');
   // Only a verified physical execution receipt may produce the success state.
   if(data.execution_verified===true&&data.execution_status==='completed'&&data.device_id===device.value&&data.project_id===project.value){
    setStatus('✓ 開鎖完成');
   }else setStatus('開鎖請求已受理，但尚未收到實體裝置成功回報；不能判定開鎖完成。');
  }catch(e){setStatus('未確認開鎖完成：'+e.message)}
  finally{busy=false;update();}
 });
})();
