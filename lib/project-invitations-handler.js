'use strict';
const {randomBytes,randomUUID,createHash}=require('node:crypto');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INVITE_TABLE='Project_Invitations';
function sha256(value){return createHash('sha256').update(value).digest('hex');}
function invitationSchema(columns){
 return Array.isArray(columns)&&['invitation_id','project_id','created_by_user_id','token_hash','role','expires_at','status','created_at'].every(k=>columns.includes(k));
}
function createProjectInvitationHandler(store,{uuid=randomUUID,now=()=>new Date(),random=()=>randomBytes(24)}={}){
 return async(req,res)=>{
  res.set('Cache-Control','no-store');
  const projectId=String(req.params.projectId||''),actor=String(req.projectUser?.user_id||'');
  if(!UUID.test(projectId)||!UUID.test(actor))return res.status(400).json({success:false,code:'INVALID_INVITATION_CONTEXT'});
  if(req.body?.role!=='member')return res.status(400).json({success:false,code:'INVALID_INVITATION_ROLE'});
  try{
   const projectResult=await store.dbCall('db.select',{table:'Projects',where:{project_id:projectId},limit:1});
   if(!Array.isArray(projectResult?.rows)||projectResult.limited||projectResult.rows.length>1)return res.status(503).json({success:false,code:'PROJECT_UNVERIFIED'});
   const project=projectResult.rows[0];
   if(!project||project.project_id!==projectId||project.status==='deleted')return res.status(404).json({success:false,code:'PROJECT_NOT_FOUND'});
   if(project.created_by_user_id!==actor)return res.status(403).json({success:false,code:'NOT_PROJECT_OWNER'});
   const schema=await store.dbCall('db.schema',{table:INVITE_TABLE});
   if(!invitationSchema(schema?.columns))return res.status(503).json({success:false,code:'INVITATION_SCHEMA_NOT_READY'});
   const token=random().toString('base64url');
   const createdAt=now(),expiresAt=new Date(createdAt.getTime()+24*60*60*1000);
   const record={invitation_id:uuid(),project_id:projectId,created_by_user_id:actor,token_hash:sha256(token),role:'member',expires_at:expiresAt.toISOString(),status:'pending',created_at:createdAt.toISOString()};
   const result=await store.dbCall('db.insert',{table:INVITE_TABLE,primary_key:'invitation_id',data:record});
   if(result?.inserted!==true||result.record?.invitation_id!==record.invitation_id||result.record?.token_hash!==record.token_hash)return res.status(503).json({success:false,code:'INVITATION_WRITE_UNVERIFIED'});
   return res.status(201).json({success:true,invitation_id:record.invitation_id,project_id:projectId,role:'member',expires_at:record.expires_at,invitation_token:token});
  }catch(error){console.warn('Project invitation unavailable',error.name||'Error');return res.status(503).json({success:false,code:'INVITATION_UNAVAILABLE'});}
 };
}
module.exports={createProjectInvitationHandler,invitationSchema,sha256};
