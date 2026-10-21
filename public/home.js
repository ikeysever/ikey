'use strict';
const byId=id=>document.getElementById(id);
const menuToggle=byId('menu-toggle'), sidebar=byId('sidebar'), backdrop=byId('sidebar-backdrop');
function setMenu(open){
  sidebar.classList.toggle('open',open);
  menuToggle.classList.toggle('is-open',open);
  document.body.classList.toggle('menu-open',open);
  menuToggle.setAttribute('aria-expanded',String(open));
  menuToggle.setAttribute('aria-label',open?'關閉選單':'開啟選單');
  backdrop.hidden=!open;
  // Rotation is state-driven in CSS: open +180°, close back to 0°.

}
menuToggle.addEventListener('click',()=>setMenu(!sidebar.classList.contains('open')));
backdrop.addEventListener('click',()=>setMenu(false));
document.addEventListener('keydown',e=>{if(e.key==='Escape')setMenu(false);});
// Keep the sidebar open when toggling the nested project list on mobile.
sidebar.querySelectorAll('a,button').forEach(el=>el.addEventListener('click',()=>{if(el.id==='project-menu-toggle')return;if(innerWidth<=760)setMenu(false);}));
const projectMenuToggle=byId('project-menu-toggle'),projectMenuContent=byId('project-menu-content');
if(projectMenuToggle&&projectMenuContent){projectMenuToggle.addEventListener('click',()=>{const open=projectMenuToggle.getAttribute('aria-expanded')!=='true';projectMenuToggle.setAttribute('aria-expanded',String(open));projectMenuContent.hidden=!open;});}
function showDashboard(user){
  if(byId('account-empty-page')){byId('loading').hidden=true;byId('account-empty-page').hidden=false;return;}
  if(byId('account-panel')){
    byId('account-display-name').textContent=user?.display_name||'—';
    byId('account-username').textContent=user?.username||'—';
    byId('account-status').textContent=({active:'正常',disabled:'停用',temporarily_locked:'暫時鎖定',pending_deletion:'待刪除'})[user?.account_status]||'未提供';
    byId('account-role').textContent=({admin:'管理員',user:'一般使用者'})[user?.global_role]||user?.global_role||'未提供';
    byId('loading').hidden=true;
    byId('account-panel').hidden=false;
    return;
  }
  byId('display-name').textContent=user?.display_name||user?.username||'使用者';
  byId('loading').hidden=true;
  byId('dashboard').hidden=false;
}
async function load(){try{const r=await fetch('/api/auth/me',{cache:'no-store',credentials:'same-origin'});const data=await r.json();if(!r.ok||!data.authenticated){location.replace('/');return;}showDashboard(data.user);}catch{byId('loading').textContent='目前無法載入首頁，請稍後重新整理。';}}
byId('logout').addEventListener('click',async()=>{const button=byId('logout');if(button.disabled)return;button.disabled=true;const original=button.textContent;button.textContent='正在安全登出…';try{const response=await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});const result=await response.json();if(!response.ok||!result.success)throw Error('LOGOUT_FAILED');location.replace('/');}catch{button.disabled=false;button.textContent=original;byId('loading').hidden=false;byId('loading').textContent='登出未完成，請稍後重試。';}});
load();