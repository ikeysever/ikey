'use strict';
(()=>{
 const pane=document.querySelector('[data-pc-pane="basic"]');if(!pane)return;
 const id=new URLSearchParams(location.search).get('id');
 const form=document.getElementById('pc-basic-form'),name=document.getElementById('pc-basic-name'),description=document.getElementById('pc-basic-description'),state=document.getElementById('pc-basic-state'),status=document.getElementById('pc-basic-status'),save=document.getElementById('pc-basic-save'),reload=document.getElementById('pc-basic-reload');
 let initial=null,busy=false;
 const say=(s,error=false)=>{status.textContent=s;status.style.color=error?'#ffb4b4':'#b8e5f0';};
 const dirty=()=>initial&&(name.value.trim()!==initial.project_name||description.value.trim()!==initial.description);
 const sync=()=>{save.disabled=busy||!initial||!dirty();};
 function apply(p){
  initial={project_name:p.project_name,description:p.description||''};
  name.value=initial.project_name;description.value=initial.description;
  state.textContent=p.status==='active'?'啟用中':p.status==='inactive'?'已停用':'狀態未確認';
  document.getElementById('pc-basic-id').textContent=p.project_id;
  sync();
 }
 async function request(method,body){
  const response=await fetch('/api/projects/'+encodeURIComponent(id)+'/basic-settings',{method,credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.success!==true)throw Error(data.message||({401:'登入已失效',403:'沒有管理權限',404:'專案不存在'}[response.status])||'伺服器回應失敗');
  return data.project;
 }
 async function load(){
  if(busy)return;busy=true;sync();say('正在讀取專案基本設定…');
  try{apply(await request('GET'));say('已取得最新設定。');}
  catch(e){initial=null;sync();say('讀取失敗：'+e.message,true);}
  finally{busy=false;sync();}
 }
 form.addEventListener('input',sync);
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(busy||!initial||!dirty())return;
  const next={project_name:name.value.trim(),description:description.value.trim()};
  if(!next.project_name||next.project_name.length>80||next.description.length>1000){say('名稱需為 1～80 字，說明最多 1000 字。',true);return;}
  busy=true;sync();say('正在儲存並向伺服器確認…');
  try{
   apply(await request('PATCH',next));
   document.getElementById('project-title').textContent=name.value;
   document.getElementById('project-name').textContent=name.value;
   try{sessionStorage.removeItem('ikey:projects:display:v1');sessionStorage.removeItem('ikey-projects-refresh');}catch{}
   say('設定已儲存，並已重新讀取資料庫驗證。');
  }catch(e){say('儲存未確認：'+e.message+'。請按「重新讀取」，避免重複提交。',true);}
  finally{busy=false;sync();}
 });
 reload.addEventListener('click',()=>{if(dirty()&&!confirm('尚有未儲存的變更，確定重新讀取？'))return;load();});
 document.addEventListener('ikey:project-loaded',load);
})();
