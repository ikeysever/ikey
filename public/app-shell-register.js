'use strict';
(()=>{
 if(!('serviceWorker'in navigator)||location.protocol!=='https:')return;
 let refreshing=false;
 navigator.serviceWorker.addEventListener('controllerchange',()=>{
  if(refreshing)return;
  refreshing=true;
  // A newly activated worker must control the current page before project UI loads again.
  if(location.pathname==='/project.html')location.reload();
 });
 window.addEventListener('DOMContentLoaded',()=>{
  navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then(reg=>reg.update()).catch(()=>{});
 },{once:true});
})();
