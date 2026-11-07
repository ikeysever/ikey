'use strict';
(()=>{
 const root=document.getElementById('announcement-management-region');
 if(!root)return;
 const $=id=>document.getElementById(id);
 const labels={urgent:'緊急',important:'重要',normal:'一般'};
 const categoryLabels={system:'系統公告',maintenance:'維護通知',feature:'功能更新',administrative:'行政公告',other:'其他'};
 const statusLabels={published:'已發布',draft:'草稿',scheduled:'排程中',archived:'已下架',deleted:'回收站'};
 let records=[],editingId=null,filterStatus='active',loading=false;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const localDateTime=value=>{if(!value)return '';const d=new Date(value);if(Number.isNaN(d.getTime()))return '';const pad=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes());};
 const fmt=value=>{if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleString('zh-TW',{hour12:false});};
 function message(text){$('announcement-status').textContent=text;}
 async function api(path,options={}){
  const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,headers:{...(options.headers||{}),...(options.body?{'Content-Type':'application/json'}:{})}});
  let data={};try{data=await response.json();}catch{}
  if(!response.ok||data.success===false)throw new Error(data.message||'公告服務暫時無法使用');
  return data;
 }
 async function load(){
  loading=true;render();
  try{
   const data=await api('/api/admin/announcements?include_trash=true');
   if(!Array.isArray(data.announcements))throw new Error('公告清單格式不正確');
   records=data.announcements;message('已連線至公告資料庫。');loading=false;render();return true;
  }catch(err){loading=false;records=[];render();message(err.message||'公告清單載入失敗');return false;}
 }
 function visibleRecords(){
  return records.filter(r=>filterStatus==='trash'?r.status==='deleted':filterStatus==='all'?r.status!=='deleted':!['deleted','archived'].includes(r.status));
 }
 function render(){
  const q=$('announcement-search').value.trim().toLowerCase(),cat=$('announcement-category-filter').value;
  const rows=visibleRecords().filter(r=>(!cat||r.category===cat)&&(!q||(r.title+' '+r.content).toLowerCase().includes(q)));
  $('announcement-count').textContent=loading?'載入中…':'顯示 '+rows.length+' 則';
  const body=$('announcement-rows');body.replaceChildren();
  if(!rows.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=5;td.className='announcement-empty';td.textContent=loading?'正在讀取公告…':'沒有符合條件的公告';tr.append(td);body.append(tr);return;}
  for(const r of rows){
   const tr=document.createElement('tr');
   const title=document.createElement('td');title.innerHTML='<span class="announcement-title">'+esc(r.title)+'</span><span class="announcement-meta">'+esc(r.announcement_id)+' · 建立 '+esc(fmt(r.created_at))+'</span>';
   const category=document.createElement('td');category.textContent=categoryLabels[r.category]||r.category;
   const priority=document.createElement('td');const p=document.createElement('span');p.className='announcement-tag '+r.priority;p.textContent=labels[r.priority]||'未設定';priority.append(p);
   const status=document.createElement('td');const s=document.createElement('span');s.className='announcement-tag '+(r.status==='draft'?'draft':'');s.textContent=statusLabels[r.status]||r.status;status.append(s);
   const time=document.createElement('span');time.className='announcement-meta';time.textContent=r.status==='scheduled'?'預定 '+fmt(r.scheduled_at):r.status==='published'?'發布 '+fmt(r.published_at):'更新 '+fmt(r.updated_at||r.created_at);status.append(time);
   const actions=document.createElement('td');actions.className='announcement-actions';
   const add=(label,fn,klass='')=>{const b=document.createElement('button');b.type='button';b.className='announcement-btn '+klass;b.textContent=label;b.addEventListener('click',async()=>{b.disabled=true;try{await fn();}catch(err){message(err.message||'操作失敗');}finally{b.disabled=false;}});actions.append(b);};
   add('預覽',()=>preview(r));
   if(r.status!=='deleted')add('編輯',()=>openEditor(r));
   if(r.status==='draft'||r.status==='scheduled')add('立即發布',async()=>{await api('/api/admin/announcements/'+encodeURIComponent(r.announcement_id)+'/publish',{method:'POST'});if(await load())message('公告已發布。');});
   if(r.status==='published')add('下架',async()=>{await api('/api/admin/announcements/'+encodeURIComponent(r.announcement_id)+'/unpublish',{method:'POST'});if(await load())message('公告已下架。');});
   if(r.status==='deleted')add('還原',async()=>{await api('/api/admin/announcements/'+encodeURIComponent(r.announcement_id)+'/restore',{method:'POST'});if(await load())message('公告已還原為草稿。');});
   if(r.status!=='deleted')add('移至回收站',async()=>{if(!confirm('確定將此公告移至回收站？'))return;await api('/api/admin/announcements/'+encodeURIComponent(r.announcement_id),{method:'DELETE'});if(await load())message('公告已移至回收站。');},'danger');
   tr.append(title,category,priority,status,actions);body.append(tr);
  }
 }
 function preview(r){
  $('announcement-preview').hidden=false;$('announcement-preview-category').textContent=(categoryLabels[r.category]||r.category)+' · '+(labels[r.priority]||'');
  $('announcement-preview-title').textContent=r.title;$('announcement-preview-content').textContent=r.content;$('announcement-preview-date').textContent='發布時間：'+fmt(r.published_at||r.scheduled_at||r.created_at);
  $('announcement-preview').scrollIntoView({behavior:'smooth',block:'nearest'});
 }
 function openEditor(r){
  editingId=r?.announcement_id||null;$('announcement-editor').hidden=false;$('announcement-editor-title').textContent=r?'編輯公告':'新增公告';
  $('announcement-title').value=r?.title||'';$('announcement-category').value=r?.category||'system';$('announcement-priority').value=r?.priority||'normal';$('announcement-content').value=r?.content||'';
  $('announcement-schedule').value=r?.scheduled_at?localDateTime(r.scheduled_at):'';$('announcement-expires').value=r?.expires_at?localDateTime(r.expires_at):'';
  $('announcement-editor').scrollIntoView({behavior:'smooth',block:'start'});$('announcement-title').focus();
 }
 function closeEditor(){$('announcement-editor').hidden=true;editingId=null;$('announcement-form').reset();}
 function getPayload(){
  const title=$('announcement-title').value.trim(),content=$('announcement-content').value.trim();
  if(!title||title.length>120)throw new Error('標題必填，且不得超過 120 字。');
  if(!content||content.length>10000)throw new Error('公告內容必填，且不得超過 10,000 字。');
  const schedule=$('announcement-schedule').value?new Date($('announcement-schedule').value).toISOString():'';
  const expires=$('announcement-expires').value?new Date($('announcement-expires').value).toISOString():'';
  if(expires&&schedule&&new Date(expires)<=new Date(schedule))throw new Error('到期時間必須晚於排程發布時間。');
  return {title,content,category:$('announcement-category').value,priority:$('announcement-priority').value,scheduled_at:schedule,expires_at:expires};
 }
 async function save(mode){
  let payload;try{payload=getPayload();}catch(err){message(err.message);return;}
  const buttons=[$('announcement-save-draft'),$('announcement-save-schedule'),$('announcement-save-publish')];buttons.forEach(b=>b.disabled=true);
  try{
   let data;
   if(mode==='draft'){payload.status='draft';payload.scheduled_at='';payload.published_at='';}
   if(mode==='publish'){payload.scheduled_at='';payload.published_at='';}
   if(mode==='schedule'){payload.published_at='';}
   if(editingId)data=await api('/api/admin/announcements/'+encodeURIComponent(editingId),{method:'PUT',body:JSON.stringify(payload)});
   else data=await api('/api/admin/announcements',{method:'POST',body:JSON.stringify(payload)});
   const id=editingId||data.announcement?.announcement_id;
   if(!id)throw new Error('伺服器未回傳公告 ID。');
   if(mode==='publish')await api('/api/admin/announcements/'+encodeURIComponent(id)+'/publish',{method:'POST'});
   closeEditor();if(await load())message(mode==='publish'?'公告已發布並儲存。':mode==='schedule'?'公告排程已儲存。':'公告草稿已儲存。');
  }catch(err){message(err.message||'公告儲存失敗');}
  finally{buttons.forEach(b=>b.disabled=false);}
 }
 $('announcement-new').addEventListener('click',()=>openEditor(null));
 $('announcement-cancel').addEventListener('click',closeEditor);
 $('announcement-save-draft').addEventListener('click',()=>save('draft'));
 $('announcement-save-publish').addEventListener('click',()=>save('publish'));
 $('announcement-save-schedule').addEventListener('click',()=>{const value=$('announcement-schedule').value;if(!value){message('請先設定排程發布時間。');return;}if(new Date(value).getTime()<=Date.now()){message('排程發布時間必須晚於現在。');return;}save('schedule');});
 $('announcement-search').addEventListener('input',render);$('announcement-category-filter').addEventListener('change',render);
 $('announcement-status-filter').addEventListener('change',e=>{filterStatus=e.target.value;render();});
 $('announcement-preview-close').addEventListener('click',()=>{$('announcement-preview').hidden=true;});
 load();
})();