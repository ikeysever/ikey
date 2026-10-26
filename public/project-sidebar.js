'use strict';
(()=>{
 const button=document.getElementById('menu-toggle');
 const sidebar=document.getElementById('sidebar');
 const backdrop=document.getElementById('sidebar-backdrop');
 if(!button||!sidebar||!backdrop)return;
 function setOpen(open){
  if(window.innerWidth>760){
   document.body.classList.toggle('desktop-sidebar-collapsed',!open);
   button.classList.toggle('is-open',open);
   button.setAttribute('aria-expanded',String(open));
   button.setAttribute('aria-label',open?'收合側欄':'展開側欄');
   return;
  }
  sidebar.classList.toggle('open',open);
  document.body.classList.toggle('menu-open',open);
  button.classList.toggle('is-open',open);
  button.setAttribute('aria-expanded',String(open));
  button.setAttribute('aria-label',open?'關閉選單':'開啟選單');
  backdrop.hidden=!open;
 }
 button.addEventListener('click',()=>setOpen(window.innerWidth>760?document.body.classList.contains('desktop-sidebar-collapsed'):!sidebar.classList.contains('open')));
 backdrop.addEventListener('click',()=>setOpen(false));
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&window.innerWidth<=760)setOpen(false);});
 window.addEventListener('resize',()=>{
  if(window.innerWidth>760){sidebar.classList.remove('open');document.body.classList.remove('menu-open');backdrop.hidden=true;}
  else{document.body.classList.remove('desktop-sidebar-collapsed');button.classList.remove('is-open');button.setAttribute('aria-expanded','false');button.setAttribute('aria-label','開啟選單');}
 });
})();
