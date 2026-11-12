'use strict';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function createProjectMembersHandler(store){
 return async(req,res)=>{
  res.set('Cache-Control','no-store');
  const projectId=String(req.params.projectId||'');
  if(!uuid.test(projectId))return res.status(400).json({success:false,code:'INVALID_PROJECT_ID'});
  try{
   const result=await store.dbCall('db.select',{table:'Projects',where:{project_id:projectId},limit:1});
   if(!Array.isArray(result?.rows)||result.limited)return res.status(503).json({success:false,code:'MEMBERSHIP_UNVERIFIED'});
   const project=result.rows.find(p=>p.project_id===projectId&&p.status!=='deleted');
   if(!project)return res.status(404).json({success:false,code:'PROJECT_NOT_FOUND'});
   if(project.created_by_user_id!==req.projectUser.user_id)return res.status(403).json({success:false,code:'NOT_PROJECT_OWNER'});
   const ownerId=String(project.created_by_user_id||'');
   if(!uuid.test(ownerId))return res.status(503).json({success:false,code:'MEMBERSHIP_UNVERIFIED'});
   return res.json({success:true,project_id:projectId,membership_inventory_complete:false,members:[{user_id:ownerId,role:'owner',source:'project_creator'}]});
  }catch(error){console.warn('Project membership unavailable',error.name||'Error');return res.status(503).json({success:false,code:'MEMBERSHIP_UNAVAILABLE'});}
 };
}
module.exports={createProjectMembersHandler};
