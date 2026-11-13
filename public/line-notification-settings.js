'use strict';
(()=>{
 const groups=document.getElementById('notification-groups'),status=document.getElementById('notification-status');
 const request=async(url,options={})=>{const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});let data;try{data=await r.json()}catch{throw Error('伺服器回應格式錯誤')}if(!r.ok||!data.success)throw Error(data.message||'請求失敗');return data};
 async function load(){
  groups.replaceChildren();status.textContent='正在讀取已儲存的通知偏好…';
  try{
   const data=await request('/api/line/notification-preferences');
   const names=[...new Set(data.types.map(x=>x.group))];
   for(const name of names){
    const section=document.createElement('section');section.className='group';
    const h=document.createElement('h2');h.textContent=name;section.append(h);
    if(name!=='一般通知'){const info=document.createElement('p');info.className='hint';info.textContent='此類通知僅會在對應專案具備管理員權限時派送（事件派送功能待實作）。';section.append(info)}
    for(const t of data.types.filter(x=>x.group===name)){
     const row=document.createElement('label');row.className='setting';
     const input=document.createElement('input');input.type='checkbox';input.checked=t.enabled;input.setAttribute('aria-label',t.label);
     const content=document.createElement('span');content.className='setting-name';content.textContent=t.label;
     const state=document.createElement('small');state.textContent=t.configured?'已儲存':'尚未設定（預設關閉）';
     input.addEventListener('change',async()=>{
      const next=input.checked;input.disabled=true;state.textContent='儲存中…';
      try{
       await request('/api/line/notification-preferences',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({notification_type:t.id,enabled:next})});
       state.textContent=next?'已儲存：啟用偏好':'已儲存：停用偏好';status.textContent='已儲存「'+t.label+'」設定；LINE 事件派送尚未啟用。';
      }catch(e){input.checked=!next;state.textContent='儲存失敗';status.textContent='「'+t.label+'」未儲存：'+e.message}
      finally{input.disabled=false}
     });
     row.append(input,content,state);section.append(row);
    }
    groups.append(section);
   }
   status.textContent='已從資料庫載入 '+data.types.length+' 項通知設定。';
  }catch(e){status.textContent='讀取失敗：'+e.message;const retry=document.createElement('button');retry.textContent='重新載入';retry.addEventListener('click',load);groups.append(retry)}
 }
 load();
})();
