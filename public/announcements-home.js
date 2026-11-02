'use strict';
(()=>{
 const host=document.getElementById('system-announcements');if(!host)return;
 const labels={urgent:'緊急',important:'重要',normal:'一般'};
 const category={system:'系統公告',maintenance:'維護通知',feature:'功能更新',administrative:'行政公告',other:'其他'};
 // Public-facing visual prototype only. No API or persistent storage is connected.
 const announcements=[
  {id:'DEMO-001',title:'iKey 系統公告介面預覽',category:'system',priority:'important',published_at:'2026-11-02T08:00:00+08:00',content:'這是 iKey 3.1 系統公告的首頁閱讀介面示範。\n\n目前公告仍使用前端示範資料，尚未連接正式公告 API 或資料庫，因此不代表管理員已正式發布此公告。'},
  {id:'DEMO-002',title:'公告閱讀視窗功能示意',category:'feature',priority:'normal',published_at:'2026-11-01T08:00:00+08:00',content:'點擊首頁公告卡片即可開啟完整內容。閱讀視窗支援桌面與手機尺寸，並可使用關閉按鈕或鍵盤 Escape 關閉。'}
 ];
 announcements.sort((a,b)=>({urgent:3,important:2,normal:1}[b.priority]||0)-({urgent:3,important:2,normal:1}[a.priority]||0)||Date.parse(b.published_at)-Date.parse(a.published_at));
 const list=document.createElement('div');list.className='home-announcements';
 const modal=document.createElement('div');modal.className='home-announcement-modal';modal.hidden=true;modal.innerHTML='<section class="home-announcement-dialog" role="dialog" aria-modal="true" aria-labelledby="home-announcement-title"><div class="home-announcement-dialog-head"><div><span id="home-announcement-category" class="home-announcement-tag"></span><div class="home-announcement-meta" id="home-announcement-date"></div></div><button type="button" class="home-announcement-close" id="home-announcement-close" aria-label="關閉公告">關閉 ✕</button></div><h2 id="home-announcement-title"></h2><div id="home-announcement-content" class="home-announcement-content"></div><div class="home-announcement-demo">前端預覽資料｜尚未連接正式公告服務</div></section>';
 document.body.append(modal);
 const close=()=>{modal.hidden=true;document.body.style.overflow='';};
 function open(item){document.getElementById('home-announcement-category').textContent=(category[item.category]||item.category)+' · '+(labels[item.priority]||'');document.getElementById('home-announcement-category').className='home-announcement-tag '+item.priority;document.getElementById('home-announcement-date').textContent='發布時間：'+new Date(item.published_at).toLocaleString('zh-TW',{hour12:false});document.getElementById('home-announcement-title').textContent=item.title;document.getElementById('home-announcement-content').textContent=item.content;modal.hidden=false;document.body.style.overflow='hidden';document.getElementById('home-announcement-close').focus();}
 announcements.forEach(item=>{const button=document.createElement('button');button.type='button';button.className='home-announcement-item';const title=document.createElement('strong');title.textContent=item.title;const meta=document.createElement('span');meta.className='home-announcement-meta';const tag=document.createElement('span');tag.className='home-announcement-tag '+item.priority;tag.textContent=labels[item.priority];const cat=document.createElement('span');cat.textContent=category[item.category]+' · '+new Date(item.published_at).toLocaleDateString('zh-TW');meta.append(tag,cat);button.append(title,meta);button.addEventListener('click',()=>open(item));list.append(button);});
 host.replaceChildren(list);const note=document.createElement('p');note.className='home-announcement-demo';note.textContent='目前為介面預覽，公告資料尚未連接正式服務。';host.append(note);
 document.getElementById('home-announcement-close').addEventListener('click',close);
 modal.addEventListener('click',event=>{if(event.target===modal)close();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!modal.hidden)close();});
})();