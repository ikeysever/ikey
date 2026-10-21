'use strict';
(()=>{
  const get=id=>document.getElementById(id);
  const panel=get('projects-panel');
  if(!panel)return;
  const projects=[];
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
  const createPanel=get('projects-create-panel');
  function toggleForm(open){createPanel.hidden=!open;get('projects-form-error').textContent='';if(open)get('projects-name').focus();else get('projects-create-form').reset();}
  get('projects-create').addEventListener('click',()=>toggleForm(true));
  get('projects-cancel').addEventListener('click',()=>toggleForm(false));
  get('projects-create-form').addEventListener('submit',event=>{
    event.preventDefault();const name=get('projects-name').value.trim();
    if(!name||name.length>40){get('projects-form-error').textContent='請輸入 1～40 字的專案名稱。';return;}
    if(projects.length>=8){get('projects-form-error').textContent='介面測試最多建立 8 個專案。';return;}
    projects.push(name);render();toggleForm(false);
  });
  render();
})();
