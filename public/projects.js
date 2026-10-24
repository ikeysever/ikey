'use strict';
(()=>{
  const get=id=>document.getElementById(id);
  const panel=get('projects-panel');
  if(!panel)return;
  let projects=[];
  // Warm the child page as soon as the parent page is initialized.
  for(const href of ['/project-create.html','/project-create.css','/project-create.js']){
    const link=document.createElement('link');link.rel='prefetch';link.href=href;document.head.appendChild(link);
  }
  let view='list';
  const list=get('projects-results');
  function render(){
    list.replaceChildren();
    get('projects-count').textContent='('+projects.length+')';
    const menuEmpty=document.querySelector('.project-menu-empty');
    if(menuEmpty)menuEmpty.textContent=projects.length?'我的專案：'+projects.length+' 個':'目前沒有專案';
    if(!projects.length){const empty=document.createElement('p');empty.className='projects-empty';empty.textContent='目前沒有專案';list.append(empty);return;}
    const container=document.createElement('div');container.className=view==='list'?'projects-rows':'projects-tiles';
    for(const project of projects){
      const item=document.createElement('div');item.className=view==='list'?'projects-row':'projects-tile';
      const icon=document.createElement('span');icon.className='projects-folder';icon.setAttribute('aria-hidden','true');icon.textContent='▣';
      const text=document.createElement('div');text.className='projects-item-text';
      const title=document.createElement('strong');title.textContent=project.project_name||'未命名專案';
      const meta=document.createElement('small');meta.textContent=project.status==='active'?'啟用中':project.status==='inactive'?'已停用':'狀態未設定';
      text.append(title,meta);item.append(icon,text);container.append(item);
    }
    list.append(container);
  }
  function setView(next){view=next;for(const type of ['list','grid']){const button=get('projects-view-'+type);const selected=type===next;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));}render();}
  get('projects-view-list').addEventListener('click',()=>setView('list'));
  get('projects-view-grid').addEventListener('click',()=>setView('grid'));
  get('projects-create').addEventListener('click',()=>{location.assign('/project-create.html');});
  try{
    const cached=sessionStorage.getItem('ikey-projects-refresh');
    if(cached){sessionStorage.removeItem('ikey-projects-refresh');projects=JSON.parse(cached).filter(project=>project.project_id&&project.created_at&&project.updated_at&&['active','inactive'].includes(project.status));}
  }catch{sessionStorage.removeItem('ikey-projects-refresh');}
  render();
  (async()=>{
   try{
    const response=await fetch('/api/projects',{credentials:'same-origin',cache:'no-store'});
    const data=await response.json();if(!response.ok||!data.success)throw Error(data.message||'讀取失敗');
    projects=(Array.isArray(data.projects)?data.projects:[]).filter(project=>project.project_id && project.created_at && project.updated_at && ['active','inactive'].includes(project.status));render();
   }catch(error){const message=document.createElement('p');message.className='projects-empty';message.textContent=error.message||'無法載入專案';list.replaceChildren(message);}
  })();
})();
