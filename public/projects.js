'use strict';
(()=>{
 const get=id=>document.getElementById(id),panel=get('projects-panel');if(!panel)return;
 let projects=[],loaded=false,loading=true,error='',view='list',requestId=0;
 const list=get('projects-results'),count=get('projects-count'),search=get('projects-search');
 const controls=['projects-status','projects-invitation','projects-auth','projects-schedule','projects-date-start','projects-date-end','projects-creator','projects-creator-name','projects-sort'];
 const values=()=>Object.fromEntries(controls.map(id=>[id,get(id)?.value||'']));
 const normalize=value=>String(value??'').toLocaleLowerCase('zh-TW');
 const complete=p=>p&&p.project_id&&p.created_at&&p.updated_at&&['active','inactive'].includes(p.status);
 const asBool=v=>String(v).toLowerCase()==='true';
 function filtered(){
  const f=values(),keyword=normalize(search.value.trim());
  return projects.filter(p=>{
   if(keyword&&![p.project_name,p.description,p.project_id,p.creator_display_name].some(v=>normalize(v).includes(keyword)))return false;
   if(f['projects-status']!=='all'&&p.status!==f['projects-status'])return false;
   if(f['projects-invitation']==='pending'&&p.invitation_status!=='pending')return false;
   if(f['projects-auth']!=='all'&&p.authorization_method!==f['projects-auth'])return false;
   if(f['projects-schedule']!=='all'&&String(asBool(p.scheduled_authorization))!==f['projects-schedule'])return false;
   if(f['projects-date-start']&&p.created_at.slice(0,10)<f['projects-date-start'])return false;
   if(f['projects-date-end']&&p.created_at.slice(0,10)>f['projects-date-end'])return false;
   // The current API already returns only projects created by this account.
   if(f['projects-creator']==='name'&&f['projects-creator-name'].trim()&&!normalize(p.creator_display_name).includes(normalize(f['projects-creator-name'].trim())))return false;
   return true;
  }).sort((a,b)=>{
   const [field,direction]=f['projects-sort'].split(':');const key=field==='name'?'project_name':field==='updated'?'updated_at':'created_at';
   return (direction==='asc'?1:-1)*String(a[key]||'').localeCompare(String(b[key]||''),'zh-Hant');
  });
 }
 function render(){
  list.replaceChildren();
  const rows=filtered();count.textContent=loading?'(載入中…)':'('+rows.length+')';
  const menuEmpty=document.querySelector('.project-menu-empty');
  if(menuEmpty){
   const sidebarList=menuEmpty.parentElement;
   sidebarList.querySelectorAll('.project-menu-entry').forEach(node=>node.remove());
   menuEmpty.textContent=loading?'專案載入中…':projects.length?'我的專案：'+projects.length+' 個':'目前沒有專案';
   if(!loading){
    for(const p of projects){
     const entry=document.createElement('a');entry.className='project-menu-entry';entry.href='/project.html?id='+encodeURIComponent(p.project_id);
     entry.textContent=p.project_name||'未命名專案';entry.title=p.project_name||'未命名專案';
     sidebarList.append(entry);
    }
   }
  }
  if(loading){const p=document.createElement('p');p.className='projects-empty projects-loading';p.setAttribute('role','status');p.innerHTML='<span class="projects-loading-spinner" aria-hidden="true"></span>專案載入中，請稍後…';list.append(p);return;}
  if(error){const p=document.createElement('p');p.className='projects-empty';p.setAttribute('role','alert');p.textContent=error;list.append(p);return;}
  if(!rows.length){const p=document.createElement('p');p.className='projects-empty';p.textContent=projects.length?'沒有符合條件的專案':'目前沒有專案';list.append(p);return;}
  const container=document.createElement('div');container.className=view==='list'?'projects-rows':'projects-tiles';
  for(const p of rows){
   const item=document.createElement('div');item.className=view==='list'?'projects-row':'projects-tile';
   const icon=document.createElement('span');icon.className='projects-folder';icon.setAttribute('aria-hidden','true');icon.textContent='▣';
   const info=document.createElement('div');info.className='projects-item-text';
   const title=document.createElement('strong');title.textContent=p.project_name||'未命名專案';
   const meta=document.createElement('small');meta.textContent=p.status==='active'?'啟用中':'已停用';
   const secondary=document.createElement('small');secondary.textContent=(p.authorization_method==='application'?'申請授權':'自行登記')+' · '+(asBool(p.scheduled_authorization)?'有排程':'無排程');
   const enter=document.createElement('a');enter.className='projects-enter';enter.href='/project.html?id='+encodeURIComponent(p.project_id);enter.textContent='進入專案 →';enter.setAttribute('aria-label','進入專案：'+(p.project_name||'未命名專案'));info.append(title,meta,secondary);item.append(icon,info,enter);item.addEventListener('click',event=>{if(event.target.closest('a,button'))return;location.assign(enter.href);});item.tabIndex=0;item.setAttribute('role','link');item.setAttribute('aria-label','進入專案：'+(p.project_name||'未命名專案'));item.addEventListener('keydown',event=>{if(event.target!==item)return;if(event.key==='Enter'||event.key===' '){event.preventDefault();location.assign(enter.href);}});container.append(item);
  }list.append(container);
 }
 function setView(next){view=next;for(const type of ['list','grid']){const button=get('projects-view-'+type);button.classList.toggle('selected',type===next);button.setAttribute('aria-pressed',String(type===next));}render();}
 get('projects-view-list').addEventListener('click',()=>setView('list'));
 get('projects-view-grid').addEventListener('click',()=>setView('grid'));
 get('projects-create').addEventListener('click',()=>location.assign('/project-create.html'));
 get('projects-join')?.addEventListener('click',()=>location.assign('/project-join.html'));
 get('projects-advanced-toggle').addEventListener('click',()=>{const pane=get('projects-advanced');pane.hidden=!pane.hidden;get('projects-advanced-toggle').setAttribute('aria-expanded',String(!pane.hidden));});
 get('projects-clear').addEventListener('click',()=>{search.value='';for(const id of controls){const el=get(id);if(el)el.value=el.type==='date'||id==='projects-creator-name'?'':el.querySelector('option')?.value||'';}render();});
 search.addEventListener('input',render);
 for(const id of controls){get(id)?.addEventListener('input',render);get(id)?.addEventListener('change',render);}
 const creator=get('projects-creator'),creatorName=get('projects-creator-name');
 creator.addEventListener('change',()=>{creatorName.hidden=creator.value!=='name';});
 for(const href of ['/project-create.html','/project-create.css','/project-create.js']){const link=document.createElement('link');link.rel='prefetch';link.href=href;document.head.append(link);}
 try{const cached=sessionStorage.getItem('ikey-projects-refresh');if(cached){sessionStorage.removeItem('ikey-projects-refresh');projects=JSON.parse(cached).filter(complete);loading=false;loaded=true;}}catch{sessionStorage.removeItem('ikey-projects-refresh');}
 render();
 async function reload(){
  const id=++requestId;if(!loaded)loading=true;error='';render();
  try{
   const response=await fetch('/api/projects',{credentials:'same-origin',cache:'no-store'});
   const data=await response.json();if(!response.ok||!data.success)throw Error(data.message||'無法載入專案');
   if(id!==requestId)return;projects=(Array.isArray(data.projects)?data.projects:[]).filter(complete);loaded=true;loading=false;render();
  }catch(e){if(id!==requestId)return;loading=false;error=loaded?'無法更新專案，已顯示上次取得的資料':e.message||'專案載入失敗';render();}
 }
 reload();
})();