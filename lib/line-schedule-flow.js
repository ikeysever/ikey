'use strict';
const {randomUUID}=require('node:crypto');
const {parseScheduleInput}=require('./line-schedule-parser');
const PERMANENT_END='9999-12-31T23:59:59.000Z';
const format=value=>new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value));
function createLineScheduleFlow(store){
 const select=async(table,where,limit=100)=>{
  const result=await store.dbCall('db.select',{table,where,limit});
  if(!Array.isArray(result.rows)||result.limited)throw Error('清單超過讀取上限或無法確認，請使用網站查看。');
  return result.rows;
 };
 async function projectsFor(userId){
  const own=await select('Projects',{created_by_user_id:userId});
  const members=await select('Project_Access',{user_id:userId,entry_type:'member',status:'approved'});
  const projects=new Map(own.filter(p=>p.created_by_user_id===userId&&p.status==='active').map(p=>[p.project_id,p]));
  for(const m of members){
   if(projects.has(m.project_id))continue;
   const rows=await select('Projects',{project_id:m.project_id},2);
   const p=rows.find(p=>p.project_id===m.project_id&&p.status==='active');
   if(p)projects.set(p.project_id,p);
  }
  return [...projects.values()];
 }
 async function devicesFor(projectId){
  return (await select('Project_Devices',{project_id:projectId})).filter(d=>d.project_id===projectId&&/^[A-HJ-NP-Z2-9]{8}$/.test(d.device_id)&&d.status!=='deleted');
 }
 async function handle({binding,userId,event,command}){
  const isPost=event.type==='postback'&&String(event.postback?.data||'').startsWith('ikey_schedule:');
  const active=binding.schedule_state&&binding.schedule_state.expires_at>Date.now();
  const entry=['排程申請','我的申請'].includes(command);
  if(!entry&&!isPost&&!active)return null;
  // Verification codes remain available to the account binding handler.
  if(!entry&&!isPost&&/^\d{6}$/.test(command))return null;
  let state=active?{...binding.schedule_state}:{},favorites=Array.isArray(binding.favorite_project_ids)?[...binding.favorite_project_ids]:[];
  let version=Number(binding.schedule_version)||0;
  let message='';let choices=[];
  const button=(label,action,arg='')=>({type:'button',style:'secondary',height:'sm',action:{type:'postback',label:label.slice(0,40),data:['ikey_schedule',version+1,action,arg].join(':')}});
  const all=await projectsFor(userId);
  favorites=favorites.filter(id=>all.some(p=>p.project_id===id));
  const parts=isPost?event.postback.data.split(':'):[];
  let action=parts[2],arg=parts.slice(3).join(':');
  const retrySubmit=isPost&&action==='submit'&&state.step==='submitting'&&Number(parts[1])===version-1;
  if(isPost&&(!active||(Number(parts[1])!==version&&!retrySubmit)))return [{type:'text',text:'這張選單已更新或逾時，請重新點選「排程申請」。'}];
  if(entry&&state.step==='submitting'){action='submit';}
  else if(entry){state={step:command==='我的申請'?'requests':'projects'};action=command==='我的申請'?'requests':'favorites';}
  if(!isPost&&!entry){
   if(state.step==='time'){
    const parsed=parseScheduleInput(command);
    if(!parsed.success){message=parsed.message;}
    else{
     const start=parsed.kind==='permanent'?Date.now():Date.parse(parsed.start_at);
     const end=parsed.kind==='permanent'?Date.parse(PERMANENT_END):Date.parse(parsed.end_at);
     if(end<=Date.now()||start>Date.now()+90*86400000)message='請填寫尚未結束的時段，開始日期限未來 90 天內。';
     else{state.period={start_at:new Date(start).toISOString(),end_at:new Date(end).toISOString()};state.step='time_confirm';}
    }
   }else if(state.step==='reason'){
    if(!command||command.length>500)message='請填寫 1～500 字的申請原因。';
    else{state.reason=command;state.step='confirm';state.request_id=randomUUID();}
   }else message='請使用下方選項繼續，或點選「排程申請」重新開始。';
  }
  if(action==='cancel'){state={step:'cancelled'};message='這次申請已取消。';}
  if(['favorites','all','manage'].includes(action)){
   state={step:'projects',mode:action,page:Number(arg)||0};
  }
  if(action==='favorite'){
   if(!all.some(p=>p.project_id===arg))throw Error('此專案已停用或無存取權限。');
   favorites=favorites.includes(arg)?favorites.filter(id=>id!==arg):[...favorites,arg];
   state={step:'projects',mode:'manage',page:state.page||0};
  }
  if(action==='project'){
   if(!all.some(p=>p.project_id===arg))throw Error('此專案已停用或無存取權限，請重新申請。');
   state={step:'devices',project_id:arg,page:0};
  }
  if(action==='devices'){state.step='devices';state.page=Number(arg)||0;}
  if(action==='device'){
   const devices=await devicesFor(state.project_id);
   if(!devices.some(d=>d.device_id===arg))throw Error('裝置已移除，請重新選擇。');
   state.device_id=arg;state.step='time';delete state.period;
  }
  if(action==='time'){state.step='time';delete state.request_id;}
  if(action==='time_ok'&&state.step==='time_confirm')state.step='reason';
  if(action==='edit')state.step='edit';
  if(action==='reason')state.step='reason';
  if(action==='requests'){state={step:'requests',page:Number(arg)||0};}
  if(action==='submit'){
   if(!['confirm','submitting','submitted'].includes(state.step)||!state.request_id||!state.period||!state.reason)throw Error('申請內容不完整，請重新開始。');
   if(!all.some(p=>p.project_id===state.project_id))throw Error('專案已停用或你已退出，請重新選擇。');
   if(!(await devicesFor(state.project_id)).some(d=>d.device_id===state.device_id))throw Error('裝置已移除，請重新選擇。');
   if(Date.parse(state.period.end_at)<=Date.now())throw Error('使用時段已結束，請重新填寫時間。');
   if(state.step!=='submitted'){
    state.step='submitting';
    const claimed=await store.dbCall('db.update',{table:'LINE_Bindings',where:{binding_id:binding.binding_id,user_id:userId,status:'bound',schedule_version:version},data:{schedule_state:state,schedule_version:version+1}});
    if(claimed.count!==1)throw Error('申請正在處理中，請查看我的申請。');
    version++;
   }
   const data={request_id:state.request_id,project_id:state.project_id,device_id:state.device_id,requester_user_id:userId,reason:state.reason,...state.period,status:'pending'};
   try{await store.dbCall('db.insert',{table:'Project_Access_Requests',primary_key:'request_id',data});}
   catch(error){
    const existing=(await select('Project_Access_Requests',{request_id:state.request_id},2))[0];
    if(!existing||existing.requester_user_id!==userId||existing.project_id!==state.project_id||existing.device_id!==state.device_id)throw error;
   }
   state.step='submitted';
  }
  const project=all.find(p=>p.project_id===state.project_id);
  if(state.project_id&&!project&&!['cancelled','requests'].includes(state.step))throw Error('專案已停用或無存取權限，請重新點選「排程申請」。');
  const period=()=>state.period.end_at===PERMANENT_END?'永久使用':format(state.period.start_at)+' ～ '+format(state.period.end_at)+'（臺灣時間）';
  if(state.step==='projects'){
   const rows=state.mode==='favorites'&&favorites.length?all.filter(p=>favorites.includes(p.project_id)):all;
   const page=Math.max(0,Math.min(Number(state.page)||0,Math.max(0,Math.ceil(rows.length/6)-1)));state.page=page;
   message=state.mode==='manage'?'點選專案可加入或移除常用。':favorites.length&&state.mode==='favorites'?'選擇常用專案。':'選擇專案。';
   if(!rows.length)message='目前沒有可申請的啟用專案，請先加入專案。';
   choices=rows.slice(page*6,page*6+6).map(p=>button((state.mode==='manage'?(favorites.includes(p.project_id)?'★ ':'☆ '):'')+String(p.project_name||'未命名')+' · '+p.project_id.slice(-6),state.mode==='manage'?'favorite':'project',p.project_id));
   if(page>0)choices.push(button('上一頁',state.mode,String(page-1)));
   if((page+1)*6<rows.length)choices.push(button('下一頁',state.mode,String(page+1)));
   choices.push(button('常用專案','favorites'),button('其他專案','all'),button(state.mode==='manage'?'完成常用設定':'管理常用',state.mode==='manage'?'favorites':'manage'));
  }else if(state.step==='devices'){
   const devices=await devicesFor(state.project_id);const page=Math.max(0,Number(state.page)||0);
   message=project.project_name+'\n請選一台 iBOX。'+(!devices.length?'目前沒有可選裝置。':'');
   choices=devices.slice(page*6,page*6+6).map(d=>button(String(d.display_name||'iBOX')+' · '+d.device_id,'device',d.device_id));
   if(page>0)choices.push(button('上一頁','devices',String(page-1)));
   if((page+1)*6<devices.length)choices.push(button('下一頁','devices',String(page+1)));
   choices.push(button('返回選專案','favorites'));
  }else if(state.step==='time'){
   message=(message?message+'\n\n':'')+'請傳送使用時間，例如：\n20261116 8:00-10:00\n或跨日：\n20261116 8:00-20261119 10:00\n也可輸入「永久」。';
   choices=[button('返回選裝置','devices')];
  }else if(state.step==='time_confirm'){
   message='請確認使用時間\n'+period();choices=[button('時間正確','time_ok'),button('重新輸入','time')];
  }else if(state.step==='reason'){
   message=(message?message+'\n':'')+'請傳送申請原因（1～500 字）。';choices=[button('修改時間','time')];
  }else if(state.step==='confirm'||state.step==='submitted'){
   message=(state.step==='submitted'?'申請已送出，請至「我的申請」查看最新審核狀態。\n申請編號：'+state.request_id:'確認申請內容')+'\n專案：'+project.project_name+'\n裝置：'+state.device_id+'\n使用時間：'+period()+'\n原因：'+state.reason;
   choices=state.step==='submitted'?[button('查看我的申請','requests'),button('再申請一筆','favorites')]:[button('確認送出','submit'),button('修改資料','edit')];
  }else if(state.step==='edit'){
   message='選擇要修改的資料。';choices=[button('專案','favorites'),button('裝置','devices'),button('使用時間','time'),button('申請原因','reason')];
  }else if(state.step==='requests'){
   const rows=(await select('Project_Access_Requests',{requester_user_id:userId})).filter(r=>all.some(p=>p.project_id===r.project_id)).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
   const page=Math.max(0,Number(state.page)||0);const labels={pending:'待審核',approved:'已核准',rejected:'已拒絕',cancelled:'已取消'};
   message=rows.slice(page*3,page*3+3).map(r=>all.find(p=>p.project_id===r.project_id).project_name+' / '+r.device_id+'\n'+(labels[r.status]||r.status)+'\n'+(new Date(r.end_at).getUTCFullYear()===9999?'永久使用':format(r.start_at)+' ～ '+format(r.end_at))+'\n編號：'+r.request_id).join('\n\n')||'目前沒有申請。';
   choices=[button('新增申請','favorites')];if(page>0)choices.push(button('上一頁','requests',String(page-1)));if((page+1)*3<rows.length)choices.push(button('下一頁','requests',String(page+1)));
  }
  if(!['submitted','cancelled'].includes(state.step))choices.push(button('取消','cancel'));
  state.expires_at=Date.now()+30*60000;
  const result=await store.dbCall('db.update',{table:'LINE_Bindings',where:{binding_id:binding.binding_id,user_id:userId,line_user_id:event.source.userId,status:'bound',schedule_version:version},data:{schedule_state:state,schedule_version:version+1,favorite_project_ids:favorites}});
  if(result.count!==1)throw Error('選單已更新，請重新點選「排程申請」。');
  return [{type:'flex',altText:message.slice(0,200),contents:{type:'bubble',body:{type:'box',layout:'vertical',contents:[{type:'text',text:message,wrap:true}]},...(choices.length?{footer:{type:'box',layout:'vertical',spacing:'sm',contents:choices}}:{})}}];
 }
 return {handle};
}
module.exports={createLineScheduleFlow,PERMANENT_END};
