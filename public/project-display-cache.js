'use strict';
/* UI-only navigation snapshot. Never use it to authorize a device or a write. */
window.iKeyProjectCache=(()=>{
 const KEY='ikey:projects:display:v1',TTL=86400000;
 const clean=p=>({project_id:p.project_id,project_name:p.project_name,description:p.description,created_at:p.created_at,updated_at:p.updated_at,creator_display_name:p.creator_display_name,status:p.status,authorization_method:p.authorization_method,scheduled_authorization:p.scheduled_authorization,notification_theme:p.notification_theme,notification_sound_pack:p.notification_sound_pack,notification_volume:p.notification_volume});
 function read(){
  try{
   const item=JSON.parse(sessionStorage.getItem(KEY)||'null');
   if(!item||!Array.isArray(item.projects)||Date.now()-item.savedAt>TTL||item.savedAt>Date.now()){sessionStorage.removeItem(KEY);return null;}
   return item.projects;
  }catch(_){return null;}
 }
 function write(projects){
  try{sessionStorage.setItem(KEY,JSON.stringify({savedAt:Date.now(),projects:projects.map(clean).slice(0,100)}));}catch(_){}
 }
 function clear(){try{sessionStorage.removeItem(KEY);}catch(_){}}
 function prefetch(){
  if(!read())return Promise.resolve(null);
  return fetch('/api/projects',{credentials:'same-origin',cache:'no-store'}).then(async r=>{
   const data=await r.json();if(!r.ok||!data.success||!Array.isArray(data.projects))throw Error('project refresh failed');
   write(data.projects);return data.projects;
  }).catch(()=>null);
 }
 return {read,write,clear,prefetch};
})();