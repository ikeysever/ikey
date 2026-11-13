'use strict';
const {randomUUID}=require('node:crypto');
module.exports=function mountScheduledAccess(app,{store,requireUser,sameOrigin}){
 const base='/api/projects/:projectId/access-requests';
 const validId=x=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(x||''));
 const fail=(res,s,code,message)=>res.status(s).json({success:false,code,message});
 const guarded=(handler,write=false)=>[requireUser,async(req,res)=>{res.set('Cache-Control','no-store');if(write&&!sameOrigin(req))return fail(res,403,'INVALID_ORIGIN','來源驗證失敗');try{await handler(req,res)}catch(e){console.warn('Scheduled access operation unavailable',e.message);return fail(res,503,'ACCESS_SERVICE_UNAVAILABLE','排程申請服務暫時無法使用')}}];
 async function context(req,res){
  const id=req.params.projectId;if(!validId(id)){fail(res,400,'INVALID_PROJECT','專案格式錯誤');return null}
  const p=(await store.dbCall('db.select',{table:'Projects',where:{project_id:id},limit:1})).rows?.[0];
  if(!p||p.status==='deleted'){fail(res,404,'NOT_FOUND','找不到專案');return null}
  const owner=p.created_by_user_id===req.projectUser.user_id;
  const member=owner?null:(await store.dbCall('db.select',{table:'Project_Access',where:{project_id:id,user_id:req.projectUser.user_id,entry_type:'member',status:'approved'},limit:2})).rows?.[0];
  if(!owner&&!member){fail(res,403,'NOT_MEMBER','沒有專案權限');return null}
  return {owner,admin:owner||member.role==='admin',userId:req.projectUser.user_id,project:p};
 }
 app.get(base,...guarded(async(req,res)=>{
  const ctx=await context(req,res);if(!ctx)return;
  const r=await store.dbCall('db.select',{table:'Project_Access_Requests',where:ctx.admin?{project_id:req.params.projectId}:{project_id:req.params.projectId,requester_user_id:ctx.userId},limit:100});
  return res.json({success:true,can_review:ctx.admin,requests:(r.rows||[]).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).map(x=>({request_id:x.request_id,device_id:x.device_id,reason:x.reason,start_at:x.start_at,end_at:x.end_at,status:x.status,requester_user_id:x.requester_user_id,created_at:x.created_at})),truncated:r.limited===true,unlock_command_ready:false});
 }));
 app.post(base,...guarded(async(req,res)=>{
  const ctx=await context(req,res);if(!ctx)return;
  const deviceId=String(req.body?.device_id||'').toUpperCase(),reason=String(req.body?.reason||'').trim();
  const start=Date.parse(req.body?.start_at),end=Date.parse(req.body?.end_at);
  if(!/^[A-HJ-NP-Z2-9]{8}$/.test(deviceId))return fail(res,400,'INVALID_DEVICE','請選擇有效的裝置');
  if(!reason||reason.length>500)return fail(res,400,'INVALID_REASON','請填寫 1～500 字的申請原因');
  if(!Number.isFinite(start)||!Number.isFinite(end))return fail(res,400,'INVALID_TIME','開始或結束時間格式錯誤');
  if(end<=start)return fail(res,400,'END_BEFORE_START','結束時間必須晚於開始時間');
  if(end<=Date.now())return fail(res,400,'END_IN_PAST','結束時間必須晚於目前時間');
  if(start>Date.now()+90*86400000)return fail(res,400,'START_TOO_FAR','開始時間不得超過 90 天後');
  const binding=(await store.dbCall('db.select',{table:'Project_Devices',where:{project_id:req.params.projectId,device_id:deviceId},limit:1})).rows?.[0];
  if(!binding)return fail(res,404,'DEVICE_NOT_IN_PROJECT','此裝置尚未加入專案');
  const r=await store.dbCall('db.insert',{table:'Project_Access_Requests',primary_key:'request_id',data:{request_id:randomUUID(),project_id:req.params.projectId,device_id:deviceId,requester_user_id:ctx.userId,reason,start_at:new Date(start).toISOString(),end_at:new Date(end).toISOString(),status:'pending'}});
  return res.status(201).json({success:true,request_id:r.record.request_id,status:'pending',unlock_signal_sent:false,message:'排程申請已送出，尚未發送開鎖訊號'});
 },true));
 app.post(base+'/:requestId/admin-approve',...guarded(async(req,res)=>{
  const ctx=await context(req,res);if(!ctx)return;
  if(!ctx.admin)return fail(res,403,'NOT_ADMIN','僅專案管理員可修改並核准排程');
  if(!validId(req.params.requestId))return fail(res,400,'INVALID_REQUEST','申請格式錯誤');
  const existing=(await store.dbCall('db.select',{table:'Project_Access_Requests',where:{project_id:req.params.projectId,request_id:req.params.requestId},limit:1})).rows?.[0];
  if(!existing)return fail(res,404,'NOT_FOUND','找不到申請');
  if(existing.status!=='pending')return fail(res,409,'NOT_PENDING','僅待審核申請可以修改並核准');
  const reason=String(req.body?.reason??existing.reason).trim();
  const deviceId=String(req.body?.device_id??existing.device_id).toUpperCase();
  const start=Date.parse(req.body?.start_at??existing.start_at),end=Date.parse(req.body?.end_at??existing.end_at);
  if(!reason||reason.length>500)return fail(res,400,'INVALID_REASON','原因必須為 1～500 字');
  if(!/^[A-HJ-NP-Z2-9]{8}$/.test(deviceId))return fail(res,400,'INVALID_DEVICE','裝置編號格式錯誤');
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end<=Date.now())return fail(res,400,'INVALID_PERIOD','結束時間須晚於開始時間及目前時間');
  const binding=(await store.dbCall('db.select',{table:'Project_Devices',where:{project_id:req.params.projectId,device_id:deviceId},limit:1})).rows?.[0];
  if(!binding)return fail(res,404,'DEVICE_NOT_IN_PROJECT','裝置不屬於此專案');
  const result=await store.dbCall('db.update',{table:'Project_Access_Requests',where:{project_id:req.params.projectId,request_id:req.params.requestId,status:'pending'},data:{reason,device_id:deviceId,start_at:new Date(start).toISOString(),end_at:new Date(end).toISOString(),status:'approved',reviewed_by:ctx.userId,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()}});
  if(result.count!==1)return fail(res,409,'STATE_CHANGED','申請狀態已改變');
  return res.json({success:true,status:'approved',unlock_signal_sent:false,message:'管理員已修改申請參數並核准，尚未發送開鎖訊號'});
 },true));
 app.post(base+'/:requestId/review',...guarded(async(req,res)=>{
  const ctx=await context(req,res);if(!ctx)return;
  if(!ctx.admin)return fail(res,403,'NOT_ADMIN','僅管理員可審核');
  if(!validId(req.params.requestId)||!['approved','rejected'].includes(req.body?.decision))return fail(res,400,'INVALID_REVIEW','審核資料錯誤');
  const r=await store.dbCall('db.update',{table:'Project_Access_Requests',where:{request_id:req.params.requestId,project_id:req.params.projectId,status:'pending'},data:{status:req.body.decision,reviewed_by:ctx.userId,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()}});
  if(r.count!==1)return fail(res,409,'ALREADY_REVIEWED','申請已處理或不存在');
  return res.json({success:true,status:req.body.decision,unlock_signal_sent:false,message:'審核已儲存；尚未發送開鎖訊號'});
 },true));
 app.get('/api/projects/:projectId/unlock-eligibility',...guarded(async(req,res)=>{
  const ctx=await context(req,res);if(!ctx)return;
  const devices=await store.dbCall('db.select',{table:'Project_Devices',where:{project_id:req.params.projectId},limit:100});
  const requests=ctx.admin?{rows:[],limited:false}:await store.dbCall('db.select',{table:'Project_Access_Requests',where:{project_id:req.params.projectId,requester_user_id:ctx.userId,status:'approved'},limit:100});
  const now=Date.now();
  const rows=(devices.rows||[]).map(d=>{
   const valid=(requests.rows||[]).filter(a=>a.device_id===d.device_id&&Date.parse(a.start_at)<=now&&Date.parse(a.end_at)>now);
   return {device_id:d.device_id,eligible:ctx.admin||valid.length>0,reason:ctx.admin?'PROJECT_ADMIN':valid.length?'APPROVED_SCHEDULE':'NO_ACTIVE_APPROVED_SCHEDULE',schedule_id:valid.length?valid[0].request_id:null,command_ready:false};
  });
  return res.json({success:true,devices:rows,truncated:Boolean(devices.limited||requests.limited),unlock_signal_sent:false,command_ready:false});
 }));
 app.post(base+'/:requestId/cancel',...guarded(async(req,res)=>{
  const ctx=await context(req,res);if(!ctx)return;
  if(!validId(req.params.requestId))return fail(res,400,'INVALID_REQUEST','申請格式錯誤');
  const existing=(await store.dbCall('db.select',{table:'Project_Access_Requests',where:{project_id:req.params.projectId,request_id:req.params.requestId},limit:1})).rows?.[0];
  if(!existing)return fail(res,404,'NOT_FOUND','找不到申請');
  if(!ctx.admin&&existing.requester_user_id!==ctx.userId)return fail(res,403,'NOT_AUTHORIZED','沒有撤銷權限');
  if(!['pending','approved'].includes(existing.status))return fail(res,409,'NOT_CANCELLABLE','申請已無法撤銷');
  const result=await store.dbCall('db.update',{table:'Project_Access_Requests',where:{project_id:req.params.projectId,request_id:req.params.requestId,status:existing.status},data:{status:'cancelled',updated_at:new Date().toISOString()}});
  if(result.count!==1)return fail(res,409,'STATE_CHANGED','申請狀態已變更');
  return res.json({success:true,status:'cancelled',unlock_signal_sent:false,message:'排程已撤銷，不再授權新的開鎖請求'});
 },true));
};