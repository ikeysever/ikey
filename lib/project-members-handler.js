'use strict';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function createProjectMembersHandler(store){
 return async(req,res)=>{
  res.set('Cache-Control','no-store');
  const projectId=String(req.params.projectId||'');
  if(!uuid.test(projectId))return res.status(400).json({success:false,code:'INVALID_PROJECT_ID'});
  try{
   const result=await store.dbCall('db.select',{table:'Projects',where:{project_id:projectId},limit:1});
   if(!Array.isArray(result?.rows)||result.limited||result.rows.length>1)return res.status(503).json({success:false,code:'MEMBERSHIP_UNVERIFIED'});
   const project=result.rows.find(p=>p.project_id===projectId&&p.status!=='deleted');
   if(!project)return res.status(404).json({success:false,code:'PROJECT_NOT_FOUND'});
   if(project.created_by_user_id!==req.projectUser.user_id)return res.status(403).json({success:false,code:'NOT_PROJECT_OWNER'});
   const ownerId=String(project.created_by_user_id||'');
   if(!uuid.test(ownerId))return res.status(503).json({success:false,code:'MEMBERSHIP_UNVERIFIED'});
   const base=[{user_id:ownerId,role:'owner',source:'project_creator'}];
   let schema;
   try{schema=await store.dbCall('db.schema',{table:'Project_Memberships'});}
   catch{return res.json({success:true,project_id:projectId,membership_inventory_complete:false,members:base});}
   const required=['membership_id','project_id','user_id','role','status','created_at'];
   if(!Array.isArray(schema?.columns)||required.some(k=>!schema.columns.includes(k)))
    return res.status(503).json({success:false,code:'MEMBERSHIP_SCHEMA_UNVERIFIED'});
   const members=await store.dbCall('db.select',{table:'Project_Memberships',where:{project_id:projectId},limit:100});
   if(!Array.isArray(members?.rows)||members.limited||members.rows.length>=100)
    return res.status(503).json({success:false,code:'MEMBERSHIP_LIST_UNVERIFIED'});
   const seen=new Set([ownerId]);
   for(const row of members.rows){
    if(!row||row.project_id!==projectId||!uuid.test(String(row.membership_id||''))||!uuid.test(String(row.user_id||''))||!['member'].includes(row.role)||!['active','revoked'].includes(row.status)||!Number.isFinite(Date.parse(row.created_at)))
     return res.status(503).json({success:false,code:'MEMBERSHIP_LIST_UNVERIFIED'});
    if(seen.has(row.user_id))return res.status(503).json({success:false,code:'MEMBERSHIP_DUPLICATE'});
    seen.add(row.user_id);
    if(row.status==='active')base.push({user_id:row.user_id,role:'member',source:'verified_membership'});
   }
   return res.json({success:true,project_id:projectId,membership_inventory_complete:true,members:base});
  }catch(error){console.warn('Project membership unavailable',error.name||'Error');return res.status(503).json({success:false,code:'MEMBERSHIP_UNAVAILABLE'});}
 };
}
module.exports={createProjectMembersHandler};
