'use strict';
const {randomBytes,createHash,randomUUID}=require('node:crypto');
const validId=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s||''));
const digest=s=>createHash('sha256').update(s).digest('hex');
module.exports=function mountProjectMembers(app,{store,requireUser,sameOrigin}){
 const api='/api/projects';
 const now=()=>new Date().toISOString();
 const fail=(res,status,message)=>res.status(status).json({success:false,message});
 async function projectFor(id){const r=await store.dbCall('db.select',{table:'Projects',where:{project_id:id},limit:1});return r.rows?.find(x=>x.project_id===id&&x.status!=='deleted')||null;}
 async function accessFor(id,userId){const r=await store.dbCall('db.select',{table:'Project_Access',where:{project_id:id,user_id:userId,entry_type:'member'},limit:2});return r.rows?.find(x=>x.status==='approved')||null;}
 async function check(req,res,ownerOnly=false){
  if(!validId(req.params.projectId)){fail(res,400,'專案 ID 格式錯誤');return null;}
  const project=await projectFor(req.params.projectId);
  if(!project){fail(res,404,'找不到專案');return null;}
  const owner=project.created_by_user_id===req.projectUser.user_id;
  if(!owner&&(ownerOnly||!await accessFor(project.project_id,req.projectUser.user_id))){fail(res,403,'沒有專案權限');return null;}
  return {project,owner};
 }
 const guard=(fn,write=false)=>[requireUser,async(req,res)=>{
  res.set('Cache-Control','no-store');
  if(write&&!sameOrigin(req))return fail(res,403,'來源驗證失敗');
  try{await fn(req,res);}catch(e){console.warn('Project membership operation unavailable',e.message);return fail(res,503,'成員服務暫時無法完成操作');}
 }];
 app.get(api+'/:projectId/members',...guard(async(req,res)=>{
  const ctx=await check(req,res);if(!ctx)return;
  const id=ctx.project.project_id;
  const rows=(await store.dbCall('db.select',{table:'Project_Access',where:{project_id:id,entry_type:'member'},limit:100})).rows||[];
  const users=await store.dbCall('db.select',{table:'Gen3_Users',where:{user_id:ctx.project.created_by_user_id},limit:1});
  const owner=users.rows?.[0];
  const members=[{user_id:ctx.project.created_by_user_id,username:owner?.username||'—',display_name:owner?.display_name||'—',account_status:owner?.account_status||'unknown',role:'owner',status:'approved'}];
  for(const entry of rows){if(entry.user_id===ctx.project.created_by_user_id||entry.status!=='approved')continue;
   const u=(await store.dbCall('db.select',{table:'Gen3_Users',where:{user_id:entry.user_id},limit:1})).rows?.[0];
   members.push({user_id:entry.user_id,username:u?.username||'—',display_name:u?.display_name||'—',account_status:u?.account_status||'unknown',role:entry.role==='admin'?'admin':'member',status:entry.status});}
  const pending=[];
  if(ctx.owner){for(const entry of rows.filter(x=>x.status==='pending')){
   const u=(await store.dbCall('db.select',{table:'Gen3_Users',where:{user_id:entry.user_id},limit:1})).rows?.[0];
   pending.push({entry_id:entry.entry_id,user_id:entry.user_id,username:u?.username||'—',display_name:u?.display_name||'—',account_status:u?.account_status||'unknown'});}}
  return res.json({success:true,members,pending,can_manage:ctx.owner,membership_inventory_complete:rows.length<100});
 }));
 app.post(api+'/:projectId/invitations',...guard(async(req,res)=>{
  const ctx=await check(req,res,true);if(!ctx)return;
  const id=ctx.project.project_id;
  const existing=(await store.dbCall('db.select',{table:'Project_Access',where:{project_id:id,entry_type:'invite'},limit:100})).rows||[];
  if(existing.length>=100)return fail(res,409,'邀請碼數量已達上限');
  const code=randomBytes(18).toString('base64url');const timestamp=now();
  const record={entry_id:randomUUID(),project_id:id,entry_type:'invite',user_id:null,role:'member',status:'active',invite_hash:digest(code),join_policy:ctx.project.authorization_method==='self_registration'?'automatic':'approval',created_at:timestamp,updated_at:timestamp,reviewed_by:req.projectUser.user_id};
  const saved=await store.dbCall('db.insert',{table:'Project_Access',primary_key:'entry_id',data:record});
  if(!saved.inserted)return fail(res,503,'無法核發邀請碼');
  return res.status(201).json({success:true,invite_code:code,join_policy:record.join_policy});
 },true));
 app.post('/api/projects/join',...guard(async(req,res)=>{
  const code=typeof req.body?.invite_code==='string'?req.body.invite_code:'';
  if(!/^[A-Za-z0-9_-]{24}$/.test(code))return fail(res,400,'邀請碼格式錯誤');
  const matches=(await store.dbCall('db.select',{table:'Project_Access',where:{invite_hash:digest(code),entry_type:'invite'},limit:2})).rows||[];
  const invite=matches.find(x=>x.status==='active');
  if(!invite)return fail(res,404,'邀請碼無效');
  const project=await projectFor(invite.project_id);
  if(!project)return fail(res,404,'專案已不存在');
  if(project.created_by_user_id===req.projectUser.user_id)return fail(res,409,'你已是專案建立者');
  const old=(await store.dbCall('db.select',{table:'Project_Access',where:{project_id:project.project_id,user_id:req.projectUser.user_id,entry_type:'member'},limit:2})).rows||[];
  if(old.some(x=>x.status==='approved'))return fail(res,409,'你已加入此專案');
  if(old.some(x=>x.status==='pending'))return fail(res,409,'你已提出申請，請等待審核');
  const status=invite.join_policy==='automatic'?'approved':'pending';
  const timestamp=now();
  if(old.length){
   const updated=await store.dbCall('db.update',{table:'Project_Access',where:{entry_id:old[0].entry_id,status:old[0].status},data:{status,role:'member',updated_at:timestamp,reviewed_by:''}});
   if(updated.count!==1)return fail(res,409,'申請狀態已變更，請重新整理');
  }else{
   try{await store.dbCall('db.insert',{table:'Project_Access',primary_key:'entry_id',data:{entry_id:randomUUID(),project_id:project.project_id,entry_type:'member',user_id:req.projectUser.user_id,role:'member',status,invite_hash:null,join_policy:invite.join_policy,created_at:timestamp,updated_at:timestamp,reviewed_by:''}});}
   catch(e){if(e.message==='SUPABASE_DUPLICATE_KEY')return fail(res,409,'你已申請加入此專案');throw e;}
  }
  return res.status(201).json({success:true,project_id:project.project_id,project_name:project.project_name,status});
 },true));
 app.post(api+'/:projectId/members/:entryId/review',...guard(async(req,res)=>{
  const ctx=await check(req,res,true);if(!ctx)return;
  if(!validId(req.params.entryId)||!['approved','rejected'].includes(req.body?.decision))return fail(res,400,'審核資料不正確');
  const updated=await store.dbCall('db.update',{table:'Project_Access',where:{entry_id:req.params.entryId,project_id:ctx.project.project_id,entry_type:'member',status:'pending'},data:{status:req.body.decision,reviewed_by:req.projectUser.user_id,updated_at:now()}});
  if(updated.count!==1)return fail(res,409,'此申請已處理或不存在');
  return res.json({success:true,status:req.body.decision});
 },true));
 app.post(api+'/:projectId/members/:userId/role',...guard(async(req,res)=>{
  const ctx=await check(req,res,true);if(!ctx)return;
  if(req.params.userId===ctx.project.created_by_user_id||!['admin','member'].includes(req.body?.role))return fail(res,400,'無法修改此成員角色');
  const member=await accessFor(ctx.project.project_id,req.params.userId);
  if(!member)return fail(res,404,'找不到已核准成員');
  const updated=await store.dbCall('db.update',{table:'Project_Access',where:{entry_id:member.entry_id,project_id:ctx.project.project_id,entry_type:'member',status:'approved',role:member.role},data:{role:req.body.role,reviewed_by:req.projectUser.user_id,updated_at:now()}});
  if(updated.count!==1)return fail(res,409,'角色狀態已變更');
  return res.json({success:true,role:req.body.role});
 },true));
};
