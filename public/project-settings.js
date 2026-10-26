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
   const edit=el('project-edit-form');
   for(const key of ['project_name','description','notification_theme','notification_sound_pack'])edit.elements[key].value=p[key]??'';
   edit.elements.notification_volume.value=p.notification_volume??50;
   const api='/api/projects/'+q;
   const request=async(url,method,body)=>{
    const response=await fetch(url,{method,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await response.json();if(!response.ok||!data.success)throw Error(data.message||'操作未完成');return data;
   };
   edit.addEventListener('submit',async event=>{
    event.preventDefault();const button=edit.querySelector('button[type=submit]'),status=el('edit-status');
    const body={project_name:edit.elements.project_name.value.trim(),description:edit.elements.description.value,notification_theme:edit.elements.notification_theme.value,notification_sound_pack:edit.elements.notification_sound_pack.value,notification_volume:Number(edit.elements.notification_volume.value)};
    button.disabled=true;status.textContent='正在儲存並覆核…';
    try{
     await request(api,'PATCH',body);
     const response=await fetch(api,{credentials:'same-origin',cache:'no-store'}),data=await response.json();
     if(!response.ok||!data.success||!data.project||Object.entries(body).some(([k,v])=>String(data.project[k])!==String(v)))throw Error('資料庫覆核失敗');
     el('project-name').textContent=data.project.project_name;el('project-description').textContent=data.project.description||'尚無說明';
     el('theme').textContent=themes[data.project.notification_theme]||data.project.notification_theme;
     el('sound').textContent=sounds[data.project.notification_sound_pack]||data.project.notification_sound_pack;
     el('volume').textContent=data.project.notification_volume+'%';
     status.textContent='設定已儲存，重新讀取資料庫驗證通過。';
    }catch(e){status.textContent=e.message;}finally{button.disabled=false;}
   });
   const invite=el('invite-form');
   invite.addEventListener('submit',async event=>{
    event.preventDefault();if(!confirm('新邀請碼會使舊邀請碼失效，確定繼續？'))return;
    const button=invite.querySelector('button'),status=el('invite-status');button.disabled=true;
    el('invite-secret-wrap').hidden=true;el('invite-secret').value='';
    try{const data=await request(api+'/invite','POST',{join_policy:invite.elements.join_policy.value});el('invite-secret').value=data.invite_code;el('invite-secret-wrap').hidden=false;status.textContent='邀請碼已產生，僅本次顯示。';}
    catch(e){status.textContent=e.message;}finally{button.disabled=false;}
   });
   const first=el('delete-confirm'),final=el('delete-final');
   el('delete-start').addEventListener('click',()=>first.showModal());
   el('delete-cancel').addEventListener('click',()=>first.close());
   el('delete-next').addEventListener('click',()=>{first.close();el('delete-name').value='';final.showModal();});
   el('delete-final-cancel').addEventListener('click',()=>final.close());
   el('delete-submit').addEventListener('click',async()=>{
    const status=el('delete-status'),button=el('delete-submit');
    if(el('delete-name').value!==p.project_name){status.textContent='專案名稱不一致，無法刪除。';return;}
    button.disabled=true;status.textContent='正在確認軟刪除…';
    try{const data=await request(api+'/delete','POST',{project_name:p.project_name,confirmation:'DELETE_PROJECT'});if(!data.deleted)throw Error('未確認刪除');location.assign('/projects.html');}
    catch(e){status.textContent=e.message;button.disabled=false;}
   });
   el('invite-link').href=projectUrl+'#project-invite-heading';
   const refresh=el('members-refresh'),list=el('members-list'),status=el('members-status');
   const loadMembers=async()=>{
    refresh.disabled=true;status.textContent='正在讀取使用者…';list.replaceChildren();
    try{
     const response=await fetch('/api/projects/'+q+'/access',{credentials:'same-origin',cache:'no-store'});
     const data=await response.json();if(!response.ok||!data.success||!Array.isArray(data.members))throw Error(data.message||'使用者清單無法讀取');
     status.textContent='共 '+data.members.length+' 位使用者（含待審核申請）';if(data.join_policy)invite.elements.join_policy.value=data.join_policy;
     for(const member of data.members){
      const item=document.createElement('li');const name=document.createElement('strong');name.textContent=member.display_name||'未設定專案名稱';
      const detail=document.createElement('span');detail.textContent=' · '+(member.role==='admin'?'管理員':'使用者')+' · '+({active:'已加入',pending:'待審核',rejected:'已拒絕'}[member.status]||member.status||'未知');
      item.append(name,detail);
      if(member.status==='pending'){
       for(const [decision,label] of [['approve','核准'],['reject','拒絕']]){
        const button=document.createElement('button');button.type='button';button.textContent=label;
        button.addEventListener('click',async()=>{
         if(!confirm('確定'+label+'這筆加入申請？'))return;
         button.disabled=true;
         try{await request(api+'/access/'+encodeURIComponent(member.entry_id)+'/review','POST',{decision});await loadMembers();}
         catch(e){status.textContent=e.message;button.disabled=false;}
        });item.append(button);
       }
      }
      list.append(item);
     }
    }catch(e){status.textContent=e.message||'無法讀取使用者';}
    finally{refresh.disabled=false;}
   };
   refresh.addEventListener('click',loadMembers);loadMembers();
   el('devices-link').href='/project-devices.html?id='+q;
   el('other-link').href='/project-other-settings.html?id='+q;
   el('delete-link').href=projectUrl+'#project-danger-heading';
  }).catch(e=>fail(e.message||'專案設定載入失敗'));
})();