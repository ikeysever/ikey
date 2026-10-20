'use strict';
const byId=id=>document.getElementById(id);
const menuToggle=byId('menu-toggle'), sidebar=byId('sidebar'), backdrop=byId('sidebar-backdrop');
function setMenu(open){sidebar.classList.toggle('open',open);document.body.classList.toggle('menu-open',open);menuToggle.setAttribute('aria-expanded',String(open));menuToggle.setAttribute('aria-label',open?'關閉選單':'開啟選單');backdrop.hidden=!open;}
menuToggle.addEventListener('click',()=>setMenu(!sidebar.classList.contains('open')));
backdrop.addEventListener('click',()=>setMenu(false));
document.addEventListener('keydown',e=>{if(e.key==='Escape')setMenu(false);});
sidebar.querySelectorAll('a,button').forEach(el=>el.addEventListener('click',()=>{if(innerWidth<=760)setMenu(false);}));
function showDashboard(user){byId('display-name').textContent=user?.display_name||user?.username||'使用者';byId('loading').hidden=true;byId('dashboard').hidden=false;}
async function load(){try{const r=await fetch('/api/auth/me',{cache:'no-store',credentials:'same-origin'});const data=await r.json();if(!r.ok||!data.authenticated){location.replace('/');return;}showDashboard(data.user);}catch{byId('loading').textContent='目前無法載入首頁，請稍後重新整理。';}}
byId('logout').addEventListener('click',async()=>{try{await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});}finally{location.replace('/');}});
load();