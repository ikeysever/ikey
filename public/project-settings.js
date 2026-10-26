'use strict';
(()=>{
 const el=id=>document.getElementById(id);
 const id=new URLSearchParams(location.search).get('id');
 const error=el('error');
 const fail=message=>{error.hidden=false;error.textContent=message;};
 if(!id||!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)){fail('缺少有效的專案 ID');return;}
 const q=encodeURIComponent(id),projectUrl='/project.html?id='+q;
 el('back-link').href=projectUrl;
 fetch('/api/projects/'+q,{credentials:'same-origin',cache:'no-store'})
  .then(async response=>{const data=await response.json();if(!response.ok||!data.success||!data.project)throw Error(data.message||'無法取得專案資料');return data.project;})
  .then(p=>{
   el('project-label').textContent=p.project_name+' · '+(p.project_role==='admin'?'管理員':'使用者');
   el('project-name').textContent=p.project_name||'—';
   el('project-description').textContent=p.description||'尚無說明';
   el('project-id').textContent=p.project_id;
   el('settings-content').hidden=false;
   if(p.project_role!=='admin')return;
   el('admin-settings').hidden=false;
   const themes={midnight:'午夜科技',polar:'極地淺色',emerald:'實驗室翡翠',copper:'工業銅橘',violet:'未來紫',graphite:'石墨黑白'};
   const sounds={pulse:'鋼片琴',crystal:'水晶鈴音',air:'鋼琴',wood:'木琴',future:'長笛',click:'豎琴'};
   el('theme').textContent=themes[p.notification_theme]||p.notification_theme||'未設定';
   el('sound').textContent=sounds[p.notification_sound_pack]||p.notification_sound_pack||'未設定';
   el('volume').textContent=(p.notification_volume??50)+'%';
   el('edit-link').href=projectUrl+'#project-settings';
   el('devices-link').href='/project-devices.html?id='+q;
   el('other-link').href='/project-other-settings.html?id='+q;
   el('delete-link').href=projectUrl+'#project-danger-heading';
  }).catch(e=>fail(e.message||'專案設定載入失敗'));
})();