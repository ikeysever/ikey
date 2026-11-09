'use strict';
(()=>{
 const get=id=>document.getElementById(id);
 const basic=get('create-project-form');
 get('create-loading').hidden=true;get('create-content').hidden=false;
 basic.addEventListener('submit',async event=>{
  event.preventDefault();
  const button=basic.querySelector('button[type="submit"]');if(button.disabled)return;
  const name=get('create-project-name').value.trim();
  const description=get('create-project-description').value.trim();
  if(!name||name.length>80){get('create-error').textContent='請輸入 1～80 字的專案名稱。';return;}
  if(description.length>1000){get('create-error').textContent='專案說明不可超過 1000 字。';return;}
  const payload={project_name:name,description,authorization_method:'self_registration',scheduled_authorization:false,notification_theme:'midnight',notification_sound_pack:'pulse',notification_volume:50};
  button.disabled=true;get('create-error').textContent='';button.textContent='正在儲存…';
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
   try{sessionStorage.removeItem('ikey:projects:display:v1');}catch{}
   const refresh=fetch('/api/projects',{credentials:'same-origin',cache:'no-store'})
    .then(async response=>{const latest=await response.json();if(response.ok&&latest.success&&Array.isArray(latest.projects)){sessionStorage.setItem('ikey-projects-refresh',JSON.stringify(latest.projects));}})
    .catch(()=>{});
   await Promise.all([refresh,new Promise(resolve=>setTimeout(resolve,1900))]);
   location.assign('/projects.html');
  }catch(error){get('create-error').textContent=error.message||'儲存失敗，請重試';button.disabled=false;button.textContent='建立專案';}
 });
 (async()=>{try{
  const response=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});
  if(response.status===401){location.replace('/');return;}
  if(!response.ok)throw Error('AUTH_UNAVAILABLE');
  const data=await response.json();if(!data.authenticated){location.replace('/');return;}
 }catch{get('create-loading').hidden=false;get('create-loading').textContent='無法驗證登入狀態，請稍後重新整理。';get('create-content').hidden=true;}})();
})();
