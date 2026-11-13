'use strict';
(()=>{
 const notifications=[['approval_granted','審核通過'],['unlock_success','開鎖成功'],['approval_pending','等待審核（管理員）'],['unlock_activity','開鎖通知（管理員）'],['battery_low','低電量警示（管理員）'],['abnormal_open','異常開啟（管理員）'],['device_offline','離線警示（管理員）'],['inventory_low','庫存警示（管理員）'],['extension_alert','其他擴充功能警示（管理員）','extension_other_enabled'],['environment_sensor_abnormal','溫濕度感測器異常（管理員）','extension_temperature_humidity_enabled'],['temperature_humidity_threshold','溫濕度超過警戒值（管理員）','extension_temperature_humidity_enabled'],['fire_alert','起火警示（管理員）','extension_fire_enabled']];
 const extensions=[['extension_temperature_humidity_enabled','啟用溫濕度感測器'],['extension_fire_enabled','啟用起火偵測感測器'],['extension_other_enabled','啟用其他擴充感測器']];
 const thresholds=[['battery_percent','低電量門檻（%）',20,1,100],['offline_minutes','離線判定（分鐘）',15,1,10080],['inventory_min','庫存最低數量',1,0,100000],['temperature_min','最低溫度（°C）',0,-50,150,'extension_temperature_humidity_enabled'],['temperature_max','最高溫度（°C）',40,-50,150,'extension_temperature_humidity_enabled'],['humidity_min','最低濕度（%RH）',20,0,100,'extension_temperature_humidity_enabled'],['humidity_max','最高濕度（%RH）',80,0,100,'extension_temperature_humidity_enabled']];
 const $=id=>document.getElementById(id);
 const select=$('pc-alert-device'),notify=$('pc-alert-fields'),advanced=$('pc-alert-advanced-fields'),status=$('pc-alert-status'),advancedStatus=$('pc-alert-advanced-status'),save=$('pc-alert-save');
 let projectId='',defaults={},overrides=[],loaded=false,dirty={};
 const request=async(url,opts={})=>{const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...opts});const d=await r.json();if(!r.ok||!d.success)throw Error(d.message||d.code||'伺服器回應失敗');return d};
 const effective=()=>{const override=overrides.find(x=>x.device_id===select.value)?.settings||{};return {...defaults,...override,...dirty}};
 const add=(parent,tag,content)=>{const e=document.createElement(tag);e.textContent=content;parent.append(e);return e};
 function checkbox(parent,key,title,checked){
  const label=document.createElement('label');label.className='pc-alert-check';
  const input=document.createElement('input');input.type='checkbox';input.checked=checked;input.dataset.key=key;
  input.addEventListener('change',()=>{dirty[key]=input.checked;if(key.startsWith('extension_')&&key.endsWith('_enabled')){if(!input.checked){for(const [k,,dependency] of notifications)if(dependency===key)dirty[k]=false;for(const [k,,,,,dependency] of thresholds)if(dependency===key)dirty[k]=undefined}render()}});
  label.append(input,document.createTextNode(title));parent.append(label);
 }
 function render(){
  const values=effective();notify.replaceChildren();advanced.replaceChildren();
  add(notify,'h3','LINE 通知項目');
  for(const [key,title,dependency] of notifications)if(!dependency||values[dependency]===true)checkbox(notify,key,title,values[key]===true);
  add(advanced,'h3','擴充功能啟用');
  add(advanced,'p','未啟用的擴充感測器，不顯示其警戒值或相關通知選項。');
  for(const [key,title] of extensions)checkbox(advanced,key,title,values[key]===true);
  add(advanced,'h3','iBOX 設備警戒值');
  const grid=document.createElement('div');grid.className='pc-alert-numbers';
  for(const [key,title,initial,min,max,dependency] of thresholds){
   if(dependency&&values[dependency]!==true)continue;
   const label=document.createElement('label');label.textContent=title;
   const input=document.createElement('input');input.type='number';input.step='any';input.min=min;input.max=max;input.required=true;input.value=values[key]??initial;
   input.addEventListener('input',()=>{dirty[key]=input.value===''?null:Number(input.value)});
   label.append(input);grid.append(label);
  }
  advanced.append(grid);
  status.textContent=select.value?'正在編輯此 iBOX 的通知偏好。':'正在編輯專案通知預設值。';
  advancedStatus.textContent='警戒值及擴充開關與通知設定共用「儲存」功能。';
 }
 function collect(){
  const values=effective(),settings={};
  for(const [key] of notifications)settings[key]=values[key]===true;
  for(const [key] of extensions)settings[key]=values[key]===true;
  for(const [key,,initial,min,max,dependency] of thresholds){
   if(dependency&&!settings[dependency])continue;
   const n=values[key]??initial;
   if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)throw Error('警戒值不在允許範圍');
   settings[key]=n;
  }
  for(const [key,,dependency] of notifications)if(dependency&&!settings[dependency])settings[key]=false;
  if(settings.extension_temperature_humidity_enabled&&(settings.temperature_min>=settings.temperature_max||settings.humidity_min>=settings.humidity_max))throw Error('溫濕度下限必須小於上限');
  return settings;
 }
 async function saveSettings(){
  if(!loaded)return;
  let settings;try{settings=collect()}catch(e){status.textContent=e.message;advancedStatus.textContent=e.message;return}
  save.disabled=true;status.textContent='正在儲存…';advancedStatus.textContent='正在儲存…';
  try{
   await request('/api/projects/'+encodeURIComponent(projectId)+'/alert-settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({device_id:select.value||null,settings})});
   if(select.value){const i=overrides.findIndex(x=>x.device_id===select.value);if(i>=0)overrides[i].settings=settings;else overrides.push({device_id:select.value,settings})}else defaults=settings;
   dirty={};status.textContent='已儲存至資料庫（尚未啟用實際 LINE 推播）。';advancedStatus.textContent='已儲存擴充與警戒設定。';
  }catch(e){status.textContent='儲存失敗：'+e.message;advancedStatus.textContent='儲存失敗：'+e.message}
  finally{save.disabled=false}
 }
 async function load(){
  if(!projectId)return;loaded=false;save.disabled=true;status.textContent='讀取設定中…';
  try{
   const [s,d]=await Promise.all([request('/api/projects/'+encodeURIComponent(projectId)+'/alert-settings'),request('/api/projects/'+encodeURIComponent(projectId)+'/devices')]);
   defaults=s.defaults||{};overrides=s.overrides||[];dirty={};select.replaceChildren(new Option('整個專案（預設值）',''));
   for(const item of d.devices||[])select.add(new Option((item.device_name||'iBOX')+' · '+item.device_id,item.device_id));
   loaded=true;save.disabled=false;render();
  }catch(e){status.textContent='載入失敗：'+e.message;advancedStatus.textContent=status.textContent}
 }
 select.addEventListener('change',()=>{dirty={};if(loaded)render()});
 save.addEventListener('click',saveSettings);
 const advancedSave=document.createElement('button');advancedSave.type='button';advancedSave.textContent='儲存進階設定';advancedSave.addEventListener('click',saveSettings);advanced.append(advancedSave);
 // Reattach the advanced save button after every render, as render clears the container.
 const originalRender=render;
 render=function(){originalRender();advanced.append(advancedSave)};
 document.addEventListener('ikey:project-loaded',e=>{projectId=e.detail.project.project_id;load()});
})();
