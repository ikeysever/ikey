'use strict';
const byId=id=>document.getElementById(id);
function showDashboard(user){byId('display-name').textContent=user?.display_name||user?.username||'使用者';byId('loading').hidden=true;byId('dashboard').hidden=false;}
async function load(){try{const r=await fetch('/api/auth/me',{cache:'no-store',credentials:'same-origin'});const data=await r.json();if(!r.ok||!data.authenticated){location.replace('/');return;}showDashboard(data.user);}catch{byId('loading').textContent='目前無法載入首頁，請稍後重新整理。';}}
byId('logout').addEventListener('click',async()=>{try{await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});}finally{location.replace('/');}});
load();