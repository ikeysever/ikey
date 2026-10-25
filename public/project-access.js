'use strict';
(()=>{
 const get=id=>document.getElementById(id);
 document.addEventListener('ikey:projectLoaded',({detail})=>{
  const project=detail.project;
  if(project.project_role!=='admin')return;
  const id=project.project_id,form=get('project-invite-form'),policy=get('project-join-policy'),generate=get('project-invite-generate');
  const note=get('project-invite-result'),codeBox=get('project-invite-code-box'),codeInput=get('project-invite-code'),copy=get('project-invite-copy');
  const refresh=get('project-members-refresh'),status=get('project-members-status'),list=get('project-members-list');
  const base='/api/projects/'+encodeURIComponent(id);
  const request=async(url,options={})=>{
   const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});
   const data=await response.json();
   if(!response.ok||!data.success)throw Error(data.message||'伺服器暫時無法完成操作');
   return data;
  };
  async function loadMembers(){
   refresh.disabled=true;status.textContent='正在取得成員與加入申請…';
   try{
    const data=await request(base+'/access');list.replaceChildren();
    if(data.join_policy)policy.value=data.join_policy;
    if(!data.members.length){status.textContent='目前尚無其他成員或待審核申請。';return;}
    const pending=data.members.filter(m=>m.status==='pending').length;
    status.textContent='共 '+data.members.length+' 位申請者／成員，其中 '+pending+' 筆等待審核。';
    for(const member of data.members){
     const item=document.createElement('li');item.style.cssText='padding:12px;border:1px solid var(--project-border);border-radius:10px';
     const title=document.createElement('strong');title.textContent=member.display_name||'未命名使用者';
     const detail=document.createElement('p');detail.style.margin='6px 0';
     const labels={pending:'等待審核',active:'已加入',rejected:'已拒絕'};
     detail.textContent='使用者 · '+(labels[member.status]||'未知狀態');
     item.append(title,detail);
     if(member.status==='pending'){
      const actions=document.createElement('div');actions.style.display='flex';actions.style.gap='8px';
      for(const [decision,label] of [['approve','核准加入'],['reject','拒絕申請']]){
       const btn=document.createElement('button');btn.type='button';btn.textContent=label;
       btn.addEventListener('click',async()=>{
        if(decision==='reject'&&!confirm('確定拒絕「'+(member.display_name||'此使用者')+'」的加入申請？'))return;
        actions.querySelectorAll('button').forEach(b=>b.disabled=true);
        status.textContent='正在'+label+'…';
        try{
         await request(base+'/access/'+encodeURIComponent(member.entry_id)+'/review',{
          method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision})
         });
         await loadMembers();
        }catch(error){status.textContent=error.message;actions.querySelectorAll('button').forEach(b=>b.disabled=false);}
       });
       actions.append(btn);
      }
      item.append(actions);
     }
     list.append(item);
    }
   }catch(error){status.textContent=error.message||'無法讀取清單';}
   finally{refresh.disabled=false;}
  }
  form?.addEventListener('submit',async event=>{
   event.preventDefault();
   if(!confirm('產生新邀請碼會讓舊邀請碼失效，確定繼續？'))return;
   generate.disabled=true;note.textContent='正在產生安全邀請碼…';
   codeBox.hidden=true;codeInput.value='';
   try{
    const data=await request(base+'/invite',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({join_policy:policy.value})});
    codeInput.value=data.invite_code;codeBox.hidden=false;
    note.textContent=data.join_policy==='direct'?'已產生邀請碼：持碼者可直接加入。':'已產生邀請碼：持碼者須等待管理員審核。';
    loadMembers();
   }catch(error){note.textContent=error.message||'產生失敗';}
   finally{generate.disabled=false;}
  });
  copy?.addEventListener('click',async()=>{
   try{await navigator.clipboard.writeText(codeInput.value);note.textContent='已複製邀請碼，可以分享給受邀成員。';}
   catch{codeInput.focus();codeInput.select();note.textContent='無法自動複製，請長按欄位並選擇複製。';}
  });
  refresh?.addEventListener('click',loadMembers);
  loadMembers();
 });
})();
