'use strict';
const byId=id=>document.getElementById(id);
const menuToggle=byId('menu-toggle'), sidebar=byId('sidebar'), backdrop=byId('sidebar-backdrop');
function setMenu(open){
  if(window.innerWidth>760){
    document.body.classList.toggle('desktop-sidebar-collapsed',!open);
    menuToggle.classList.toggle('is-open',open);
    menuToggle.setAttribute('aria-expanded',String(open));
    menuToggle.setAttribute('aria-label',open?'收合側欄':'展開側欄');
    return;
  }
  sidebar.classList.toggle('open',open);
  menuToggle.classList.toggle('is-open',open);
  document.body.classList.toggle('menu-open',open);
  menuToggle.setAttribute('aria-expanded',String(open));
  menuToggle.setAttribute('aria-label',open?'關閉選單':'開啟選單');
  backdrop.hidden=!open;
  // Rotation is state-driven in CSS: open +180°, close back to 0°.

}
menuToggle.addEventListener('click',()=>setMenu(window.innerWidth>760?document.body.classList.contains('desktop-sidebar-collapsed'):!sidebar.classList.contains('open')));
backdrop.addEventListener('click',()=>setMenu(false));
window.addEventListener('resize',()=>{
  if(window.innerWidth>760){sidebar.classList.remove('open');backdrop.hidden=true;document.body.classList.remove('menu-open');}
  else{document.body.classList.remove('desktop-sidebar-collapsed');menuToggle.classList.remove('is-open');menuToggle.setAttribute('aria-expanded','false');menuToggle.setAttribute('aria-label','開啟選單');}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')setMenu(false);});
// Keep the sidebar open when toggling the nested project list on mobile.
sidebar.querySelectorAll('a,button').forEach(el=>el.addEventListener('click',()=>{if(el.id==='project-menu-toggle')return;if(innerWidth<=760)setMenu(false);}));
const projectMenuToggle=byId('project-menu-toggle'),projectMenuContent=byId('project-menu-content');
if(projectMenuToggle&&projectMenuContent){projectMenuToggle.addEventListener('click',()=>{const open=projectMenuToggle.getAttribute('aria-expanded')!=='true';projectMenuToggle.setAttribute('aria-expanded',String(open));projectMenuToggle.setAttribute('aria-label',open?'收合我的專案':'展開我的專案');const chevron=projectMenuToggle.querySelector('.project-menu-chevron');if(chevron)chevron.textContent=open?'▼':'▶';projectMenuContent.hidden=!open;});}
function showDashboard(user){
  if(byId('projects-panel')){byId('loading').hidden=true;byId('projects-panel').hidden=false;return;}
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
async function load(){
 // Paint non-sensitive page chrome immediately using the user verified during welcome.
 try{const cached=JSON.parse(sessionStorage.getItem('ikey-welcome-user')||'null');if(cached){showDashboard(cached);}}catch{}
 try{const r=await fetch('/api/auth/me',{cache:'no-store',credentials:'same-origin'});const data=await r.json();if(!r.ok||!data.authenticated){try{sessionStorage.removeItem('ikey-welcome-user');sessionStorage.removeItem('ikey:projects:display:v1');sessionStorage.removeItem('ikey-projects-refresh');}catch{}location.replace('/');return;}showDashboard(data.user);window.dispatchEvent(new CustomEvent('ikey:session-verified',{detail:{role:data.user?.global_role}}));}catch{byId('loading').textContent='目前無法載入首頁，請稍後重新整理。';}}
// Synthesize a short metallic latch click; no external audio asset required.
function createLogoutLatchSound(){
 try{
  const AudioContextClass=window.AudioContext||window.webkitAudioContext;
  if(!AudioContextClass)return ()=>{};
  // Construct and resume in the user click handler to satisfy autoplay policies.
  const audioContext=new AudioContextClass();
  audioContext.resume().catch(()=>{});
  return ()=>{
   try{
    const now=audioContext.currentTime;
    const gain=audioContext.createGain();
    gain.gain.setValueAtTime(0.0001,now);
    gain.gain.exponentialRampToValueAtTime(0.18,now+0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001,now+0.14);
    gain.connect(audioContext.destination);
    const tone=audioContext.createOscillator();
    tone.type='triangle';
    tone.frequency.setValueAtTime(780,now);
    tone.frequency.exponentialRampToValueAtTime(230,now+0.105);
    tone.connect(gain);tone.start(now);tone.stop(now+0.15);
    tone.onended=()=>{audioContext.close().catch(()=>{});};
   }catch{audioContext.close().catch(()=>{});}
  };
 }catch{return ()=>{};}
}
function playLogoutLockAnimation(playLatchSound){
 return new Promise(resolve=>{
  const style=document.createElement('style');
  style.textContent=`#ikey-logout-overlay{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;background:radial-gradient(circle at 20% 0%,#1b3150 0,#0b1220 42%,#070c16 100%);color:#eefaff}#ikey-logout-overlay svg{width:min(330px,76vw);height:auto;overflow:visible}#ikey-logout-overlay .shackle{transform-origin:80px 87px;animation:ikey-lock-close 1s cubic-bezier(.2,.8,.2,1) forwards}#ikey-logout-overlay .lock-glow{opacity:0;animation:ikey-lock-glow .65s ease 1s forwards}@keyframes ikey-lock-close{0%{transform:translateY(-28px)}75%,100%{transform:translateY(0)}}@keyframes ikey-lock-glow{0%{opacity:0}40%{opacity:1}100%{opacity:.35}}@media(prefers-reduced-motion:reduce){#ikey-logout-overlay .shackle,#ikey-logout-overlay .lock-glow{animation:none}#ikey-logout-overlay .lock-glow{opacity:.3}}`;
  document.head.append(style);
  const overlay=document.createElement('div');overlay.id='ikey-logout-overlay';overlay.setAttribute('role','status');overlay.setAttribute('aria-label','已安全登出');
  overlay.innerHTML='<svg viewBox="0 0 160 185" aria-hidden="true"><circle class="lock-glow" cx="80" cy="92" r="79" fill="none" stroke="#64e4c2" stroke-width="4"/><g class="shackle"><path d="M48 88V59a32 32 0 0 1 64 0v29" fill="none" stroke="#a4f4e2" stroke-width="13" stroke-linecap="round"/></g><rect x="32" y="80" width="96" height="76" rx="17" fill="#18374d" stroke="#79d9e8" stroke-width="3"/><circle cx="80" cy="111" r="9" fill="#b5fff0"/><path d="M80 118v17" stroke="#b5fff0" stroke-width="7" stroke-linecap="round"/></svg>';
  document.body.append(overlay);
  if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
   const shackle=overlay.querySelector('.shackle');
   shackle.addEventListener('animationend',event=>{if(event.animationName==='ikey-lock-close')playLatchSound();},{once:true});
  }else playLatchSound();
  window.setTimeout(resolve,window.matchMedia('(prefers-reduced-motion: reduce)').matches?350:1800);
 });
}
byId('logout').addEventListener('click',async()=>{
 const button=byId('logout');if(button.disabled)return;
 button.disabled=true;
 const original=button.textContent;
 // Start the lock animation on the first click, while the logout request runs.
 const playLatchSound=createLogoutLatchSound();
 const animation=playLogoutLockAnimation(playLatchSound);
 try{
  const response=await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});
  const result=await response.json();
  if(!response.ok||!result.success)throw Error('LOGOUT_FAILED');
  await animation;
  try{sessionStorage.removeItem('ikey-welcome-user');}catch{}
  location.replace('/');
 }catch{
  document.getElementById('ikey-logout-overlay')?.remove();
  button.disabled=false;button.textContent=original;
  byId('loading').hidden=false;byId('loading').textContent='登出未完成，請稍後重試。';
 }
});
load();
/* iKey 3.1 super-admin sidebar navigation: links reuse existing guarded modules. */
document.addEventListener('DOMContentLoaded',()=>{
  const nav=document.querySelector('#sidebar nav');
  if(!nav)return;
  const link=Array.from(nav.querySelectorAll('a')).find(a=>a.getAttribute('href')==='/super-admin.html');
  if(!link)return;
  const wrapper=document.createElement('div');
  wrapper.className='project-nav admin-side-nav';
  const heading=document.createElement('div');
  heading.className='project-nav-heading';
  const toggle=document.createElement('button');
  toggle.type='button';toggle.className='project-menu-toggle';
  toggle.setAttribute('aria-label','展開超級管理員');
  toggle.setAttribute('aria-controls','admin-side-menu');
  const chevron=document.createElement('span');
  chevron.className='project-menu-chevron';
  chevron.setAttribute('aria-hidden','true');chevron.textContent='▶';
  toggle.append(chevron);
  link.classList.add('project-nav-link');
  heading.append(toggle,link);
  const content=document.createElement('div');
  content.id='admin-side-menu';
  const modules=[['裝置管理','devices'],['帳號與權限','accounts'],['系統公告','announcements']];
  for(const [label,key] of modules){
    const a=document.createElement('a');
    a.href='/super-admin.html#'+key;
    a.textContent=label;
    a.className='admin-side-item';
    content.append(a);
  }
  for(const label of ['資料管理（規劃中）','系統狀態（規劃中）','操作紀錄（規劃中）','系統設定（規劃中）']){
    const item=document.createElement('span');
    item.className='admin-side-item admin-side-disabled';
    item.textContent=label;
    content.append(item);
  }
  wrapper.append(heading,content);
  link.replaceWith(wrapper);
  const onAdmin=location.pathname==='/super-admin.html';
  let expanded=onAdmin;
  function render(){
    content.hidden=!expanded;
    toggle.setAttribute('aria-expanded',String(expanded));
    toggle.setAttribute('aria-label',expanded?'收合超級管理員':'展開超級管理員');
    chevron.textContent=expanded?'▼':'▶';
  }
  toggle.addEventListener('click',()=>{expanded=!expanded;render()});
  render();
  const style=document.createElement('style');
  style.textContent='.admin-side-item{display:block;padding:9px 12px 9px 34px;color:#c8d8e8;text-decoration:none;font-size:14px;border-radius:9px}.admin-side-item:hover{background:#20364d}.admin-side-item[aria-current="page"]{color:#63d8e8;background:#1c3043;font-weight:700}.admin-side-disabled{opacity:.48;cursor:not-allowed}.admin-side-disabled:hover{background:transparent}';
  document.head.append(style);
  if(!onAdmin)return;
  function activate(){
    const key=location.hash.slice(1);
    const target={devices:'admin-open-devices',accounts:'admin-open-accounts',announcements:'admin-open-announcements'}[key]?'':null;
    const valid=['devices','accounts','announcements'].includes(key)?key:'devices';
    const button=document.getElementById({devices:'admin-open-devices',accounts:'admin-open-accounts',announcements:'admin-open-announcements'}[valid]);
    if(!button)return;
    for(const id of ['device-management-region','admin-accounts-region','announcement-management-region']){
      const el=document.getElementById(id);if(el)el.hidden=true;
    }
    button.click();
    content.querySelectorAll('a').forEach(a=>{
      if(a.hash==='#'+valid)a.setAttribute('aria-current','page');
      else a.removeAttribute('aria-current');
    });
  }
  window.addEventListener('hashchange',activate);
  activate();
});
