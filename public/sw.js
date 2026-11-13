'use strict';
const VERSION='ikey-shell-20261113-network-first-v3';
const SHELL=['/home.html','/projects.html','/home.css','/home.js','/projects.js','/project-display-cache.js','/assets/brand/ikey-nextgen.svg'];
const DYNAMIC=new Set(['/project.html','/project.js','/project-cards.css','/project-alert-settings.js','/project-sidebar.js','/project-members.js','/project-devices-pane.js','/project-access-requests.js','/project-devices.html','/project-devices.js','/project-other-settings.html','/project-other-settings.js','/project-subpages.css']);
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(VERSION).then(cache=>Promise.allSettled(SHELL.map(url=>cache.add(new Request(url,{cache:'reload'}))))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ikey-shell-')&&k!==VERSION).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/auth/')||url.pathname==='/'||url.pathname==='/index.html')return;
 if(DYNAMIC.has(url.pathname)){
  event.respondWith(fetch(request,{cache:'no-store'}).catch(()=>Response.error()));
  return;
 }
 if(request.mode==='navigate'){
  if(!SHELL.includes(url.pathname))return;
  event.respondWith(fetch(request,{cache:'no-store'}).catch(async()=>await caches.match(url.pathname)||Response.error()));
  return;
 }
 if(!SHELL.includes(url.pathname))return;
 event.respondWith(fetch(request,{cache:'no-store'}).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(VERSION).then(cache=>cache.put(url.pathname,copy)))}return response}).catch(async()=>await caches.match(url.pathname)||Response.error()));
});
