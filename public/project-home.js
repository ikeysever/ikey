'use strict';
(()=>{
 const get=id=>document.getElementById(id),id=new URLSearchParams(location.search).get('id'),status=get('project-status');
 if(!id||!/^[0-9a-f-]{36}$/i.test(id)){status.textContent='無效的專案 ID';return;}
 const link=get('project-settings-link');if(link)link.href='/project-settings.html?id='+encodeURIComponent(id);
 fetch('/api/projects/'+encodeURIComponent(id),{credentials:'same-origin',cache:'no-store'}).then(async r=>{
  const d=await r.json();if(!r.ok||!d.success||!d.project)throw Error(d.message||'無法讀取專案');
  const p=d.project;
  get('project-title').textContent=p.project_name;
  const role=get('project-role');if(role)role.textContent=p.project_role==='admin'?'管理員':'使用者';
  const action=get('project-authorization-action');
  if(action){action.textContent=p.authorization_method==='application'?'申請解鎖':String(p.scheduled_authorization).toLowerCase()==='true'?'預約解鎖':'申請解鎖';action.disabled=true;action.title='裝置授權與解鎖 API 尚未發布';}
  status.hidden=true;get('project-detail').hidden=false;
 }).catch(err=>{status.textContent=err.message||'專案載入失敗';status.setAttribute('role','alert');});
})();
