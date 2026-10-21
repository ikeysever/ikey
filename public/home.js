'use strict';
const byId=id=>document.getElementById(id);
const menuToggle=byId('menu-toggle'), sidebar=byId('sidebar'), backdrop=byId('sidebar-backdrop');
function setMenu(open){
  const changed=sidebar.classList.contains('open')!==open;
  sidebar.classList.toggle('open',open);
  document.body.classList.toggle('menu-open',open);
  menuToggle.setAttribute('aria-expanded',String(open));
  menuToggle.setAttribute('aria-label',open?'關閉選單':'開啟選單');
  backdrop.hidden=!open;
  if(changed&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    menuToggle.getAnimations().forEach(animation=>animation.cancel());
    menuToggle.animate([{transform:'rotate(0deg)'},{transform:'rotate(360deg)'}],{duration:520,easing:'cubic-bezier(.2,.75,.25,1)'});
  }
}
menuToggle.addEventListener('click',()=>setMenu(!sidebar.classList.contains('open')));
backdrop.addEventListener('click',()=>setMenu(false));
document.addEventListener('keydown',e=>{if(e.key==='Escape')setMenu(false);});
sidebar.querySelectorAll('a,button').forEach(el=>el.addEventListener('click',()=>{if(innerWidth<=760)setMenu(false);}));
function showDashboard(user){byId('display-name').textContent=user?.display_name||user?.username||'使用者';byId('loading').hidden=true;byId('dashboard').hidden=false;}
async function load(){try{const r=await fetch('/api/auth/me',{cache:'no-store',credentials:'same-origin'});const data=await r.json();if(!r.ok||!data.authenticated){location.replace('/');return;}showDashboard(data.user);}catch{byId('loading').textContent='目前無法載入首頁，請稍後重新整理。';}}
byId('logout').addEventListener('click',async()=>{const button=byId('logout');if(button.disabled)return;button.disabled=true;const original=button.textContent;button.textContent='正在安全登出…';try{const response=await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});const result=await response.json();if(!response.ok||!result.success)throw Error('LOGOUT_FAILED');location.replace('/');}catch{button.disabled=false;button.textContent=original;byId('loading').hidden=false;byId('loading').textContent='登出未完成，請稍後重試。';}});
load();