'use strict';
(()=>{
 const byId=id=>document.getElementById(id);
 const id=new URLSearchParams(location.search).get('id');
 const status=byId('project-status'),retry=byId('project-retry');
 const showError=message=>{status.hidden=false;status.textContent=message;retry.hidden=false;byId('project-detail').removeAttribute('aria-busy');};
 if(!id||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)){
  showError('缺少有效的專案 ID。');return;
 }
 async function load(){
  retry.hidden=true;status.hidden=false;status.textContent='正在驗證專案資料…';
  try{
   const response=await fetch('/api/projects',{credentials:'same-origin',cache:'no-store'});
   const data=await response.json();
   if(!response.ok||data.success!==true||!Array.isArray(data.projects))throw Error('無法載入專案資料');
   const project=data.projects.find(p=>p.project_id===id);
   if(!project)throw Error('找不到專案，或目前帳號無權存取');
   byId('project-title').textContent=project.project_name;
   byId('project-name').textContent=project.project_name;
   byId('project-state').textContent=project.status==='active'?'啟用中':project.status==='inactive'?'已停用':'';
   byId('project-detail').removeAttribute('aria-busy');
   document.documentElement.dataset.projectReady='true';
   document.querySelectorAll('[data-pc-loading]').forEach(p=>p.hidden=true);
   document.dispatchEvent(new CustomEvent('ikey:project-loaded',{detail:{project}}));
   status.hidden=true;
  }catch(err){showError(err.message||'專案資料載入失敗');}
 }
 retry.addEventListener('click',load);load();
})();
