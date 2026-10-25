'use strict';
(()=>{
 const get=id=>document.getElementById(id);
 const stepLabel=get('create-step-label');
 const basic=get('create-project-form'),settings=get('create-step2'),visual=get('create-step3'),audio=get('create-step4'),confirm=get('create-confirm');
 function show(step){basic.hidden=step!==1;settings.hidden=step!==2;visual.hidden=step!==3;audio.hidden=step!==4;confirm.hidden=step!==5;stepLabel.textContent=({1:'步驟 1 · 專案基本資料',2:'步驟 2 · 借還模式設定',3:'步驟 3 · 視覺設定',4:'步驟 4 · 音效設定',5:'步驟 5 · 確認設定'})[step];window.scrollTo({top:0,behavior:'instant'});}
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
  show(3);
 });
 get('create-step3-back').addEventListener('click',()=>show(2));
 get('create-step3-next').addEventListener('click',()=>show(4));
 get('create-step4-back').addEventListener('click',()=>show(3));
 get('create-step4-next').addEventListener('click',()=>{
  const form=new FormData(get('create-settings-form'));
  const auth=form.get('authorization_method'),schedule=form.get('scheduled_authorization');
  if(!['application','self_registration'].includes(auth)||!['yes','no'].includes(schedule)){show(2);get('create-settings-error').textContent='請完成 Q1 與 Q2。';return;}
  get('create-confirm-name').textContent=get('create-project-name').value.trim();
  get('create-confirm-description').textContent=get('create-project-description').value.trim()||'未填寫';
  get('create-confirm-authorization').textContent=auth==='application'?'申請授權':'使用者自行登記';
  get('create-confirm-schedule').textContent=schedule==='yes'?'是':'否';
  get('create-confirm-theme').textContent=document.querySelector('#notify-themes button[aria-pressed="true"] span:last-child')?.textContent||'午夜科技';
  get('create-confirm-sound').textContent=get('notify-sound-pack')?.selectedOptions[0]?.textContent||'鋼片琴';
  get('create-confirm-volume').textContent=(get('notify-volume')?.value||'50')+'%';
  show(5);
 });
 get('create-back').addEventListener('click',()=>show(4));
 get('create-save').addEventListener('click',async()=>{
  const button=get('create-save');if(button.disabled)return;
  const form=new FormData(get('create-settings-form'));
  const payload={project_name:get('create-project-name').value.trim(),description:get('create-project-description').value.trim(),authorization_method:form.get('authorization_method'),scheduled_authorization:form.get('scheduled_authorization')==='yes',notification_theme:get('notify-theme-id').value,notification_sound_pack:get('notify-sound-pack').value,notification_volume:Number(get('notify-volume').value)};
  button.disabled=true;get('create-save-error').textContent='';button.textContent='正在儲存…';
  try{
   const response=await fetch('/api/projects',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   const data=await response.json();if(!response.ok||!data.success)throw Error(data.message||'儲存失敗');
   // Database acknowledged the new project. Start the success transition while
   // refreshing the destination list in parallel (never claim success on failure).
   const overlay=get('create-success-overlay');
   overlay.hidden=false;
   get('create-success-name').textContent=payload.project_name;
   try{
    const AudioContextClass=window.AudioContext||window.webkitAudioContext;
    if(AudioContextClass){
     const ctx=new AudioContextClass();await ctx.resume();
     const now=ctx.currentTime;
     for(const [freq,start,duration] of [[523.25,0,.16],[659.25,.12,.18],[783.99,.25,.34]]){
      const osc=ctx.createOscillator(),gain=ctx.createGain();
      osc.type='sine';osc.frequency.setValueAtTime(freq,now+start);
      gain.gain.setValueAtTime(.0001,now+start);
      gain.gain.exponentialRampToValueAtTime(.085,now+start+.025);
      gain.gain.exponentialRampToValueAtTime(.0001,now+start+duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now+start);osc.stop(now+start+duration+.02);
     }
     setTimeout(()=>ctx.close().catch(()=>{}),1500);
    }
   }catch{/* Audio may be blocked; visual confirmation still works. */}
   const refresh=fetch('/api/projects',{credentials:'same-origin',cache:'no-store'})
    .then(async response=>{const latest=await response.json();if(response.ok&&latest.success&&Array.isArray(latest.projects)){sessionStorage.setItem('ikey-projects-refresh',JSON.stringify(latest.projects));}})
    .catch(()=>{});
   await Promise.all([refresh,new Promise(resolve=>setTimeout(resolve,1900))]);
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
