'use strict';
(async()=>{
 const get=id=>document.getElementById(id);
 try{
  const response=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});
  if(response.status===401){location.replace('/');return;}
  if(!response.ok)throw Error('AUTH_UNAVAILABLE');
  const data=await response.json();
  if(!data.authenticated){location.replace('/');return;}
  get('create-loading').hidden=true;get('create-content').hidden=false;
 }catch{get('create-loading').textContent='無法驗證登入狀態，請稍後重新整理。';return;}
 get('create-project-form').addEventListener('submit',event=>{
  event.preventDefault();const name=get('create-project-name').value.trim();const description=get('create-project-description').value.trim();
  if(!name||name.length>80){get('create-error').textContent='請輸入 1～80 字的專案名稱。';return;}
  get('create-error').textContent='';get('create-confirm-name').textContent=name;get('create-confirm-description').textContent=description||'未填寫';
  get('create-project-form').hidden=true;get('create-step2').hidden=false;get('create-step-title').textContent='步驟 2 · 借還模式設定';
 });
 get('create-step2-back').addEventListener('click',()=>{get('create-step2').hidden=true;get('create-project-form').hidden=false;get('create-step-title').textContent='步驟 1 · 專案基本資料';});
 get('create-settings-form').addEventListener('submit',event=>{
  event.preventDefault();
  const form=new FormData(event.currentTarget);
  const method=form.get('authorization_method'), schedule=form.get('scheduled_authorization');
  if(!['application','self_registration'].includes(method)||!['yes','no'].includes(schedule)){get('create-settings-error').textContent='請完成 Q1 與 Q2。';return;}
  get('create-settings-error').textContent='';
  get('create-confirm-auth').textContent=method==='application'?'申請授權':'使用者自行登記';
  get('create-confirm-schedule').textContent=schedule==='yes'?'是':'否';
  get('create-step2').hidden=true;get('create-confirm').hidden=false;get('create-step-title').textContent='設定確認';
 });
 get('create-back').addEventListener('click',()=>{get('create-confirm').hidden=true;get('create-step2').hidden=false;get('create-step-title').textContent='步驟 2 · 借還模式設定';});
})();