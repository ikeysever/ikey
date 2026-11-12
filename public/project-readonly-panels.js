'use strict';
(()=>{
 const fields={
  basic:[['專案名稱','project_name'],['專案說明','description'],['專案狀態','status'],['專案 ID','project_id']],
  auth:[['加入授權方式','authorization_method'],['排程授權','scheduled_authorization'],['功能模組','feature_modules']],
  notify:[['通知主題','notification_theme'],['通知音色','notification_sound_pack'],['通知音量','notification_volume']],
  advanced:[['專案 ID','project_id'],['專案狀態','status']]
 };
 const names={midnight:'午夜科技',polar:'極地淺色',emerald:'實驗室翡翠',copper:'工業銅橘',violet:'未來紫',graphite:'石墨黑白',pulse:'鋼片琴',crystal:'水晶鈴音',air:'鋼琴',wood:'木琴',future:'長笛',click:'豎琴',active:'啟用中',inactive:'已停用',application:'申請審核',self_registration:'自行加入'};
 const yesNo=value=>value===true||String(value).toLowerCase()==='true'?'啟用':'未啟用';
 function render(paneName,project){
  const pane=document.querySelector('[data-pc-pane="'+paneName+'"]');
  if(!pane)return;
  const old=pane.querySelector('[data-pc-readonly]');
  if(old)old.remove();
  const wrapper=document.createElement('div');
  wrapper.setAttribute('data-pc-readonly','');
  const hint=document.createElement('p');
  hint.textContent='以下為伺服器已驗證的唯讀資料；編輯功能尚未完成安全驗證。';
  wrapper.append(hint);
  const list=document.createElement('dl');
  for(const [label,key] of fields[paneName]){
   const dt=document.createElement('dt'),dd=document.createElement('dd');
   dt.textContent=label;
   const value=project[key];
   dd.textContent=key==='feature_modules'?(Array.isArray(value)?(value.length?value.map(id=>({'key_checkout':'鑰匙借出','key_return':'鑰匙歸還','reservations':'預約排程','device_management':'設備管理','notifications':'通知提醒','audit_log':'操作紀錄'}[id]||id)).join('、'):'未選擇'):'尚未驗證'):value===null||value===undefined||value===''?'尚未提供':key==='scheduled_authorization'?yesNo(value):key==='notification_volume'&&Number.isFinite(Number(value))?String(value)+'%':names[String(value)]||String(value);
   list.append(dt,dd);
  }
  wrapper.append(list);
  if(paneName==='advanced'){
   const link=document.createElement('a');
   link.href='/project-other-settings.html?id='+encodeURIComponent(project.project_id);
   link.textContent='查看其他設定（目前唯讀）';
   wrapper.append(link);
  }
  pane.append(wrapper);
 }
 function renderDevices(project){
  const pane=document.querySelector('[data-pc-pane="devices"]');
  if(!pane)return;
  const old=pane.querySelector('[data-pc-device-link]');if(old)old.remove();
  const link=document.createElement('a');
  link.setAttribute('data-pc-device-link','');
  link.href='/project-devices.html?id='+encodeURIComponent(project.project_id);
  link.textContent='前往專案裝置清單、搜尋及綁定';
  pane.append(link);
 }
 document.addEventListener('ikey:project-loaded',event=>{
  const project=event.detail?.project;
  if(!project||typeof project.project_id!=='string')return;
  for(const name of Object.keys(fields))render(name,project);
  renderDevices(project);
 });
})();
