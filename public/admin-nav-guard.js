'use strict';
(()=>{
  // Fail closed: the admin entry is never visible before a verified role response.
  const links=[...document.querySelectorAll('a[href="/super-admin.html"]')];
  for(const link of links){link.hidden=true;link.style.display='none';}
  if(!links.length)return;
  fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'})
    .then(async response=>response.ok?response.json():null)
    .then(session=>{
      if(session?.authenticated!==true||session.user?.global_role!=='super_admin')return;
      for(const link of links){link.hidden=false;link.style.removeProperty('display');}
    })
    .catch(()=>{/* A failed role check must not reveal the entry. */});
})();
