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
 try{const r=await fetch('/api/auth/me',{cache:'no-store',credentials:'same-origin'});const data=await r.json();if(!r.ok||!data.authenticated){try{sessionStorage.removeItem('ikey-welcome-user');}catch{}location.replace('/');return;}showDashboard(data.user);}catch{byId('loading').textContent='目前無法載入首頁，請稍後重新整理。';}}
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