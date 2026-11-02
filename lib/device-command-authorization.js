'use strict';
// Server-only authorization for command creation. Never accepts actor IDs from
// the browser payload; caller supplies a user resolved from a valid session.
const DEVICE_ID=/^[A-HJ-NP-Z2-9]{8}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function createCommandAuthorization({dbCall}={}){
 if(typeof dbCall!=='function')throw Error('COMMAND_AUTH_STORAGE_REQUIRED');
 async function select(table,where){
  const result=await dbCall('db.select',{table,where,limit:2});
  if(!Array.isArray(result?.rows))throw Error('COMMAND_AUTH_STORAGE_UNAVAILABLE');
  return result.rows;
 }
 async function verifyActor(actor,project_id){
  if(!actor||!UUID.test(actor.user_id)||!UUID.test(project_id)||actor.status!=='active')return false;
  const projects=await select('Projects',{project_id});
  const project=projects.find(r=>r.project_id===project_id&&r.status==='active');
  if(!project)return false;
  if(actor.global_role==='super_admin')return true;
  if(project.created_by_user_id===actor.user_id)return true;
  const access=await select('Project_Access',{project_id,user_id:actor.user_id});
  return access.some(r=>r.project_id===project_id&&r.user_id===actor.user_id&&
   ['owner','admin'].includes(r.role)&&r.status==='active');
 }
 async function verifyDeviceBinding(project_id,device_id){
  if(!UUID.test(project_id)||!DEVICE_ID.test(device_id))return false;
  const devices=await select('Devices',{device_id});
  if(!devices.some(r=>r.device_id===device_id&&r.status==='pre_registered'))return false;
  // A pre-registered device is not sufficient: require an explicit binding.
  // If Project_Devices is absent, storage rejects and the command fails closed.
  const bindings=await select('Project_Devices',{project_id,device_id});
  return bindings.some(r=>r.project_id===project_id&&r.device_id===device_id);
 }
 return Object.freeze({verifyActor,verifyDeviceBinding});
}
module.exports={createCommandAuthorization};
