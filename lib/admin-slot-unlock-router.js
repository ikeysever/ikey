'use strict';
const express=require('express');
module.exports=function mountAdminSlotUnlock(app,{store,requireProjectUser,sameProjectOrigin}){
 const router=express.Router();
 const validCode=x=>/^[A-Z0-9_-]{4,40}$/.test(x);
 const validDevice=x=>/^[A-HJ-NP-Z2-9]{8}$/.test(x);
 async function resolve(userId,code){
  const found=await store.dbCall('db.select',{table:'Project_Slot_Codes',where:{slot_code:code,is_active:true},limit:2});
  if(found.limited)throw Error('AMBIGUOUS_SLOT');
  const slot=found.rows?.[0];
  if(!slot)return {error:'SLOT_NOT_FOUND',message:'找不到已登錄的格位編號'};
  const project=(await store.dbCall('db.select',{table:'Projects',where:{project_id:slot.project_id},limit:1})).rows?.[0];
  if(!project||project.status==='deleted')return {error:'PROJECT_NOT_FOUND',message:'格位所屬專案不存在'};
  const owner=project.created_by_user_id===userId;
  const member=owner?null:(await store.dbCall('db.select',{table:'Project_Access',where:{project_id:slot.project_id,user_id:userId,entry_type:'member',status:'approved'},limit:2})).rows?.[0];
  if(!owner&&member?.role!=='admin')return {error:'NOT_PROJECT_ADMIN',message:'只有格位所屬專案管理員可免排程操作'};
  if(!validDevice(slot.device_id)||!Number.isSafeInteger(slot.slot_number)||slot.slot_number<1)return {error:'INVALID_SLOT_MAPPING',message:'格位對應資料不完整'};
  const binding=(await store.dbCall('db.select',{table:'Project_Devices',where:{project_id:slot.project_id,device_id:slot.device_id},limit:2})).rows?.[0];
  if(!binding)return {error:'DEVICE_NOT_BOUND',message:'格位所屬 iBOX 未綁定至專案'};
  return {slot_code:code,project_id:slot.project_id,project_name:project.project_name,device_id:slot.device_id,slot_number:slot.slot_number,admin_authorized:true};
 }
 router.get('/api/admin/slots',requireProjectUser,async(req,res)=>{
  res.set('Cache-Control','no-store');
  try{
   const projects=await store.dbCall('db.select',{table:'Projects',limit:100});
   if(projects.limited)return res.status(503).json({success:false,message:'專案數量超過查詢上限'});
   const slots=[];
   for(const p of projects.rows||[]){
    if(p.status==='deleted')continue;
    const owner=p.created_by_user_id===req.projectUser.user_id;
    const member=owner?null:(await store.dbCall('db.select',{table:'Project_Access',where:{project_id:p.project_id,user_id:req.projectUser.user_id,entry_type:'member',status:'approved'},limit:2})).rows?.[0];
    if(!owner&&member?.role!=='admin')continue;
    const result=await store.dbCall('db.select',{table:'Project_Slot_Codes',where:{project_id:p.project_id},limit:100});
    if(result.limited)return res.status(503).json({success:false,message:'格位資料超過查詢上限'});
    for(const s of result.rows||[])slots.push({slot_code:s.slot_code,project_id:p.project_id,project_name:p.project_name,device_id:s.device_id,slot_number:s.slot_number,is_active:s.is_active});
   }
   return res.json({success:true,slots});
  }catch(e){console.warn('Admin slots list unavailable',e.message);return res.status(503).json({success:false,message:'無法查詢格位清單'})}
 });
 router.post('/api/admin/slots/register',requireProjectUser,async(req,res)=>{
  res.set('Cache-Control','no-store');
  if(!sameProjectOrigin(req))return res.status(403).json({success:false,code:'INVALID_ORIGIN'});
  const slot_code=String(req.body?.slot_code||'').trim().toUpperCase();
  const project_id=String(req.body?.project_id||''),device_id=String(req.body?.device_id||'').toUpperCase();
  const slot_number=Number(req.body?.slot_number);
  if(!validCode(slot_code)||!validDevice(device_id)||!Number.isSafeInteger(slot_number)||slot_number<1)return res.status(400).json({success:false,code:'INVALID_SLOT',message:'格位編號、裝置或格位序號格式錯誤'});
  try{
   const project=(await store.dbCall('db.select',{table:'Projects',where:{project_id},limit:1})).rows?.[0];
   if(!project||project.status==='deleted')return res.status(404).json({success:false,message:'專案不存在'});
   const owner=project.created_by_user_id===req.projectUser.user_id;
   const member=owner?null:(await store.dbCall('db.select',{table:'Project_Access',where:{project_id,user_id:req.projectUser.user_id,entry_type:'member',status:'approved'},limit:2})).rows?.[0];
   if(!owner&&member?.role!=='admin')return res.status(403).json({success:false,message:'需要專案管理員權限'});
   const bound=(await store.dbCall('db.select',{table:'Project_Devices',where:{project_id,device_id},limit:2})).rows?.[0];
   if(!bound)return res.status(404).json({success:false,message:'iBOX 尚未綁定此專案'});
   const existing=await store.dbCall('db.select',{table:'Project_Slot_Codes',where:{slot_code},limit:1});
   if(existing.rows?.length)return res.status(409).json({success:false,message:'格位編號已被使用'});
   const result=await store.dbCall('db.insert',{table:'Project_Slot_Codes',primary_key:'slot_code',data:{slot_code,project_id,device_id,slot_number,is_active:true}});
   return res.status(201).json({success:true,slot:result.record,unlock_signal_sent:false});
  }catch(e){if(e.message==='SUPABASE_DUPLICATE_KEY')return res.status(409).json({success:false,message:'格位編號或同裝置格位序號重複'});console.warn('Slot registration unavailable',e.message);return res.status(503).json({success:false,message:'格位登錄失敗'})}
 });
 router.post('/api/admin/slots/deactivate',requireProjectUser,async(req,res)=>{
  res.set('Cache-Control','no-store');
  if(!sameProjectOrigin(req))return res.status(403).json({success:false,code:'INVALID_ORIGIN'});
  const code=String(req.body?.slot_code||'').trim().toUpperCase();
  if(!validCode(code))return res.status(400).json({success:false,message:'格位編號錯誤'});
  try{
   const slot=(await store.dbCall('db.select',{table:'Project_Slot_Codes',where:{slot_code:code},limit:1})).rows?.[0];
   if(!slot)return res.status(404).json({success:false,message:'格位不存在'});
   const project=(await store.dbCall('db.select',{table:'Projects',where:{project_id:slot.project_id},limit:1})).rows?.[0];
   if(!project||project.status==='deleted')return res.status(404).json({success:false,message:'專案不存在'});
   const owner=project.created_by_user_id===req.projectUser.user_id;
   const member=owner?null:(await store.dbCall('db.select',{table:'Project_Access',where:{project_id:slot.project_id,user_id:req.projectUser.user_id,entry_type:'member',status:'approved'},limit:2})).rows?.[0];
   if(!owner&&member?.role!=='admin')return res.status(403).json({success:false,message:'需要專案管理員權限'});
   const result=await store.dbCall('db.update',{table:'Project_Slot_Codes',where:{slot_code:code,project_id:slot.project_id},data:{is_active:false,updated_at:new Date().toISOString()}});
   if(result.count!==1)return res.status(409).json({success:false,message:'格位狀態更新失敗'});
   return res.json({success:true,slot_code:code,is_active:false});
  }catch(e){console.warn('Slot deactivation unavailable',e.message);return res.status(503).json({success:false,message:'停用格位失敗'})}
 });
 router.post('/api/admin/slots/resolve',requireProjectUser,async(req,res)=>{
  res.set('Cache-Control','no-store');
  if(!sameProjectOrigin(req))return res.status(403).json({success:false,code:'INVALID_ORIGIN'});
  const code=String(req.body?.slot_code||'').trim().toUpperCase();
  if(!validCode(code))return res.status(400).json({success:false,code:'INVALID_SLOT_CODE',message:'格位編號需為 4～40 位英數字、底線或連字號'});
  try{
   const result=await resolve(req.projectUser.user_id,code);
   if(result.error)return res.status(result.error==='NOT_PROJECT_ADMIN'?403:404).json({success:false,code:result.error,message:result.message});
   return res.json({success:true,...result,control_ready:false,unlock_signal_sent:false});
  }catch(e){console.warn('Slot resolve failed',e.message);return res.status(503).json({success:false,code:'SLOT_LOOKUP_UNAVAILABLE',message:'格位資料暫時無法驗證'});}
 });
 router.post('/api/admin/slots/unlock',requireProjectUser,async(req,res)=>{
  res.set('Cache-Control','no-store');
  if(!sameProjectOrigin(req))return res.status(403).json({success:false,code:'INVALID_ORIGIN'});
  const code=String(req.body?.slot_code||'').trim().toUpperCase();
  if(!validCode(code))return res.status(400).json({success:false,code:'INVALID_SLOT_CODE',message:'格位編號格式錯誤'});
  try{
   const result=await resolve(req.projectUser.user_id,code);
   if(result.error)return res.status(result.error==='NOT_PROJECT_ADMIN'?403:404).json({success:false,code:result.error,message:result.message});
   return res.status(503).json({success:false,code:'UNLOCK_EXECUTION_NOT_READY',message:'管理員權限及格位對應已驗證，但指令派送與裝置執行回報尚未啟用；未發送開鎖訊號',slot_code:code,project_id:result.project_id,device_id:result.device_id,slot_number:result.slot_number,unlock_signal_sent:false,execution_verified:false});
  }catch(e){console.warn('Admin slot unlock validation failed',e.message);return res.status(503).json({success:false,code:'SLOT_LOOKUP_UNAVAILABLE',message:'無法確認格位權限，未發送開鎖訊號'});}
 });
 app.use(router);
};
