'use strict';
(()=>{
 const labels=[['approval_granted','審核通過'],['unlock_success','開鎖成功'],['approval_pending','等待審核（管理員）'],['unlock_activity','開鎖通知（管理員）'],['battery_low','低電量警示（管理員）'],['abnormal_open','異常開啟（管理員）'],['device_offline','離線警示（管理員）'],['inventory_low','庫存警示（管理員）'],['extension_alert','其他擴充功能警示（管理員）'],['environment_sensor_abnormal','溫濕度感測器異常（管理員）'],['temperature_humidity_threshold','溫濕度超過警戒值（管理員）'],['fire_alert','起火警示（管理員）']];
 const limits=[['battery_percent','低電量門檻（%）',20,1,100],['offline_minutes','離線判定（分鐘）',15,1,10080],['inventory_min','庫存最低數量',1,0,100000],['temperature_min','最低溫度（°C）',0,-50,150],['temperature_max','最高溫度（°C）',40,-50,150],['humidity_min','最低濕度（%RH）',20,0,100],['humidity_max','最高濕度（%RH）',80,0,100]];
 const device=document.getElementById('pc-alert-device'),fields=document.getElementById('pc-alert-fields'),save=document.getElementById('pc-alert-save'),status=document.getElementById('pc-alert-status');
 let projectId='',defaults={},overrides=[],loaded=false;
 const request=async(url,opts={})=>{const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...opts});const data=await response.json();if(!response.ok||!data.success)throw Error(data.code||data.message||'伺服器回應失敗');return data};
 const add=(parent,tag,txt)=>{const e=document.createElement(tag);e.textContent=txt;parent.append(e);return e};
 function render(){
  fields.replaceChildren();
  const deviceId=device.value;
  const override=overrides.find(x=>x.device_id===deviceId)?.settings||{};
  const effective=deviceId?{...defaults,...override}:defaults;
  add(fields,'h3','LINE 通知項目');
  for(const [key,title] of labels){
   const label=document.createElement('label');label.className='pc-alert-check';
   const input=document.createElement('input');input.type='checkbox';input.dataset.key=key;input.checked=effective[key]===true;
   label.append(input,document.createTextNode(title));fields.append(label);
  }
  add(fields,'h3','設備與環境警戒值');
  const grid=document.createElement('div');grid.className='pc-alert-numbers';
  for(const [key,title,initial,min,max] of limits){
   const label=document.createElement('label');label.textContent=title;
   const input=document.createElement('input');input.type='number';input.step='any';input.min=min;input.max=max;input.required=true;input.dataset.key=key;input.value=effective[key]??initial;
   label.append(input);grid.append(label);
  }
  fields.append(grid);
  status.textContent=deviceId?'正在編輯此 iBOX 的個別設定（儲存後會覆寫專案預設值）。':'正在編輯整個專案的預設設定。';
 }
 async function load(){
  if(!projectId)return;
  status.textContent='正在讀取通知與警戒設定…';loaded=false;save.disabled=true;
  try{
   const [settings,devices]=await Promise.all([request('/api/projects/'+encodeURIComponent(projectId)+'/alert-settings'),request('/api/projects/'+encodeURIComponent(projectId)+'/devices')]);
   defaults=settings.defaults||{};overrides=settings.overrides||[];
   device.replaceChildren(new Option('整個專案（預設值）',''));
   for(const d of devices.devices||[])device.add(new Option((d.device_name||'iBOX')+' · '+d.device_id,d.device_id));
   loaded=true;save.disabled=false;render();
  }catch(e){status.textContent='設定載入失敗：'+e.message}
 }
 device.addEventListener('change',()=>{if(loaded)render()});
 save.addEventListener('click',async()=>{
  if(!loaded)return;
  const settings={};
  for(const input of fields.querySelectorAll('[data-key]')){
   if(input.type==='checkbox')settings[input.dataset.key]=input.checked;
   else{if(!input.checkValidity()){input.reportValidity();return;}settings[input.dataset.key]=Number(input.value)}
  }
  if(settings.temperature_min>=settings.temperature_max||settings.humidity_min>=settings.humidity_max){status.textContent='溫度及濕度下限必須小於上限。';return;}
  save.disabled=true;status.textContent='正在儲存至資料庫…';
  try{
   await request('/api/projects/'+encodeURIComponent(projectId)+'/alert-settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({device_id:device.value||null,settings})});
   if(device.value){const idx=overrides.findIndex(x=>x.device_id===device.value);if(idx>=0)overrides[idx].settings=settings;else overrides.push({device_id:device.value,settings})}
   else defaults=settings;
   status.textContent='已儲存至 Supabase。提醒：LINE 推播與警戒偵測尚未啟用。';
  }catch(e){status.textContent='儲存失敗：'+e.message}
  finally{save.disabled=false}
 });
 document.addEventListener('ikey:project-loaded',e=>{projectId=e.detail.project.project_id;load()});
})();
