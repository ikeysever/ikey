'use strict';
(()=>{
 const byId=id=>document.getElementById(id);
 const id=new URLSearchParams(location.search).get('id');
 const status=byId('project-status'),retry=byId('project-retry');
 const showError=message=>{status.hidden=false;status.textContent=message;retry.hidden=false;byId('project-detail').removeAttribute('aria-busy');};
 if(!id||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)){
  showError('缺少有效的專案 ID。');return;
 }
 const cached=window.iKeyProjectCache?.read()?.find(p=>p.project_id===id);
 if(cached){byId('project-title').textContent=cached.project_name;byId('project-name').textContent=cached.project_name;}
 async function load(){
  retry.hidden=true;status.hidden=false;status.textContent='正在驗證專案資料…';
  try{
   const response=await fetch('/api/projects',{credentials:'same-origin',cache:'no-store'});
   const data=await response.json();
   if(!response.ok||data.success!==true||!Array.isArray(data.projects))throw Error('無法載入專案資料');
   const project=data.projects.find(p=>p.project_id===id);
   if(!project)throw Error('找不到專案，或目前帳號無權存取');
   window.iKeyProjectCache?.write(data.projects);
   byId('project-title').textContent=project.project_name;
   byId('project-name').textContent=project.project_name;
   byId('project-state').textContent=project.status==='active'?'啟用中':project.status==='inactive'?'已停用':'';
   const permissionsResponse=await fetch('/api/projects/'+encodeURIComponent(id)+'/settings-permissions',{credentials:'same-origin',cache:'no-store'});
   const permissionsData=await permissionsResponse.json();
   if(!permissionsResponse.ok||permissionsData.success!==true||!permissionsData.permissions)throw Error('無法驗證專案設定權限');
   const permissions=permissionsData.permissions;
   for(const card of document.querySelectorAll('#pc-menu [data-pc-open]')){
    const section=card.getAttribute('data-pc-open');
    card.hidden=permissions[section]!==true;
   }
   const allowed=Object.values(permissions).some(value=>value===true);
   byId('pc-menu').hidden=!allowed;
   const explanation=byId('pc-permission-message');
   explanation.hidden=allowed;
   explanation.textContent=allowed?'':permissionsData.role==='member'?'你目前是此專案的一般成員，因此無法使用專案管理設定。請聯絡專案擁有者將你的身分調整為管理員。':'目前沒有可使用的管理設定。請確認你的專案身分。';
   byId('pc-menu').setAttribute('aria-label',allowed?'專案設定功能':'沒有可使用的專案管理功能');
   document.documentElement.dataset.projectPermissionsReady='true';
   byId('project-detail').removeAttribute('aria-busy');
   document.documentElement.dataset.projectReady='true';
   document.querySelectorAll('[data-pc-loading]').forEach(p=>p.hidden=true);
   document.dispatchEvent(new CustomEvent('ikey:project-loaded',{detail:{project}}));
   status.hidden=true;
  }catch(err){byId('pc-menu').hidden=true;byId('pc-permission-message').hidden=false;byId('pc-permission-message').textContent='無法確認專案管理權限，已暫停顯示管理設定。';delete document.documentElement.dataset.projectPermissionsReady;showError(err.message||'專案資料載入失敗');}
 }
 retry.addEventListener('click',load);load();
})();
