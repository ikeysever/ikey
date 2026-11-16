'use strict';
const {createCommand,validateTarget}=require('./unlock-command-contract');
/**
 * Staging-only API. All routes fail closed unless explicitly enabled.
 * Database RPCs must be installed and verified before enabling this flag.
 */
module.exports=function mountUnlockControl(app,{store,requireProjectUser,requireDevice,sameProjectOrigin}){
 const enabled=()=>process.env.IKEY_PHYSICAL_UNLOCK_ENABLED==='true'&&process.env.IKEY_STORAGE_BACKEND==='supabase';
 const fail=res=>res.status(503).json({success:false,code:'PHYSICAL_UNLOCK_DISABLED',unlock_signal_sent:false});
 const err=(res,e)=>{console.warn('Unlock control unavailable',e.name||'Error');return res.status(503).json({success:false,code:'UNLOCK_STORAGE_UNAVAILABLE',unlock_signal_sent:false});};
 const idOk=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id);
 async function allowed(user,project_id,device_id,slot_number){
  const p=(await store.dbCall('db.select',{table:'Projects',where:{project_id},limit:2})).rows||[];
  if(p.length!==1||p[0].status!=='active')return false;
  const owner=p[0].created_by_user_id===user.user_id;
  const members=owner?[]:(await store.dbCall('db.select',{table:'Project_Access',where:{project_id,user_id:user.user_id,entry_type:'member',status:'approved'},limit:2})).rows||[];
  if(!owner&&(members.length!==1||members[0].role!=='admin'))return false;
  const bindings=(await store.dbCall('db.select',{table:'Project_Devices',where:{project_id,device_id},limit:2})).rows||[];
  if(bindings.length!==1)return false;
  const slots=(await store.dbCall('db.select',{table:'Project_Slot_Codes',where:{project_id,device_id,slot_number,is_active:true},limit:2})).rows||[];
  return slots.length===1;
 }
 app.get('/api/unlock/config',requireProjectUser,(req,res)=>res.json({success:true,enabled:enabled()}));
 app.post('/api/unlock/commands',requireProjectUser,async(req,res)=>{
  res.set('Cache-Control','no-store');
  if(!enabled())return fail(res);
  if(!sameProjectOrigin(req))return res.status(403).json({success:false,code:'INVALID_ORIGIN'});
  if(!validateTarget(req.body)||Object.keys(req.body||{}).sort().join(',')!=='device_id,project_id,slot_number')
   return res.status(400).json({success:false,code:'INVALID_TARGET'});
  try{
   const {project_id,device_id,slot_number}=req.body;
   if(!await allowed(req.projectUser,project_id,device_id,slot_number))return res.status(403).json({success:false,code:'NOT_AUTHORIZED'});
   const command=createCommand(req.body);
   const result=await store.rpc('ikey_unlock_enqueue',{p_command_id:command.command_id,p_project_id:project_id,p_device_id:device_id,p_slot_number:slot_number,p_actor_user_id:req.projectUser.user_id,p_expires_at:command.expires_at});
   if(result!==true)return res.status(409).json({success:false,code:'COMMAND_NOT_ENQUEUED',unlock_signal_sent:false});
   return res.status(201).json({success:true,command_id:command.command_id,status:'pending',expires_at:command.expires_at,execution_verified:false});
  }catch(e){return err(res,e)}
 });
 app.get('/api/unlock/commands/:id',requireProjectUser,async(req,res)=>{
  res.set('Cache-Control','no-store');if(!enabled())return fail(res);
  if(!idOk(req.params.id))return res.status(400).json({success:false,code:'INVALID_ID'});
  try{
   const row=await store.rpc('ikey_unlock_status',{p_command_id:req.params.id,p_actor_user_id:req.projectUser.user_id});
   if(!row)return res.status(404).json({success:false,code:'NOT_FOUND'});
   return res.json({success:true,command_id:row.command_id,status:row.status,execution_verified:row.status==='executed'});
  }catch(e){return err(res,e)}
 });
 app.get('/api/device/unlock/next',requireDevice,async(req,res)=>{
  res.set('Cache-Control','no-store');if(!enabled())return fail(res);
  try{
   const row=await store.rpc('ikey_unlock_claim',{p_device_id:req.verifiedDevice.device_id});
   return res.json({success:true,command:row||null});
  }catch(e){return err(res,e)}
 });
 app.post('/api/device/unlock/report',requireDevice,async(req,res)=>{
  res.set('Cache-Control','no-store');if(!enabled())return fail(res);
  const {command_id,status}=req.body||{};
  if(!idOk(command_id)||!['executed','failed'].includes(status)||Object.keys(req.body||{}).sort().join(',')!=='command_id,status')
   return res.status(400).json({success:false,code:'INVALID_RECEIPT'});
  try{
   const done=await store.rpc('ikey_unlock_complete',{p_device_id:req.verifiedDevice.device_id,p_command_id:command_id,p_status:status});
   return res.status(done===true?200:409).json({success:done===true,code:done===true?'RECEIPT_RECORDED':'RECEIPT_REJECTED'});
  }catch(e){return err(res,e)}
 });
};
