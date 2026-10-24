'use strict';
(()=>{
 const get=id=>document.getElementById(id);
 const stepLabel=get('create-step-label');
 const basic=get('create-project-form'),settings=get('create-step2'),confirm=get('create-confirm');
 function show(step){basic.hidden=step!==1;settings.hidden=step!==2;confirm.hidden=step!==3;stepLabel.textContent=step===1?'步驟 1 · 專案基本資料':step===2?'步驟 2 · 借還模式設定':'步驟 3 · 確認設定';}
 // No sensitive project data is exposed; the server session is checked in parallel.
 get('create-loading').hidden=true;get('create-content').hidden=false;show(1);
 basic.addEventListener('submit',event=>{
  event.preventDefault();const name=get('create-project-name').value.trim();
  if(!name||name.length>80){get('create-error').textContent='請輸入 1～80 字的專案名稱。';return;}
  get('create-error').textContent='';show(2);
 });
 get('create-step2-back').addEventListener('click',()=>show(1));
 get('create-settings-form').addEventListener('submit',event=>{
  event.preventDefault();const form=new FormData(event.currentTarget);
  const auth=form.get('authorization_method'),schedule=form.get('scheduled_authorization');
  if(!['application','self_registration'].includes(auth)||!['yes','no'].includes(schedule)){
   get('create-settings-error').textContent='請完成 Q1 與 Q2。';return;
  }
  get('create-settings-error').textContent='';
  get('create-confirm-name').textContent=get('create-project-name').value.trim();
  get('create-confirm-description').textContent=get('create-project-description').value.trim()||'未填寫';
  get('create-confirm-authorization').textContent=auth==='application'?'申請授權':'使用者自行登記';
  get('create-confirm-schedule').textContent=schedule==='yes'?'是':'否';
  show(3);
 });
 get('create-back').addEventListener('click',()=>show(2));
 get('create-save').addEventListener('click',async()=>{
  const button=get('create-save');if(button.disabled)return;
  const form=new FormData(get('create-settings-form'));
  const payload={project_name:get('create-project-name').value.trim(),description:get('create-project-description').value.trim(),authorization_method:form.get('authorization_method'),scheduled_authorization:form.get('scheduled_authorization')==='yes'};
  button.disabled=true;get('create-save-error').textContent='';button.textContent='正在儲存…';
  try{
   const response=await fetch('/api/projects',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   const data=await response.json();if(!response.ok||!data.success)throw Error(data.message||'儲存失敗');
   location.assign('/projects.html');
  }catch(error){get('create-save-error').textContent=error.message||'儲存失敗，請重試';button.disabled=false;button.textContent='建立專案';}
 });
 (async()=>{try{
  const response=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});
  if(response.status===401){location.replace('/');return;}
  if(!response.ok)throw Error('AUTH_UNAVAILABLE');
  const data=await response.json();if(!data.authenticated){location.replace('/');return;}
 }catch{get('create-loading').hidden=false;get('create-loading').textContent='無法驗證登入狀態，請稍後重新整理。';get('create-content').hidden=true;}})();
})();
