'use strict';
const VERSION='ikey-shell-20261026-v1';
const SHELL=['/home.html','/projects.html','/project.html','/project-devices.html','/project-other-settings.html','/home.css','/home.js','/projects.js','/project.js','/project-devices.js','/project-other-settings.js','/project-subpages.css','/project-display-cache.js','/assets/brand/ikey-nextgen.svg'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(VERSION).then(cache=>Promise.allSettled(SHELL.map(url=>cache.add(new Request(url,{cache:'reload'}))))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ikey-shell-')&&k!==VERSION).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/auth/')||url.pathname==='/'||url.pathname==='/index.html')return;
 if(request.mode==='navigate'){
  if(!SHELL.includes(url.pathname))return;
  event.respondWith(caches.open(VERSION).then(async cache=>{
   const hit=await cache.match(url.pathname);
   const update=fetch(request).then(response=>{if(response.ok)cache.put(url.pathname,response.clone());return response;}).catch(()=>null);
   if(hit){event.waitUntil(update);return hit;}
   return (await update)||Response.error();
  }));
  return;
 }
 if(!SHELL.includes(url.pathname))return;
 event.respondWith(caches.open(VERSION).then(async cache=>{
  const hit=await cache.match(url.pathname);
  if(hit)return hit;
  const response=await fetch(request);
  if(response.ok)event.waitUntil(cache.put(url.pathname,response.clone()));
  return response;
 }));
});