'use strict';
(()=>{
 const get=id=>document.getElementById(id);
 const id=new URLSearchParams(location.search).get('id'),error=get('error');
 if(!id||!/^[0-9a-f-]{36}$/i.test(id)){error.hidden=false;error.textContent='缺少有效的專案 ID。';return;}
 get('back-link').href='/project.html?id='+encodeURIComponent(id);
 const form=get('other-settings-form');
 fetch('/api/projects',{credentials:'same-origin',cache:'no-store'})
  .then(async r=>{const data=await r.json();if(!r.ok||!data.success)throw Error(data.message||'專案無法讀取');const p=(data.projects||[]).find(p=>p.project_id===id);if(!p)throw Error('找不到專案或沒有管理權限');return p;})
  .then(p=>{
   
   get('project-label').textContent=p.project_name+' · 管理員';
   form.elements.status.value=p.status==='inactive'?'inactive':'active';
   const auth=form.querySelector('input[name="authorization_method"][value="'+(p.authorization_method==='self_registration'?'self_registration':'application')+'"]');
   if(auth)auth.checked=true;
   form.elements.scheduled_authorization.checked=p.scheduled_authorization===true||String(p.scheduled_authorization).toLowerCase()==='true';
   get('admin-content').hidden=false;
  }).catch(e=>{error.hidden=false;error.textContent=e.message||'無法取得設定';});
 form.addEventListener('submit',e=>{e.preventDefault();get('save-status').textContent='尚未發布資料庫設定服務，暫不允許儲存。';});
})();