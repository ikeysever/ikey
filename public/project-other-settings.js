'use strict';
(()=>{
 const get=id=>document.getElementById(id);
 const id=new URLSearchParams(location.search).get('id'),error=get('error');
 if(!id||!/^[0-9a-f-]{36}$/i.test(id)){error.hidden=false;error.textContent='缺少有效的專案 ID。';return;}
 get('back-link').href='/project.html?id='+encodeURIComponent(id);
 const form=get('other-settings-form');
 fetch('/api/projects/'+encodeURIComponent(id),{credentials:'same-origin',cache:'no-store'})
  .then(async r=>{const data=await r.json();if(!r.ok||!data.success||!data.project)throw Error(data.message||'專案無法讀取');return data.project;})
  .then(p=>{
   if(p.project_role!=='admin')throw Error('只有管理員可以查看其他設定');
   get('project-label').textContent=p.project_name+' · 管理員';
   form.elements.status.value=p.status==='inactive'?'inactive':'active';
   const auth=form.querySelector('input[name="authorization_method"][value="'+(p.authorization_method==='self_registration'?'self_registration':'application')+'"]');
   if(auth)auth.checked=true;
   form.elements.scheduled_authorization.checked=p.scheduled_authorization===true||String(p.scheduled_authorization).toLowerCase()==='true';
   get('admin-content').hidden=false;
  }).catch(e=>{error.hidden=false;error.textContent=e.message||'無法取得設定';});
 form.addEventListener('submit',async e=>{
  e.preventDefault();
  const button=get('save-settings'),status=get('save-status');
  const changes={
   status:form.elements.status.value,
   authorization_method:form.elements.authorization_method.value,
   scheduled_authorization:form.elements.scheduled_authorization.checked
  };
  button.disabled=true;status.textContent='正在儲存並覆核資料庫…';
  try{
   const response=await fetch('/api/projects/'+encodeURIComponent(id)+'/other-settings',{
    method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(changes)
   });
   const data=await response.json();
   if(!response.ok||!data.success||!data.project)throw Error(data.message||'儲存失敗');
   const p=data.project;
   if(p.status!==changes.status||p.authorization_method!==changes.authorization_method||
    String(p.scheduled_authorization)!==String(changes.scheduled_authorization))throw Error('資料庫回傳值不一致，請重新整理確認');
   try{sessionStorage.removeItem('ikey:projects:display:v1');sessionStorage.removeItem('ikey-projects-refresh');}catch(_){}
   status.textContent='設定已儲存，並通過資料庫覆核。';
  }catch(error){status.textContent=error.message||'儲存失敗';}
  finally{button.disabled=false;}
 });
})();