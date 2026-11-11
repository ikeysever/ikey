'use strict';
(()=>{
 const fields={
  basic:[['專案名稱','project_name'],['專案說明','description'],['專案狀態','status'],['專案 ID','project_id']],
  auth:[['加入授權方式','authorization_method'],['排程授權','scheduled_authorization']],
  advanced:[['專案 ID','project_id'],['專案狀態','status']]
 };
 const names={active:'啟用中',inactive:'已停用',application:'申請審核',self_registration:'自行加入'};
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
   dd.textContent=value===null||value===undefined||value===''?'尚未提供':key==='scheduled_authorization'?yesNo(value):names[String(value)]||String(value);
   list.append(dt,dd);
  }
  wrapper.append(list);
  pane.append(wrapper);
 }
 document.addEventListener('ikey:project-loaded',event=>{
  const project=event.detail?.project;
  if(!project||typeof project.project_id!=='string')return;
  for(const name of Object.keys(fields))render(name,project);
 });
})();
