'use strict';
(()=>{
 const toggle=document.getElementById('menu-toggle');
 const sidebar=document.getElementById('sidebar');
 const backdrop=document.getElementById('sidebar-backdrop');
 if(!toggle||!sidebar||!backdrop)return;
 const setOpen=open=>{
  sidebar.classList.toggle('open',open);
  toggle.classList.toggle('is-open',open);
  document.body.classList.toggle('menu-open',open);
  toggle.setAttribute('aria-expanded',String(open));
  toggle.setAttribute('aria-label',open?'關閉導覽選單':'開啟導覽選單');
  backdrop.hidden=!open;
 };
 toggle.addEventListener('click',()=>setOpen(!sidebar.classList.contains('open')));
 backdrop.addEventListener('click',()=>{setOpen(false);toggle.focus();});
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&sidebar.classList.contains('open')){
   setOpen(false);
   toggle.focus();
  }
 });
 sidebar.querySelectorAll('a').forEach(link=>{
  link.addEventListener('click',()=>setOpen(false));
 });
 window.addEventListener('resize',()=>{
  if(window.innerWidth>760&&sidebar.classList.contains('open'))setOpen(false);
 });
})();
