'use strict';
(()=>{
 const form=document.getElementById('project-join-form'),input=document.getElementById('join-code'),button=document.getElementById('join-submit'),status=document.getElementById('join-status');
 if(!form||!input||!button||!status)return;
 button.disabled=false;button.textContent='驗證並加入專案';status.textContent='輸入管理員提供的邀請碼，即可提出申請或直接加入。';
 form.addEventListener('submit',async event=>{event.preventDefault();button.disabled=true;status.textContent='正在驗證邀請碼…';try{
 const response=await fetch('/api/projects/join',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({invite_code:input.value.trim()})});
 const data=await response.json();if(!response.ok||!data.success)throw Error(data.message||'加入失敗');
 if(data.status==='approved'){status.textContent='已成功加入「'+data.project_name+'」！';location.assign('/project.html?id='+encodeURIComponent(data.project_id));}
 else{status.textContent='已送出加入「'+data.project_name+'」的申請，請等待管理員審核。';}
 }catch(e){status.textContent=e.message||'無法送出邀請碼';}finally{button.disabled=false;}});
})();