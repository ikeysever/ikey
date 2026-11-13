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
  if(!/^[A-HJ-NP-Z2-9]{8}$/.test(deviceId)||!reason||reason.length>500||!Number.isFinite(start)||!Number.isFinite(end)||end<=start||start<Date.now()-60000||end-start>7*86400000||start>Date.now()+90*86400000)return fail(res,400,'INVALID_REQUEST','請填寫裝置、原因及有效時段（最長 7 天、90 天內）');
  const binding=(await store.dbCall('db.select',{table:'Project_Devices',where:{project_id:req.params.projectId,device_id:deviceId},limit:1})).rows?.[0];
  if(!binding)return fail(res,404,'DEVICE_NOT_IN_PROJECT','此裝置尚未加入專案');
  const r=await store.dbCall('db.insert',{table:'Project_Access_Requests',primary_key:'request_id',data:{request_id:randomUUID(),project_id:req.params.projectId,device_id:deviceId,requester_user_id:ctx.userId,reason,start_at:new Date(start).toISOString(),end_at:new Date(end).toISOString(),status:'pending'}});
  return res.status(201).json({success:true,request_id:r.record.request_id,status:'pending',unlock_signal_sent:false,message:'排程申請已送出，尚未發送開鎖訊號'});
 },true));
 app.post(base+'/:requestId/review',...guarded(async(req,res)=>{
  const ctx=await context(req,res);if(!ctx)return;
  if(!ctx.admin)return fail(res,403,'NOT_ADMIN','僅管理員可審核');
  if(!validId(req.params.requestId)||!['approved','rejected'].includes(req.body?.decision))return fail(res,400,'INVALID_REVIEW','審核資料錯誤');
  const r=await store.dbCall('db.update',{table:'Project_Access_Requests',where:{request_id:req.params.requestId,project_id:req.params.projectId,status:'pending'},data:{status:req.body.decision,reviewed_by:ctx.userId,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()}});
  if(r.count!==1)return fail(res,409,'ALREADY_REVIEWED','申請已處理或不存在');
  return res.json({success:true,status:req.body.decision,unlock_signal_sent:false,message:'審核已儲存；尚未發送開鎖訊號'});
 },true));
};