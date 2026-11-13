'use strict';
(()=>{
const pane=document.querySelector('[data-pc-pane="devices"]');
const trigger=document.querySelector('[data-pc-open="devices"]');
const authPane=document.querySelector('[data-pc-pane="auth"]');
if(!pane||!trigger)return;
const id=new URLSearchParams(location.search).get('id');
let ready=false;
const style=document.createElement('style');
style.textContent='.pd-panel{background:#17243b;border:1px solid #354a64;border-radius:16px;padding:20px;margin:14px 0}.pd-panel p{color:#a6b2c5}.pd-panel button{background:#213957;border:1px solid #607993;border-radius:10px;padding:10px 14px;color:#f8fafc;cursor:pointer;margin:4px}.pd-panel button:disabled{opacity:.45;cursor:not-allowed}.pd-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}.pd-item{border:1px solid #3d5671;border-radius:12px;padding:16px}.pd-item strong{display:block;font-size:1.1rem;margin-bottom:8px}.pd-muted{color:#a6b2c5}.pd-panel [role=status]{min-height:1.5em}';
document.head.append(style);
const root=document.createElement('div');
root.innerHTML='<section class="pd-panel"><h3>專案裝置</h3><p>僅顯示已加入本專案的裝置。實體連線尚未驗證，控制功能未啟用。</p><p id="pd-status" role="status">等待讀取裝置…</p><div class="pd-grid" id="pd-bound"></div></section><section class="pd-panel" id="pd-admin" hidden><h3>新增預登錄裝置</h3><p>只有專案建立者與管理員可以新增裝置。下方清單直接讀取超級管理員的出廠預登錄資料，不顯示裝置密碼。</p><div class="pd-grid" id="pd-available"></div><p id="pd-action" role="status"></p></section><section class="pd-panel" id="pd-member" hidden><h3>授權申請</h3><p>一般使用者不能自行新增或解除裝置。需要使用裝置時，請至「授權管理」查看申請資訊。</p><button type="button" id="pd-auth-link">前往授權管理</button></section>';
pane.append(root);
const $=id=>document.getElementById(id);
const api='/api/projects/'+encodeURIComponent(id)+'/devices';
const el=(tag,txt)=>{const x=document.createElement(tag);x.textContent=txt;return x};
async function json(url,options){const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});let d;try{d=await r.json()}catch{throw Error('伺服器回應格式不正確')}if(!r.ok||!d.success)throw Error(d.message||d.code||'操作失敗');return d}
async function load(){
 if(!ready||!id)return;
 $('pd-status').textContent='正在讀取專案裝置…';$('pd-bound').replaceChildren();$('pd-available').replaceChildren();
 try{
 const data=await json(api);$('pd-admin').hidden=!data.can_manage;$('pd-member').hidden=!!data.can_manage;
 for(const d of data.devices){const card=el('article','');card.className='pd-item';card.append(el('strong',d.device_id),el('p',d.device_name||'iBOX'),el('p','登錄狀態：pre_registered'),el('p','實體連線：尚未驗證'));
 if(data.can_manage){const b=el('button','從專案移除');b.onclick=async()=>{if(!confirm('確定從此專案移除 '+d.device_id+'？裝置出廠資料不會刪除。'))return;b.disabled=true;try{await json(api+'/'+encodeURIComponent(d.device_id)+'/binding',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirm_device_id:d.device_id})});await load()}catch(e){$('pd-status').textContent=e.message;b.disabled=false}};card.append(b)}
 $('pd-bound').append(card)}
 if(!data.devices.length)$('pd-bound').append(el('p','此專案尚未加入任何裝置。'));
 $('pd-status').textContent='已載入 '+data.devices.length+' 台專案裝置。';
 if(data.can_manage){const inv=await json(api+'/available');for(const d of inv.devices){const card=el('article','');card.className='pd-item';card.append(el('strong',d.device_id),el('p','登錄狀態：'+d.registration_status),el('p','實體連線：尚未驗證'));const b=el('button',d.already_added?'已加入本專案':'＋ 加入專案');b.disabled=d.already_added;b.onclick=async()=>{b.disabled=true;$('pd-action').textContent='正在新增 '+d.device_id+'…';try{await json(api+'/bind',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({device_id:d.device_id})});$('pd-action').textContent=d.device_id+' 已加入專案';await load()}catch(e){$('pd-action').textContent=e.message;b.disabled=false}};card.append(b);$('pd-available').append(card)}if(!inv.devices.length)$('pd-available').append(el('p','目前沒有可用的預登錄裝置。'))}
 }catch(e){$('pd-status').textContent=e.message||'讀取失敗'}
}
$('pd-auth-link').onclick=()=>{pane.querySelector('[data-pc-back]')?.click();document.querySelector('[data-pc-open="auth"]')?.click();};
document.addEventListener('ikey:project-loaded',e=>{ready=e.detail?.project?.project_id===id;if(ready&&!pane.hidden)load()});
trigger.addEventListener('click',()=>{if(ready)load()});
})();