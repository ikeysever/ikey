'use strict';
const COMMANDS=new Set(['帳號設定','排程申請','開鎖']);
const BASE='https://ikey.onrender.com';
function createLineMenuService(store,env=process.env,fetcher=globalThis.fetch){
 const enabled=()=>Boolean(env.LINE_MESSAGING_CHANNEL_SECRET&&env.LINE_MESSAGING_ACCESS_TOKEN&&store&&typeof store.dbCall==='function');
 const button=(label,uri)=>({type:'button',style:'secondary',height:'sm',action:{type:'uri',label,uri}});
 const card=(title,description,buttons)=>({type:'flex',altText:'iKey｜'+title,contents:{type:'bubble',size:'mega',body:{type:'box',layout:'vertical',spacing:'md',backgroundColor:'#0b1220',contents:[{type:'text',text:'iKey 3.1',color:'#63d8e8',size:'sm',weight:'bold'},{type:'text',text:title,color:'#f8fafc',size:'xl',weight:'bold',wrap:true},{type:'text',text:description,color:'#a6b2c5',size:'sm',wrap:true}]},footer:{type:'box',layout:'vertical',spacing:'sm',contents:buttons}}});
 const text=t=>({type:'text',text:t});
 const post=(label,data)=>({type:'button',style:'secondary',height:'sm',action:{type:'postback',label,data,displayText:label}});
 async function unlockView(userId,selected=[]){
  const own=(await store.dbCall('db.select',{table:'Projects',where:{created_by_user_id:userId},limit:100})).rows||[];
  const memberships=(await store.dbCall('db.select',{table:'Project_Access',where:{user_id:userId,entry_type:'member',status:'approved'},limit:100})).rows||[];
  const projects=own.filter(p=>p.status!=='deleted');
  for(const m of memberships){if(projects.some(p=>p.project_id===m.project_id))continue;const p=(await store.dbCall('db.select',{table:'Projects',where:{project_id:m.project_id},limit:1})).rows?.[0];if(p&&p.status!=='deleted')projects.push(p);}
  const available=[];const now=Date.now();
  for(const p of projects.slice(0,20)){
   const admin=p.created_by_user_id===userId||memberships.some(m=>m.project_id===p.project_id&&m.role==='admin');
   const ds=(await store.dbCall('db.select',{table:'Project_Devices',where:{project_id:p.project_id},limit:100})).rows||[];
   const schedules=admin?[]:(await store.dbCall('db.select',{table:'Project_Access_Requests',where:{project_id:p.project_id,requester_user_id:userId,status:'approved'},limit:100})).rows||[];
   for(const d of ds){const eligible=admin||schedules.some(a=>a.device_id===d.device_id&&Date.parse(a.start_at)<=now&&Date.parse(a.end_at)>now);available.push({key:p.project_id+':'+d.device_id,name:String(p.project_name||'專案').slice(0,24)+' / '+d.device_id,eligible});}
  }
  const visible=available.slice(0,8),chosen=selected.filter(x=>visible.some(d=>d.key===x&&d.eligible));
  const controls=visible.map((d,i)=>post((chosen.includes(d.key)?'☑ ':'☐ ')+d.name.slice(0,24)+(d.eligible?'':'（未授權）'),'ikey_unlock_toggle:'+i+':'+visible.map(v=>chosen.includes(v.key)?'1':'0').join('')));
  controls.push(post('送出已選裝置','ikey_unlock_submit:'+visible.map(v=>chosen.includes(v.key)?'1':'0').join(''));
  const description='已選 '+chosen.length+' 台／顯示 '+visible.length+' 台。未授權裝置不可選取。\\n目前指令服務尚未啟用；送出不會控制實體鎖。';
  return {message:card('開鎖裝置選擇',description,controls),visible,chosen};
 }

 async function reply(token,messages){const response=await fetcher('https://api.line.me/v2/bot/message/reply',{method:'POST',headers:{Authorization:'Bearer '+env.LINE_MESSAGING_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({replyToken:token,messages}),signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error('LINE_REPLY_HTTP_'+response.status);}
 async function audit(userId,lineId,kind,result){try{await store.dbCall('db.insert',{table:'LINE_Audit_Logs',primary_key:'audit_id',data:{audit_id:require('node:crypto').randomUUID(),user_id:userId||'',line_user_id:lineId,event_type:'menu_'+kind,result,details:'',created_at:new Date().toISOString()}})}catch(e){console.warn('LINE menu audit unavailable',e.message)}}
 async function handle(event){
  if(event?.source?.type!=='user')return {status:'ignored'};
  const isPostback=event.type==='postback'&&typeof event.postback?.data==='string'&&event.postback.data.startsWith('ikey_unlock_');
  const command=isPostback?'開鎖':event?.type==='message'&&event.message?.type==='text'?String(event.message.text||'').trim():'';
  if(!COMMANDS.has(command))return {status:'ignored'};
  if(!enabled())return {status:'unknown'};
  if(event.deliveryContext?.isRedelivery)return {status:'ignored'};
  const lineId=event.source.userId,token=event.replyToken;
  if(!/^U[0-9a-f]{32}$/i.test(String(lineId||''))||!token)return {status:'ignored'};
  let messages,userId='';
  try{
   const bindingResult=await store.dbCall('db.select',{table:'LINE_Bindings',where:{line_user_id:lineId,status:'bound'},limit:2});
   if(bindingResult.limited||bindingResult.rows.length>1)throw Error('AMBIGUOUS_LINE_BINDING');
   const binding=bindingResult.rows[0];
   if(!binding){
    messages=command==='帳號設定'?[text('iKey｜尚未綁定帳號\n\n1. 前往 iKey 網站並登入。\n2. 開啟「帳號管理」→「綁定 LINE」。\n3. 取得六位數驗證碼（有效五分鐘）。\n4. 將驗證碼傳送到本聊天室。\n\n若網站顯示綁定功能尚未開放，請等待系統管理員啟用。')]:[text('iKey｜請先完成 LINE 帳號綁定，再使用「'+command+'」。\n請在本聊天室輸入「帳號設定」查看說明。')];
   }else{
    userId=binding.user_id;
    const u=(await store.dbCall('db.select',{table:'Gen3_Users',where:{user_id:userId},limit:1})).rows?.[0];
    if(!u||u.account_status!=='active')throw Error('USER_NOT_ACTIVE');
    const admin=['admin','super_admin'].includes(u.global_role);
    if(command==='帳號設定'){
     const info='顯示名稱：'+String(u.display_name||'—').slice(0,80)+'\n登入帳號：'+String(u.username||'—').slice(0,80)+'\n帳號狀態：正常\n系統角色：'+String(u.global_role||'user');
     const buttons=admin?[button('管理員帳號管理',BASE+'/account.html'),button('解除 LINE 綁定',BASE+'/account.html')]:[button('帳號管理',BASE+'/account.html'),button('解除 LINE 綁定',BASE+'/account.html')];
     messages=[card(admin?'管理員帳號設定':'帳號設定',info+'\n解除綁定須於網站重新輸入密碼。',buttons)];
    }else if(command==='排程申請'){
     const own=(await store.dbCall('db.select',{table:'Projects',where:{created_by_user_id:userId},limit:100})).rows||[];
     const membership=(await store.dbCall('db.select',{table:'Project_Access',where:{user_id:userId,entry_type:'member',status:'approved'},limit:100})).rows||[];
     const projects=own.filter(p=>p.status!=='deleted');
     for(const m of membership){
      if(projects.some(p=>p.project_id===m.project_id))continue;
      const p=(await store.dbCall('db.select',{table:'Projects',where:{project_id:m.project_id},limit:1})).rows?.[0];
      if(p&&p.status!=='deleted')projects.push(p);
     }
     const visible=projects.slice(0,8);
     if(!visible.length){
      messages=[card('排程管理','目前尚無已加入的專案，請先建立專案或取得專案成員資格。',[button('我的專案',BASE+'/projects.html')])];
     }else{
      const now=Date.now();
      const cards=[];
      for(const p of visible){
       const isAdmin=p.created_by_user_id===userId||membership.some(m=>m.project_id===p.project_id&&m.role==='admin');
       const records=await store.dbCall('db.select',{table:'Project_Access_Requests',where:isAdmin?{project_id:p.project_id}:{project_id:p.project_id,requester_user_id:userId},limit:100});
       const counts={pending:0,approved:0,rejected:0,cancelled:0};
       for(const x of records.rows||[])if(Object.hasOwn(counts,x.status))counts[x.status]++;
       const active=(records.rows||[]).filter(x=>x.status==='approved'&&Date.parse(x.start_at)<=now&&Date.parse(x.end_at)>now).length;
       const summary='待審核 '+counts.pending+' 筆｜已核准 '+counts.approved+' 筆\n目前有效 '+active+' 筆'+(isAdmin?'\n你可以審核此專案的排程。':'\n你可以查看自己的申請。')+(records.limited?'\n僅顯示前 100 筆統計':'');
       cards.push(card(String(p.project_name||'專案').slice(0,60),summary,[button(isAdmin?'查看與審核排程':'申請與查看排程',BASE+'/project.html?id='+encodeURIComponent(p.project_id)+'&pane=auth')]));
      }
      messages=[{type:'flex',altText:'iKey｜排程管理，共 '+projects.length+' 個專案',contents:{type:'carousel',contents:cards.map(x=>x.contents)}}];
      if(projects.length>visible.length)messages.push(text('尚有 '+(projects.length-visible.length)+' 個專案，請至網站「我的專案」查看。'));
     }
    }else{
     const view=await unlockView(userId);
     if(isPostback){
      const data=event.postback.data,parts=data.split(':'),bits=parts[parts.length-1];
      if(!/^[01]{0,8}$/.test(bits)||bits.length!==view.visible.length){messages=[text('選單已更新，請重新輸入「開鎖」。')];}
      else if(data.startsWith('ikey_unlock_submit:')){const picked=view.visible.filter((d,i)=>bits[i]==='1'&&d.eligible);messages=[text(picked.length?'已選取 '+picked.length+' 台裝置。指令服務尚未啟用，沒有發送任何開鎖訊號。':'尚未選取可開鎖裝置。')];}
      else if(data.startsWith('ikey_unlock_toggle:')){const index=Number(parts[1]);const selected=view.visible.filter((d,i)=>bits[i]==='1'&&d.eligible).map(d=>d.key);if(Number.isInteger(index)&&index>=0&&index<view.visible.length&&view.visible[index].eligible){const key=view.visible[index].key;const at=selected.indexOf(key);if(at>=0)selected.splice(at,1);else selected.push(key);}messages=[(await unlockView(userId,selected)).message];}
      else messages=[view.message];
     }else messages=[view.message];
    }
   }
  }catch(e){console.warn('LINE menu lookup unavailable',e.message);messages=[text('iKey｜目前無法安全確認帳號綁定狀態，請稍後再試。')];}
  try{await reply(token,messages);await audit(userId,lineId,command,'replied');return {status:'handled'}}catch(e){console.warn('LINE menu reply unavailable',e.message);await audit(userId,lineId,command,'unknown');return {status:'unknown'}}
 }
 return {enabled,handle};
}
module.exports={createLineMenuService,COMMANDS};