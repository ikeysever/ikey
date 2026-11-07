'use strict';
(()=>{
 const host=document.getElementById('system-announcements');if(!host)return;
 const labels={urgent:'緊急',important:'重要',normal:'一般'};
 const category={system:'系統公告',maintenance:'維護通知',feature:'功能更新',administrative:'行政公告',other:'其他'};
 const list=document.createElement('div');list.className='home-announcements';
 const modal=document.createElement('div');modal.className='home-announcement-modal';modal.hidden=true;
 modal.innerHTML='<section class="home-announcement-dialog" role="dialog" aria-modal="true" aria-labelledby="home-announcement-title"><div class="home-announcement-dialog-head"><div><span id="home-announcement-category" class="home-announcement-tag"></span><div class="home-announcement-meta" id="home-announcement-date"></div></div><button type="button" class="home-announcement-close" id="home-announcement-close" aria-label="關閉公告">關閉 ✕</button></div><h2 id="home-announcement-title"></h2><div id="home-announcement-content" class="home-announcement-content"></div></section>';
 document.body.append(modal);
 const close=()=>{modal.hidden=true;document.body.style.overflow='';};
 async function api(path,options={}){const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options});let data={};try{data=await response.json();}catch{}if(!response.ok||data.success===false)throw new Error(data.message||'公告服務暫時無法使用');return data;}
 async function open(item){
  document.getElementById('home-announcement-category').textContent=(category[item.category]||item.category)+' · '+(labels[item.priority]||'');
  document.getElementById('home-announcement-category').className='home-announcement-tag '+item.priority;
  document.getElementById('home-announcement-date').textContent='發布時間：'+new Date(item.published_at).toLocaleString('zh-TW',{hour12:false});
  document.getElementById('home-announcement-title').textContent=item.title;
  document.getElementById('home-announcement-content').textContent=item.content;
  modal.hidden=false;document.body.style.overflow='hidden';document.getElementById('home-announcement-close').focus();
  try{await api('/api/announcements/'+encodeURIComponent(item.announcement_id)+'/read',{method:'POST'});}catch{/* Reading remains available if the optional receipt cannot be saved. */}
 }
 function render(items){
  list.replaceChildren();
  if(!items.length){const empty=document.createElement('p');empty.className='empty compact';empty.textContent='目前沒有已發布的系統公告';host.replaceChildren(empty);return;}
  items.forEach(item=>{
   const button=document.createElement('button');button.type='button';button.className='home-announcement-item';
   const title=document.createElement('strong');title.textContent=item.title;
   const meta=document.createElement('span');meta.className='home-announcement-meta';
   const tag=document.createElement('span');tag.className='home-announcement-tag '+item.priority;tag.textContent=labels[item.priority]||'一般';
   const cat=document.createElement('span');cat.textContent=(category[item.category]||item.category)+' · '+new Date(item.published_at).toLocaleDateString('zh-TW');
   meta.append(tag,cat);button.append(title,meta);button.addEventListener('click',()=>open(item));list.append(button);
  });
  host.replaceChildren(list);
 }
 async function load(){
  try{const data=await api('/api/announcements');if(!Array.isArray(data.announcements))throw new Error('公告清單格式不正確');render(data.announcements);}
  catch(err){const note=document.createElement('p');note.className='empty compact';note.textContent=err.message||'公告載入失敗';host.replaceChildren(note);}
 }
 document.getElementById('home-announcement-close').addEventListener('click',close);
 modal.addEventListener('click',event=>{if(event.target===modal)close();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!modal.hidden)close();});
 load();
})();