'use strict';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUIRED=['invitation_id','project_id','created_by_user_id','token_hash','role','expires_at','status','created_at'];
function createInvitationListHandler(store){
 return async(req,res)=>{
  res.set('Cache-Control','no-store');
  const projectId=String(req.params.projectId||''),actor=String(req.projectUser?.user_id||'');
  if(!UUID.test(projectId)||!UUID.test(actor))return res.status(400).json({success:false,code:'INVALID_INVITATION_CONTEXT'});
  try{
   const result=await store.dbCall('db.select',{table:'Projects',where:{project_id:projectId},limit:1});
   if(!Array.isArray(result?.rows)||result.limited||result.rows.length!==1)return res.status(503).json({success:false,code:'PROJECT_UNVERIFIED'});
   const project=result.rows[0];
   if(project.project_id!==projectId||project.status==='deleted')return res.status(404).json({success:false,code:'PROJECT_NOT_FOUND'});
   if(project.created_by_user_id!==actor)return res.status(403).json({success:false,code:'NOT_PROJECT_OWNER'});
   const schema=await store.dbCall('db.schema',{table:'Project_Invitations'});
   if(!Array.isArray(schema?.columns)||!REQUIRED.every(k=>schema.columns.includes(k)))return res.status(503).json({success:false,code:'INVITATION_SCHEMA_NOT_READY'});
   const invitations=await store.dbCall('db.select',{table:'Project_Invitations',where:{project_id:projectId},limit:100});
   if(!Array.isArray(invitations?.rows)||invitations.limited||invitations.rows.length>100)return res.status(503).json({success:false,code:'INVITATION_LIST_UNVERIFIED'});
   const seen=new Set(),output=[];
   for(const row of invitations.rows){
    if(!row||row.project_id!==projectId||row.created_by_user_id!==actor||!UUID.test(String(row.invitation_id||''))||seen.has(row.invitation_id)||!['member'].includes(row.role)||!['pending','revoked','redeemed','expired'].includes(row.status)||!/^([0-9a-f]{64})$/i.test(String(row.token_hash||''))||!Number.isFinite(Date.parse(row.expires_at))||!Number.isFinite(Date.parse(row.created_at)))return res.status(503).json({success:false,code:'INVITATION_LIST_UNVERIFIED'});
    seen.add(row.invitation_id);
    output.push({invitation_id:row.invitation_id,role:row.role,status:row.status,created_at:row.created_at,expires_at:row.expires_at});
   }
   return res.json({success:true,project_id:projectId,invitations:output});
  }catch(error){console.warn('Invitation list unavailable',error.name||'Error');return res.status(503).json({success:false,code:'INVITATION_LIST_UNAVAILABLE'});}
 };
}
module.exports={createInvitationListHandler};
