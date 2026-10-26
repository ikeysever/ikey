'use strict';
(()=>{
 if(!('serviceWorker'in navigator)||location.protocol!=='https:')return;
 window.addEventListener('load',()=>{
  navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(()=>{});
 },{once:true});
})();