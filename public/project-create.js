'use strict';
(async()=>{
 const get=id=>document.getElementById(id);
 // The form contains no privileged data: show it immediately, validate the session in parallel.
 get('create-loading').hidden=true;
 get('create-content').hidden=false;
 get('create-project-form').addEventListener('submit',event=>{
  event.preventDefault();const name=get('create-project-name').value.trim();const description=get('create-project-description').value.trim();
  if(!name||name.length>80){get('create-error').textContent='請輸入 1～80 字的專案名稱。';return;}
  get('create-error').textContent='';get('create-confirm-name').textContent=name;get('create-confirm-description').textContent=description||'未填寫';
  get('create-project-form').hidden=true;get('create-confirm').hidden=false;
 });
 get('create-back').addEventListener('click',()=>{get('create-confirm').hidden=true;get('create-project-form').hidden=false;get('create-project-name').focus();});
 try{
  const response=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});
  if(response.status===401){location.replace('/');return;}
  if(!response.ok)throw Error('AUTH_UNAVAILABLE');
  const data=await response.json();
  if(!data.authenticated){location.replace('/');return;}
  get('create-loading').hidden=true;get('create-content').hidden=false;
 }catch{get('create-loading').hidden=false;get('create-loading').textContent='無法驗證登入狀態，請稍後重新整理。';get('create-content').hidden=true;return;}
})();
