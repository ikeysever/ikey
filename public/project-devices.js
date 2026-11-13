'use strict';
(()=>{
const $=id=>document.getElementById(id),id=new URLSearchParams(location.search).get('id');
const error=$('error'),status=$('device-status'),content=$('admin-content');
if(!id||!/^[0-9a-f-]{36}$/i.test(id)){error.hidden=false;error.textContent='缺少有效的專案 ID';return;}
$('back-link').href='/project.html?id='+encodeURIComponent(id);
const api='/api/projects/'+encodeURIComponent(id)+'/devices';
async function request(url,options){const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});const d=await r.json();if(!r.ok||!d.success)throw Error(d.message||d.code||'操作失敗');return d}
async function load(){error.hidden=true;content.hidden=false;status.textContent='正在載入裝置…';const grid=$('device-grid');grid.replaceChildren();
try{const project=await request('/api/projects');const item=project.projects?.find(p=>p.project_id===id);if(!item)throw Error('無權存取此專案');
const data=await request(api);$('project-label').textContent=item.project_name+' · '+(data.can_manage?'管理員':'一般使用者');
$('add-device').hidden=!data.can_manage;
for(const d of data.devices){const card=document.createElement('article');card.className='device-card';card.dataset.deviceId=d.device_id;card.dataset.deviceName=d.device_name;const h=document.createElement('h3');h.textContent=d.device_name||'iBOX';const p=document.createElement('p');p.textContent='裝置 ID：'+d.device_id+' · 實體連線尚未驗證';card.append(h,p);grid.append(card)}
if(!data.devices.length){const p=document.createElement('p');p.textContent='目前沒有已加入的裝置';grid.append(p)}
status.textContent='已載入 '+data.devices.length+' 台裝置'+(data.can_manage?'，可新增預登錄裝置':'；一般使用者僅可查看授權申請');
if(data.can_manage){const inv=await request(api+'/available');for(const d of inv.devices){const card=document.createElement('article');card.className='device-card';const h=document.createElement('h3');h.textContent=d.device_id;const p=document.createElement('p');p.textContent='出廠預登錄 · 實體連線未驗證';const b=document.createElement('button');b.textContent=d.already_added?'已加入':'＋ 加入專案';b.disabled=d.already_added;b.onclick=async()=>{b.disabled=true;try{await request(api+'/bind',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({device_id:d.device_id})});await load()}catch(e){error.hidden=false;error.textContent=e.message;b.disabled=false}};card.append(h,p,b);grid.append(card)}}
}catch(e){error.hidden=false;error.textContent=e.message;status.textContent='讀取失敗'}}
$('add-device').onclick=()=>{const grid=$('device-grid');grid.scrollIntoView({behavior:'smooth'});};
$('device-search').addEventListener('input',()=>{const q=$('device-search').value.trim().toLowerCase();for(const card of $('device-grid').querySelectorAll('.device-card'))card.hidden=!card.textContent.toLowerCase().includes(q)});
load();
})();