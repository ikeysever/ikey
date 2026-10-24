'use strict';
(()=>{
  const get=id=>document.getElementById(id);
  const panel=get('projects-panel');
  if(!panel)return;
  const projects=[];
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
    if(menuEmpty)menuEmpty.textContent=projects.length?'測試專案：'+projects.length+' 個':'目前沒有專案';
    if(!projects.length){const empty=document.createElement('p');empty.className='projects-empty';empty.textContent='目前沒有專案';list.append(empty);return;}
    const container=document.createElement('div');container.className=view==='list'?'projects-rows':'projects-tiles';
    for(const name of projects){
      const item=document.createElement('div');item.className=view==='list'?'projects-row':'projects-tile';
      const icon=document.createElement('span');icon.className='projects-folder';icon.setAttribute('aria-hidden','true');icon.textContent='▣';
      const text=document.createElement('div');text.className='projects-item-text';
      const title=document.createElement('strong');title.textContent=name;
      const meta=document.createElement('small');meta.textContent='測試專案';
      text.append(title,meta);item.append(icon,text);container.append(item);
    }
    list.append(container);
  }
  function setView(next){view=next;for(const type of ['list','grid']){const button=get('projects-view-'+type);const selected=type===next;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));}render();}
  get('projects-view-list').addEventListener('click',()=>setView('list'));
  get('projects-view-grid').addEventListener('click',()=>setView('grid'));
  get('projects-create').addEventListener('click',()=>{location.assign('/project-create.html');});
  render();
})();
