'use strict';
const {createLineScheduleFlow}=require('./line-schedule-flow');
const COMMANDS=new Set(['帳號設定','排程申請','我的申請','申請追蹤','確認申請','開鎖']);
const BASE='https://ikey.onrender.com';
function createLineMenuService(store,env=process.env,fetcher=globalThis.fetch){
 const scheduleFlow=createLineScheduleFlow(store);
 const enabled=()=>Boolean(env.LINE_MESSAGING_CHANNEL_SECRET&&env.LINE_MESSAGING_ACCESS_TOKEN&&store&&typeof store.dbCall==='function');
 const button=(label,uri)=>({type:'button',style:'secondary',height:'sm',action:{type:'uri',label,uri}});
 const card=(title,description,buttons)=>({type:'flex',altText:'iKey｜'+title,contents:{type:'bubble',size:'mega',body:{type:'box',layout:'vertical',spacing:'md',backgroundColor:'#0b1220',contents:[{type:'text',text:'iKey 3.1',color:'#63d8e8',size:'sm',weight:'bold'},{type:'text',text:title,color:'#f8fafc',size:'xl',weight:'bold',wrap:true},{type:'text',text:description,color:'#a6b2c5',size:'sm',wrap:true}]},footer:{type:'box',layout:'vertical',spacing:'sm',contents:buttons}}});
 const text=t=>({type:'text',text:t});
 const post=(label,data)=>({type:'button',style:'secondary',height:'sm',action:{type:'postback',label,data,displayText:label}});
 async function unlockView(userId,selected=[],targetDeviceId=''){
  const select=async(table,where,limit=100)=>{const r=await store.dbCall('db.select',{table,where,limit});if(!Array.isArray(r.rows)||r.limited)throw Error('UNLOCK_LOOKUP_INCOMPLETE');return r.rows;};
  const own=await select('Projects',{created_by_user_id:userId});
  const memberships=await select('Project_Access',{user_id:userId,entry_type:'member',status:'approved'});
  const projects=own.filter(p=>p.created_by_user_id===userId&&p.status==='active');
  for(const m of memberships){if(projects.some(p=>p.project_id===m.project_id))continue;const p=(await select('Projects',{project_id:m.project_id},2))[0];if(p&&p.project_id===m.project_id&&p.status==='active')projects.push(p);}
  const available=[];const now=Date.now();
  for(const p of projects){
   const admin=p.created_by_user_id===userId||memberships.some(m=>m.project_id===p.project_id&&m.role==='admin');
   const ds=await select('Project_Devices',{project_id:p.project_id});
   const schedules=admin?[]:await select('Project_Access_Requests',{project_id:p.project_id,requester_user_id:userId,status:'approved'});
   for(const d of ds){if(d.status==='deleted'||(targetDeviceId&&d.device_id!==targetDeviceId))continue;const device=(await select('Devices',{device_id:d.device_id},2)).find(x=>x.device_id===d.device_id&&x.status==='pre_registered');if(!device)continue;const eligible=admin||schedules.some(a=>a.device_id===d.device_id&&Date.parse(a.start_at)<=now&&Date.parse(a.end_at)>now);available.push({key:p.project_id+':'+d.device_id,name:String(p.project_name||'專案').slice(0,24)+' / '+d.device_id,eligible});}
  }
  const visible=available.slice(0,8),chosen=selected.filter(x=>visible.some(d=>d.key===x&&d.eligible));
  const controls=visible.map((d,i)=>post((chosen.includes(d.key)?'☑ ':'☐ ')+d.name.slice(0,24)+(d.eligible?'':'（未授權）'),'ikey_unlock_toggle:'+i+':'+visible.map(v=>chosen.includes(v.key)?'1':'0').join('')));
  controls.push(post('送出已選裝置','ikey_unlock_submit:'+visible.map(v=>chosen.includes(v.key)?'1':'0').join('')));
  const description='已選 '+chosen.length+' 台／顯示 '+visible.length+' 台。未授權裝置不可選取。\\n目前指令服務尚未啟用；送出不會控制實體鎖。';
  return {message:card('開鎖裝置選擇',description,controls),visible,chosen,available};
 }

 async function reply(token,messages){const response=await fetcher('https://api.line.me/v2/bot/message/reply',{method:'POST',headers:{Authorization:'Bearer '+env.LINE_MESSAGING_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({replyToken:token,messages}),signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error('LINE_REPLY_HTTP_'+response.status);}
 async function push(lineId,messages,retryKey){
  const response=await fetcher('https://api.line.me/v2/bot/message/push',{method:'POST',headers:{Authorization:'Bearer '+env.LINE_MESSAGING_ACCESS_TOKEN,'Content-Type':'application/json','X-Line-Retry-Key':retryKey},body:JSON.stringify({to:lineId,messages}),signal:AbortSignal.timeout(5000)});
  if(!response.ok&&response.status!==409)throw Error('LINE_PUSH_HTTP_'+response.status);
 }
 async function audit(userId,lineId,kind,result){try{await store.dbCall('db.insert',{table:'LINE_Audit_Logs',primary_key:'audit_id',data:{audit_id:require('node:crypto').randomUUID(),user_id:userId||'',line_user_id:lineId,event_type:'menu_'+kind,result,details:'',created_at:new Date().toISOString()}})}catch(e){console.warn('LINE menu audit unavailable',e.message)}}
 async function handle(event){
  if(event?.source?.type!=='user')return {status:'ignored'};
  const isSchedulePostback=event.type==='postback'&&String(event.postback?.data||'').startsWith('ikey_schedule:');
  const isPostback=event.type==='postback'&&typeof event.postback?.data==='string'&&event.postback.data.startsWith('ikey_unlock_');
  const rawText=event?.type==='message'&&event.message?.type==='text'?String(event.message.text||'').normalize('NFKC').trim():'';
  const directOpen=/^打開(?:\s|$)/.test(rawText);
  const targetDeviceId=directOpen?rawText.slice(2).trim().toUpperCase():'';
  const command=directOpen?'開鎖':isPostback?'開鎖':event?.type==='message'&&event.message?.type==='text'?String(event.message.text||'').trim():'';
  if(!COMMANDS.has(command)&&!isSchedulePostback&&!(event.type==='message'&&event.message?.type==='text'))return {status:'ignored'};
  if(!enabled())return {status:'unknown'};
  if(event.deliveryContext?.isRedelivery)return {status:'ignored'};
  const lineId=event.source.userId,token=event.replyToken;
  if(!/^U[0-9a-f]{32}$/i.test(String(lineId||''))||!token)return {status:'ignored'};
  let messages,userId='',progressSent=false;
  const retryKey=require('node:crypto').randomUUID();
  async function showProgress(message){
   if(progressSent)return;
   progressSent=true;
   await reply(token,[text(message)]);
  }
  try{
   if(directOpen)await showProgress('已收到，正在確認裝置與開鎖資格，請稍候…');
   else if(command==='排程申請')await showProgress('已收到，正在讀取你的專案，請稍候…');
   else if(['我的申請','申請追蹤','確認申請'].includes(command))await showProgress('正在讀取申請紀錄，請稍候…');
   else if(isSchedulePostback){
    const action=event.postback.data.split(':')[2];
    await showProgress(action==='submit'?'正在送出申請並確認結果，請稍候…':action==='cancel'?'正在取消本次填寫，請稍候…':'已收到你的選擇，正在準備下一步，請稍候…');
   }
   const bindingResult=await store.dbCall('db.select',{table:'LINE_Bindings',where:{line_user_id:lineId,status:'bound'},limit:2});
   if(bindingResult.limited||bindingResult.rows.length>1)throw Error('AMBIGUOUS_LINE_BINDING');
   const binding=bindingResult.rows[0];
   if(!binding){
    if(!COMMANDS.has(command)&&!isSchedulePostback)return {status:'ignored'};
    messages=command==='帳號設定'?[text('iKey｜尚未綁定帳號\n\n1. 前往 iKey 網站並登入。\n2. 開啟「帳號管理」→「綁定 LINE」。\n3. 取得六位數驗證碼（有效五分鐘）。\n4. 將驗證碼傳送到本聊天室。\n\n若網站顯示綁定功能尚未開放，請等待系統管理員啟用。')]:[text('iKey｜請先完成 LINE 帳號綁定，再使用「'+command+'」。\n請在本聊天室輸入「帳號設定」查看說明。')];
   }else{
    userId=binding.user_id;
    const u=(await store.dbCall('db.select',{table:'Gen3_Users',where:{user_id:userId},limit:1})).rows?.[0];
    if(!u||u.account_status!=='active')throw Error('USER_NOT_ACTIVE');
    const admin=['admin','super_admin'].includes(u.global_role);
    if(!COMMANDS.has(command)&&!isSchedulePostback&&!/^\d{6}$/.test(command)&&binding.schedule_state?.expires_at>Date.now()&&['time','reason'].includes(binding.schedule_state.step))await showProgress(binding.schedule_state.step==='time'?'正在辨識使用時間，請稍候…':'已收到申請原因，正在整理確認資料，請稍候…');
    const scheduleMessages=(!['帳號設定','開鎖'].includes(command)||isSchedulePostback)?await scheduleFlow.handle({binding,userId,event,command}):null;
    if(scheduleMessages){messages=scheduleMessages;
    }else if(command==='帳號設定'){
     const info='顯示名稱：'+String(u.display_name||'—').slice(0,80)+'\n登入帳號：'+String(u.username||'—').slice(0,80)+'\n帳號狀態：正常\n系統角色：'+String(u.global_role||'user');
     const buttons=admin?[button('管理員帳號管理',BASE+'/account.html'),button('解除 LINE 綁定',BASE+'/account.html')]:[button('帳號管理',BASE+'/account.html'),button('解除 LINE 綁定',BASE+'/account.html')];
     messages=[card(admin?'管理員帳號設定':'帳號設定',info+'\n解除綁定須於網站重新輸入密碼。',buttons)];
    }else if(command==='開鎖'){
     const view=directOpen&& !/^[A-HJ-NP-Z2-9]{8}$/.test(targetDeviceId)?null:await unlockView(userId,[],directOpen?targetDeviceId:'');
     if(directOpen){
      if(!view)messages=[text('裝置編號格式不正確，請輸入「打開 ABCDEFGH」（8 碼裝置編號）。')];
      else if(!view.available.some(d=>d.eligible))messages=[text('無法開啟 '+targetDeviceId+'：找不到可用裝置或目前沒有有效開鎖權限。請確認裝置編號、專案資格與核准使用時段。')];
      else messages=[text('裝置：'+targetDeviceId+'\n開鎖資格確認完成。目前實體指令服務尚未啟用，未送出開鎖指令，裝置尚未打開。')];
     }else if(isPostback){
      const data=event.postback.data,parts=data.split(':'),bits=parts[parts.length-1];
      if(!/^[01]{0,8}$/.test(bits)||bits.length!==view.visible.length){messages=[text('選單已更新，請重新輸入「開鎖」。')];}
      else if(data.startsWith('ikey_unlock_submit:')){const picked=view.visible.filter((d,i)=>bits[i]==='1'&&d.eligible);messages=[text(picked.length?'已選取 '+picked.length+' 台裝置。指令服務尚未啟用，沒有發送任何開鎖訊號。':'尚未選取可開鎖裝置。')];}
      else if(data.startsWith('ikey_unlock_toggle:')){const index=Number(parts[1]);const selected=view.visible.filter((d,i)=>bits[i]==='1'&&d.eligible).map(d=>d.key);if(Number.isInteger(index)&&index>=0&&index<view.visible.length&&view.visible[index].eligible){const key=view.visible[index].key;const at=selected.indexOf(key);if(at>=0)selected.splice(at,1);else selected.push(key);}messages=[(await unlockView(userId,selected)).message];}
      else messages=[view.message];
     }else messages=[view.message];
    }
   }
    if(!messages)return {status:'ignored'};
  }catch(e){console.warn('LINE menu lookup unavailable',e.message);messages=[text('iKey｜申請資料暫時無法確認，請重新點選「排程申請」或稍後再試。')];}
  try{if(progressSent)await push(lineId,messages,retryKey);else await reply(token,messages);await audit(userId,lineId,COMMANDS.has(command)?command:'schedule','replied');return {status:'handled'}}catch(e){console.warn('LINE menu reply unavailable',e.message);await audit(userId,lineId,COMMANDS.has(command)?command:'schedule','unknown');return {status:'unknown'}}
 }
 return {enabled,handle};
}
module.exports={createLineMenuService,COMMANDS};
