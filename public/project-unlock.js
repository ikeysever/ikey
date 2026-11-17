'use strict';
(async()=>{
 const el=id=>document.getElementById(id);
 const id=new URLSearchParams(location.search).get('id');
 const status=el('status');
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)){
  status.textContent='專案連結無效。';return;
 }
 const project='/project.html?id='+encodeURIComponent(id);
 el('back').href=project;
 el('schedule').href=project+'&pane=auth';
 const api='/api/projects/'+encodeURIComponent(id);
 async function request(url,method='GET'){
  const response=await fetch(url,{method,credentials:'same-origin',cache:'no-store'});
  const data=await response.json();
  if(!response.ok||!data.success)throw Error(data.message||data.code||'操作失敗');
  return data;
 }
 try{
  const [inventory,access]=await Promise.all([request(api+'/devices'),request(api+'/unlock-eligibility')]);
  el('project-name').textContent=inventory.project_name||'專案裝置';
  el('unlock-gate').textContent=access.command_ready?'實體指令服務已啟用':'實體指令服務尚未啟用。送出請求後可查看伺服器的驗證結果。';
  for(const device of inventory.devices){
   const button=document.createElement('button');
   const eligible=access.devices.some(d=>d.device_id===device.device_id&&d.eligible);
   button.textContent=(device.device_name||'iBOX')+' · '+device.device_id+(eligible?'｜立即開鎖':'｜尚無有效時段');
   button.disabled=!eligible;
   button.onclick=async()=>{
    button.disabled=true;status.textContent='正在驗證 '+device.device_id+' 的開鎖請求…';
    try{const result=await request(api+'/devices/'+encodeURIComponent(device.device_id)+'/unlock','POST');status.textContent=result.message||'尚未取得執行回報';}
    catch(error){status.textContent=device.device_id+'：'+error.message;}
    finally{button.disabled=!eligible;}
   };
   el('devices').append(button);
  }
  status.textContent=inventory.devices.length?'請選擇裝置或申請使用時段。':'目前沒有已綁定的 iBOX。';
 }catch(error){status.textContent='無法載入專案裝置：'+error.message;}
})();
