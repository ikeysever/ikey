'use strict';(()=>{
 let current=null;
 const id=new URLSearchParams(location.search).get('id');
 const forms=[...document.querySelectorAll('[data-pc-settings]')];
 function populate(p){current=p;for(const form of forms){for(const field of form.elements){if(!field.name)continue;const value=p[field.name];if(field.type==='checkbox')field.checked=value===true||String(value).toLowerCase()==='true';else field.value=value==null?'':String(value);}form.hidden=false;}}
 document.addEventListener('ikey:project-loaded',event=>populate(event.detail.project));
 for(const form of forms)form.addEventListener('submit',async event=>{
  event.preventDefault();if(!current||current.project_id!==id)return;
  const data={};for(const field of form.elements){if(!field.name)continue;data[field.name]=field.type==='checkbox'?field.checked:field.name==='notification_volume'?Number(field.value):field.value;}
  const button=form.querySelector('button[type=submit]'),status=form.querySelector('[data-pc-save-status]');button.disabled=true;status.textContent='正在儲存並驗證…';
  try{const r=await fetch('/api/projects/'+encodeURIComponent(id)+'/settings',{method:'PATCH',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await r.json();if(!r.ok||!result.success||!result.project)throw Error(result.message||'儲存失敗');populate(result.project);status.textContent='儲存成功，正在更新顯示…';location.reload();}
  catch(e){status.textContent=e.message||'儲存失敗，請稍後重試';button.disabled=false;}
 });
})();
