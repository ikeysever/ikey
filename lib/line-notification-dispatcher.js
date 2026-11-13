'use strict';
const ENABLED_EVENTS=new Set(['approval_pending','approval_granted']);
function createLineNotificationDispatcher(store,env=process.env,fetcher=globalThis.fetch){
 const ready=()=>Boolean(env.LINE_MESSAGING_ACCESS_TOKEN&&store&&typeof store.dbCall==='function');
 async function preference(userId,type){
  const r=await store.dbCall('db.select',{table:'LINE_Notification_Preferences',where:{user_id:userId,notification_type:type},limit:2});
  return !r.limited&&r.rows?.length===1&&r.rows[0].enabled==='true';
 }
 async function recipient(userId){
  const r=await store.dbCall('db.select',{table:'LINE_Bindings',where:{user_id:userId,status:'bound'},limit:2});
  return !r.limited&&r.rows?.length===1&&/^U[0-9a-f]{32}$/i.test(r.rows[0].line_user_id||'')?r.rows[0].line_user_id:null;
 }
 async function dispatch({type,projectId,userId,deviceId}){
  if(!ready()||!ENABLED_EVENTS.has(type)||!projectId||!userId)return {status:'not_configured'};
  const project=(await store.dbCall('db.select',{table:'Projects',where:{project_id:projectId},limit:1})).rows?.[0];
  if(!project||project.status==='deleted')return {status:'invalid_project'};
  const settings=(await store.dbCall('db.select',{table:'Project_Alert_Settings',where:{project_id:projectId},limit:100})).rows||[];
  const global=settings.find(x=>x.device_id===null)?.settings||{};
  const specific=settings.find(x=>x.device_id===deviceId)?.settings||{};
  if({...global,...specific}[type]!==true)return {status:'project_disabled'};
  const recipients=[];
  if(type==='approval_granted')recipients.push(userId);
  else{
   recipients.push(project.created_by_user_id);
   const admins=(await store.dbCall('db.select',{table:'Project_Access',where:{project_id:projectId,entry_type:'member',status:'approved',role:'admin'},limit:100})).rows||[];
   recipients.push(...admins.map(x=>x.user_id));
  }
  const results=[];
  for(const id of [...new Set(recipients.filter(Boolean))]){
   if(!await preference(id,type)){results.push({status:'preference_disabled'});continue}
   const to=await recipient(id);
   if(!to){results.push({status:'not_bound'});continue}
   const text=type==='approval_granted'?'iKey 3.1｜排程審核通過':'iKey 3.1｜有新的排程申請等待審核';
   const body={to,messages:[{type:'text',text:text+'\n專案：'+String(project.project_name||'未命名').slice(0,80)+'\n裝置：'+String(deviceId||'未指定').slice(0,30)}]};
   try{
    const response=await fetcher('https://api.line.me/v2/bot/message/push',{method:'POST',headers:{Authorization:'Bearer '+env.LINE_MESSAGING_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(7000)});
    results.push({status:response.ok?'accepted':'rejected',http_status:response.status});
   }catch{results.push({status:'unknown'})}
  }
  return {status:'processed',results};
 }
 return {ready,dispatch};
}
module.exports={createLineNotificationDispatcher};
