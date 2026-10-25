'use strict';
(()=>{
 const form=document.getElementById('join-form');
 if(!form)return;
 const code=document.getElementById('join-code'),button=document.getElementById('join-submit'),note=document.getElementById('join-note');
 form.addEventListener('submit',async event=>{
  event.preventDefault();const invite=code.value.trim();
  if(!/^[A-Za-z0-9_-]{24}$/.test(invite)){note.textContent='邀請碼應為 24 個英文、數字或 - _ 字元，請檢查是否完整貼上。';code.focus();return;}
  button.disabled=true;code.disabled=true;note.textContent='正在確認邀請碼與專案加入方式…';
  try{
   const response=await fetch('/api/projects/join',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({invite_code:invite})});
   const data=await response.json();
   if(response.status===401){note.textContent='登入已失效，請先登入後再加入專案。';return;}
   if(!response.ok||!data.success)throw Error(data.message||'加入專案失敗');
   if(data.status==='pending'){
    note.textContent='已送出「'+data.project_name+'」的加入申請。管理員核准後，專案會出現在「我的專案」。';
   }else{
    note.replaceChildren();
    note.append(document.createTextNode('已成功加入「'+data.project_name+'」。 '));
    const link=document.createElement('a');link.href='/project.html?id='+encodeURIComponent(data.project_id);link.textContent='進入專案 →';note.append(link);
   }
   code.value=''; // never retain invitation secrets after submission
  }catch(error){note.textContent=error.message||'無法確認邀請碼，請稍後再試';}
  finally{button.disabled=false;code.disabled=false;}
 });
})();
