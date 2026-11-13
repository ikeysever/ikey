'use strict';
const COMMANDS=new Set(['帳號設定','排程申請','開鎖']);
const BASE='https://ikey.onrender.com';
function createLineMenuService(store,env=process.env,fetcher=globalThis.fetch){
 const enabled=()=>Boolean(env.LINE_MESSAGING_CHANNEL_SECRET&&env.LINE_MESSAGING_ACCESS_TOKEN&&store&&typeof store.dbCall==='function');
 const button=(label,uri)=>({type:'button',style:'secondary',height:'sm',action:{type:'uri',label,uri}});
 const card=(title,description,buttons)=>({type:'flex',altText:'iKey｜'+title,contents:{type:'bubble',size:'mega',body:{type:'box',layout:'vertical',spacing:'md',backgroundColor:'#0b1220',contents:[{type:'text',text:'iKey 3.1',color:'#63d8e8',size:'sm',weight:'bold'},{type:'text',text:title,color:'#f8fafc',size:'xl',weight:'bold',wrap:true},{type:'text',text:description,color:'#a6b2c5',size:'sm',wrap:true}]},footer:{type:'box',layout:'vertical',spacing:'sm',contents:buttons}}});
 const text=t=>({type:'text',text:t});
 async function reply(token,messages){const response=await fetcher('https://api.line.me/v2/bot/message/reply',{method:'POST',headers:{Authorization:'Bearer '+env.LINE_MESSAGING_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({replyToken:token,messages}),signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error('LINE_REPLY_HTTP_'+response.status);}
 async function audit(userId,lineId,kind,result){try{await store.dbCall('db.insert',{table:'LINE_Audit_Logs',primary_key:'audit_id',data:{audit_id:require('node:crypto').randomUUID(),user_id:userId||'',line_user_id:lineId,event_type:'menu_'+kind,result,details:'',created_at:new Date().toISOString()}})}catch(e){console.warn('LINE menu audit unavailable',e.message)}}
 async function handle(event){
  if(event?.type!=='message'||event.message?.type!=='text'||event.source?.type!=='user')return {status:'ignored'};
  const command=String(event.message.text||'').trim();if(!COMMANDS.has(command))return {status:'ignored'};
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
     messages=[card('排程申請','請在網站選擇專案、裝置、使用原因及時段。提交後由管理員審核。',[button('前往我的專案',BASE+'/projects.html')])];
    }else{
     messages=[card('開鎖','目前尚未啟用實體裝置開鎖指令。未發送開鎖訊號。',[button('前往我的專案',BASE+'/projects.html')])];
    }
   }
  }catch(e){console.warn('LINE menu lookup unavailable',e.message);messages=[text('iKey｜目前無法安全確認帳號綁定狀態，請稍後再試。')];}
  try{await reply(token,messages);await audit(userId,lineId,command,'replied');return {status:'handled'}}catch(e){console.warn('LINE menu reply unavailable',e.message);await audit(userId,lineId,command,'unknown');return {status:'unknown'}}
 }
 return {enabled,handle};
}
module.exports={createLineMenuService,COMMANDS};