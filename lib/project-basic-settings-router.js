'use strict';
const express=require('express');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
module.exports=function mountProjectBasicSettings(app,{store,requireUser,sameOrigin}){
 const router=express.Router();
 async function context(id,userId){
  const result=await store.dbCall('db.select',{table:'Projects',where:{project_id:id},limit:1});
  const project=(result.rows||[]).find(p=>p.project_id===id&&p.status!=='deleted');
  if(!project)return null;
  const owner=project.created_by_user_id===userId;
  if(owner)return {project,canManage:true};
  const access=await store.dbCall('db.select',{table:'Project_Access',where:{project_id:id,user_id:userId,entry_type:'member',status:'approved'},limit:2});
  const member=(access.rows||[]).find(x=>x.role==='admin');
  return {project,canManage:Boolean(member)};
 }
 router.get('/:projectId/basic-settings',requireUser,async(req,res)=>{
  res.set('Cache-Control','no-store');
  if(!UUID.test(req.params.projectId))return res.status(400).json({success:false,code:'INVALID_PROJECT_ID'});
  try{
   const ctx=await context(req.params.projectId,req.projectUser.user_id);
   if(!ctx)return res.status(404).json({success:false,code:'PROJECT_NOT_FOUND'});
   if(!ctx.canManage)return res.status(403).json({success:false,code:'NOT_PROJECT_ADMIN'});
   const p=ctx.project;
   return res.json({success:true,project:{project_id:p.project_id,project_name:p.project_name,description:p.description||'',status:p.status,updated_at:p.updated_at}});
  }catch(e){console.warn('Basic settings read unavailable',e.name);return res.status(503).json({success:false,code:'BASIC_SETTINGS_UNAVAILABLE'});}
 });
 router.patch('/:projectId/basic-settings',requireUser,async(req,res)=>{
  res.set('Cache-Control','no-store');
  if(!sameOrigin(req))return res.status(403).json({success:false,code:'INVALID_ORIGIN'});
  if(!UUID.test(req.params.projectId))return res.status(400).json({success:false,code:'INVALID_PROJECT_ID'});
  const body=req.body;
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join(',')!=='description,project_name')
   return res.status(400).json({success:false,code:'INVALID_FIELDS'});
  const name=typeof body.project_name==='string'?body.project_name.trim():'';
  const description=typeof body.description==='string'?body.description.trim():null;
  if(!name||name.length>80||/[\x00-\x1f]/.test(name)||description===null||description.length>1000||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(description))
   return res.status(400).json({success:false,code:'INVALID_BASIC_SETTINGS',message:'專案名稱需為 1～80 字，說明最多 1000 字'});
  try{
   const ctx=await context(req.params.projectId,req.projectUser.user_id);
   if(!ctx)return res.status(404).json({success:false,code:'PROJECT_NOT_FOUND'});
   if(!ctx.canManage)return res.status(403).json({success:false,code:'NOT_PROJECT_ADMIN'});
   const updated_at=new Date().toISOString();
   const result=await store.dbCall('db.update',{table:'Projects',where:{project_id:req.params.projectId},data:{project_name:name,description,updated_at}});
   if(result?.count!==1)return res.status(503).json({success:false,code:'UPDATE_UNCONFIRMED',message:'無法確認設定已儲存，請重新讀取'});
   const verify=await store.dbCall('db.select',{table:'Projects',where:{project_id:req.params.projectId},limit:1});
   const p=(verify.rows||[]).find(p=>p.project_id===req.params.projectId);
   if(!p||p.project_name!==name||String(p.description||'')!==description)return res.status(503).json({success:false,code:'VERIFY_FAILED',message:'設定驗證未通過，請重新讀取'});
   return res.json({success:true,project:{project_id:p.project_id,project_name:p.project_name,description:p.description||'',status:p.status,updated_at:p.updated_at}});
  }catch(e){console.warn('Basic settings update unavailable',e.name);return res.status(503).json({success:false,code:'BASIC_SETTINGS_SAVE_FAILED',message:'儲存狀態無法確認，請重新讀取後再操作'});}
 });
 app.use('/api/projects',router);
};
