'use strict';
(()=>{
 const root=document.getElementById('announcement-management-region');
 if(!root)return;
 const $=id=>document.getElementById(id);
 const now=()=>new Date().toISOString();
 const fmt=value=>{if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleString('zh-TW',{hour12:false});};
 const labels={urgent:'緊急',important:'重要',normal:'一般'};
 const statusLabels={published:'已發布',draft:'草稿',scheduled:'排程中',archived:'已下架',deleted:'回收站'};
 // UI-only sample records. Nothing is fetched from or written to the server.
 let records=[
  {id:'DEMO-001',title:'iKey 系統公告介面預覽',category:'system',priority:'important',status:'published',content:'這是前端示範公告，不代表正式系統公告。公告資料目前僅存在本頁記憶體中。',created_at:now(),published_at:now(),expires_at:''},
  {id:'DEMO-002',title:'公告排程功能示意',category:'maintenance',priority:'normal',status:'draft',content:'此筆為草稿示範資料。重新整理頁面後，示範資料將恢復初始狀態。',created_at:now(),published_at:'',expires_at:''}
 ];
 let editingId=null,filterStatus='active';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function message(text){$('announcement-status').textContent=text;}
 function activeRecords(){return records.filter(r=>filterStatus==='all'?r.status!=='deleted':filterStatus==='trash'?r.status==='deleted':filterStatus==='active'&&!['deleted','archived'].includes(r.status));}
 function render(){
  const q=$('announcement-search').value.trim().toLowerCase(),cat=$('announcement-category-filter').value;
  const rows=activeRecords().filter(r=>(!cat||r.category===cat)&&(!q||(r.title+' '+r.content).toLowerCase().includes(q)));
  $('announcement-count').textContent='顯示 '+rows.length+' 則';
  const body=$('announcement-rows');body.replaceChildren();
  if(!rows.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=5;td.className='announcement-empty';td.textContent='沒有符合條件的公告';tr.append(td);body.append(tr);return;}
  rows.sort((a,b)=>({urgent:3,important:2,normal:1}[b.priority]||0)-({urgent:3,important:2,normal:1}[a.priority]||0)||new Date(b.published_at||b.created_at)-new Date(a.published_at||a.created_at));
  for(const r of rows){
   const tr=document.createElement('tr');
   const title=document.createElement('td');title.innerHTML='<span class="announcement-title">'+esc(r.title)+'</span><span class="announcement-meta">'+esc(r.id)+' · 建立 '+esc(fmt(r.created_at))+'</span>';
   const category=document.createElement('td');category.textContent=({system:'系統公告',maintenance:'維護通知',feature:'功能更新',administrative:'行政公告',other:'其他'}[r.category]||r.category);
   const priority=document.createElement('td');const p=document.createElement('span');p.className='announcement-tag '+r.priority;p.textContent=labels[r.priority]||'未設定';priority.append(p);
   const status=document.createElement('td');const s=document.createElement('span');s.className='announcement-tag '+(r.status==='draft'?'draft':'');s.textContent=statusLabels[r.status]||r.status;status.append(s);const time=document.createElement('span');time.className='announcement-meta';time.textContent=r.status==='scheduled'?'預定 '+fmt(r.scheduled_at):r.status==='published'?'發布 '+fmt(r.published_at):'更新 '+fmt(r.updated_at||r.created_at);status.append(time);
   const actions=document.createElement('td');actions.className='announcement-actions';
   const add=(label,fn,klass='')=>{const b=document.createElement('button');b.type='button';b.className='announcement-btn '+klass;b.textContent=label;b.addEventListener('click',fn);actions.append(b);};
   add('預覽',()=>preview(r));if(r.status!=='deleted')add('編輯',()=>openEditor(r));
   if(r.status==='draft'||r.status==='scheduled')add('立即發布',()=>{r.status='published';r.published_at=now();r.updated_at=now();render();message('示範狀態已更新：已發布（僅本頁暫存）');});
   if(r.status==='published')add('下架',()=>{r.status='archived';r.updated_at=now();render();message('示範狀態已更新：已下架（僅本頁暫存）');});
   if(r.status==='deleted')add('還原',()=>{r.status='draft';r.updated_at=now();render();message('示範公告已還原為草稿（僅本頁暫存）');});
   if(r.status!=='deleted')add('移至回收站',()=>{r.status='deleted';r.updated_at=now();render();message('示範公告已移至回收站（僅本頁暫存）');},'danger');
   tr.append(title,category,priority,status,actions);body.append(tr);
  }
 }
 function preview(r){
  $('announcement-preview').hidden=false;$('announcement-preview-category').textContent=({system:'系統公告',maintenance:'維護通知',feature:'功能更新',administrative:'行政公告',other:'其他'}[r.category]||r.category)+' · '+(labels[r.priority]||'');
  $('announcement-preview-title').textContent=r.title;$('announcement-preview-content').textContent=r.content;$('announcement-preview-date').textContent='發布時間：'+fmt(r.published_at||r.scheduled_at||r.created_at);
  $('announcement-preview').scrollIntoView({behavior:'smooth',block:'nearest'});
 }
 function openEditor(r){
  editingId=r?.id||null;$('announcement-editor').hidden=false;$('announcement-editor-title').textContent=r?'編輯公告':'新增公告';
  $('announcement-title').value=r?.title||'';$('announcement-category').value=r?.category||'system';$('announcement-priority').value=r?.priority||'normal';$('announcement-content').value=r?.content||'';$('announcement-schedule').value=r?.scheduled_at?new Date(r.scheduled_at).toISOString().slice(0,16):'';$('announcement-expires').value=r?.expires_at?new Date(r.expires_at).toISOString().slice(0,16):'';
  $('announcement-editor').scrollIntoView({behavior:'smooth',block:'start'});$('announcement-title').focus();
 }
 function closeEditor(){$('announcement-editor').hidden=true;editingId=null;$('announcement-form').reset();}
 function save(status){
  const title=$('announcement-title').value.trim(),content=$('announcement-content').value.trim();
  if(!title||title.length>120){message('標題必填，且不得超過 120 字。');return;}
  if(!content||content.length>10000){message('公告內容必填，且不得超過 10,000 字。');return;}
  const schedule=$('announcement-schedule').value?new Date($('announcement-schedule').value).toISOString():'';
  const expires=$('announcement-expires').value?new Date($('announcement-expires').value).toISOString():'';
  if(expires&&schedule&&new Date(expires)<=new Date(schedule)){message('到期時間必須晚於排程發布時間。');return;}
  const old=records.find(r=>r.id===editingId),record={id:editingId||'DEMO-'+String(Date.now()),title,content,category:$('announcement-category').value,priority:$('announcement-priority').value,status:status==='published'?'published':status==='scheduled'&&schedule?'scheduled':'draft',created_at:old?.created_at||now(),updated_at:now(),published_at:status==='published'?(old?.published_at||now()):old?.published_at||'',scheduled_at:status==='scheduled'?schedule:'',expires_at:expires};
  if(old)Object.assign(old,record);else records.unshift(record);
  closeEditor();render();message('已更新前端示範資料；尚未寫入資料庫，重新整理後不會保留。');
 }
 $('announcement-new').addEventListener('click',()=>openEditor(null));
 $('announcement-cancel').addEventListener('click',closeEditor);
 $('announcement-save-draft').addEventListener('click',()=>save('draft'));
 $('announcement-save-publish').addEventListener('click',()=>save('published'));
 $('announcement-save-schedule').addEventListener('click',()=>save('scheduled'));
 $('announcement-search').addEventListener('input',render);$('announcement-category-filter').addEventListener('change',render);
 $('announcement-status-filter').addEventListener('change',e=>{filterStatus=e.target.value;render();});
 $('announcement-preview-close').addEventListener('click',()=>{$('announcement-preview').hidden=true;});
 render();
})();