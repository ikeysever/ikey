'use strict';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function createProjectListHandler(store){
 return async(req,res)=>{
  res.set('Cache-Control','no-store');
  const actor=String(req.projectUser?.user_id||'');
  if(!uuid.test(actor))return res.status(403).json({success:false,code:'INVALID_PROJECT_ACTOR'});
  try{
   const result=await store.dbCall('db.select',{table:'Projects',where:{created_by_user_id:actor},limit:100});
   if(!Array.isArray(result?.rows)||result.limited||result.rows.length>100)
    return res.status(503).json({success:false,code:'PROJECT_LIST_UNVERIFIED'});
   const seen=new Set(),projects=[];
   for(const row of result.rows){
    if(!row||!uuid.test(String(row.project_id||''))||row.created_by_user_id!==actor||seen.has(row.project_id))
     return res.status(503).json({success:false,code:'PROJECT_LIST_UNVERIFIED'});
    seen.add(row.project_id);
    if(row.status!=='deleted')projects.push(row);
   }
   return res.json({success:true,projects});
  }catch(error){console.warn('Project list unavailable',error.name||'Error');return res.status(503).json({success:false,code:'PROJECT_LIST_UNAVAILABLE'});}
 };
}
module.exports={createProjectListHandler};
