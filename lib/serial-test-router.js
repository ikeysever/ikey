'use strict';
const {randomUUID}=require('node:crypto');
module.exports=function mountSerialTest(app,{store,requireProjectUser,requireDevice,sameProjectOrigin}){
 const enabled=()=>process.env.IKEY_SERIAL_TEST_ENABLED==='true'&&process.env.IKEY_STORAGE_BACKEND==='supabase';
 const validDevice=id=>typeof id==='string'&&/^[A-HJ-NP-Z2-9]{8}$/.test(id);
 const validProject=id=>typeof id==='string'&&id.length>0&&id.length<=128;
 const unavailable=res=>res.status(503).json({success:false,code:'SERIAL_TEST_DISABLED'});
 async function permitted(userId,projectId,deviceId){
  const project=(await store.dbCall('db.select',{table:'Projects',where:{project_id:projectId},limit:1})).rows?.[0];
  if(!project||project.status==='deleted')return false;
  const owner=project.created_by_user_id===userId;
  const member=owner?null:(await store.dbCall('db.select',{table:'Project_Access',where:{project_id:projectId,user_id:userId,entry_type:'member',status:'approved'},limit:1})).rows?.[0];
  if(!owner&&member?.role!=='admin')return false;
  const binding=(await store.dbCall('db.select',{table:'Project_Devices',where:{project_id:projectId,device_id:deviceId},limit:1})).rows?.[0];
  return Boolean(binding);
 }
 app.get('/api/serial-test/config',requireProjectUser,(req,res)=>res.json({success:true,enabled:enabled()}));
 app.post('/api/serial-test/commands',requireProjectUser,async(req,res)=>{
  res.set('Cache-Control','no-store');
  if(!enabled())return unavailable(res);
  if(!sameProjectOrigin(req))return res.status(403).json({success:false,code:'INVALID_ORIGIN'});
  const {project_id,device_id}=req.body||{};
  if(!validProject(project_id)||!validDevice(device_id)||Object.keys(req.body).sort().join(',')!=='device_id,project_id')
   return res.status(400).json({success:false,code:'INVALID_INPUT'});
  try{
   if(!await permitted(req.projectUser.user_id,project_id,device_id))return res.status(403).json({success:false,code:'NOT_AUTHORIZED'});
   const command_id=randomUUID();
   await store.dbCall('db.insert',{table:'Device_Test_Commands',primary_key:'command_id',data:{
    command_id,project_id,device_id,actor_user_id:req.projectUser.user_id,status:'pending',
    expires_at:new Date(Date.now()+45000).toISOString()
   }});
   return res.status(201).json({success:true,command_id,status:'pending',physical_unlock:false});
  }catch(e){console.warn('Serial test create unavailable',e.message);return res.status(503).json({success:false,code:'COMMAND_STORAGE_UNAVAILABLE'});}
 });
 app.get('/api/serial-test/commands/:id',requireProjectUser,async(req,res)=>{
  res.set('Cache-Control','no-store');
  if(!enabled())return unavailable(res);
  if(!/^[a-f0-9-]{36}$/i.test(req.params.id))return res.status(400).json({success:false,code:'INVALID_ID'});
  try{
   const row=(await store.dbCall('db.select',{table:'Device_Test_Commands',where:{command_id:req.params.id},limit:1})).rows?.[0];
   if(!row||!await permitted(req.projectUser.user_id,row.project_id,row.device_id))return res.status(404).json({success:false,code:'NOT_FOUND'});
   const status=row.status!=='completed'&&Date.parse(row.expires_at)<=Date.now()?'expired':row.status;
   return res.json({success:true,command_id:row.command_id,status,physical_unlock:false});
  }catch(e){return res.status(503).json({success:false,code:'COMMAND_STORAGE_UNAVAILABLE'});}
 });

 app.post('/api/serial-test/admin/commands',requireProjectUser,async(req,res)=>{
  res.set('Cache-Control','no-store');
  if(!enabled())return unavailable(res);
  if(!sameProjectOrigin(req)||req.projectUser.global_role!=='super_admin')return res.status(403).json({success:false,code:'NOT_AUTHORIZED'});
  const device_id=req.body?.device_id;
  if(!validDevice(device_id)||Object.keys(req.body||{}).join(',')!=='device_id')return res.status(400).json({success:false,code:'INVALID_INPUT'});
  try{
   const device=(await store.dbCall('db.select',{table:'Devices',where:{device_id},limit:1})).rows?.[0];
   if(!device||device.status!=='pre_registered')return res.status(404).json({success:false,code:'DEVICE_NOT_REGISTERED'});
   const binding=(await store.dbCall('db.select',{table:'Project_Devices',where:{device_id},limit:1})).rows?.[0];
   if(!binding)return res.status(409).json({success:false,code:'DEVICE_NOT_BOUND_TO_PROJECT',message:'請先將裝置加入專案，才能建立測試指令'});
   const command_id=randomUUID();
   await store.dbCall('db.insert',{table:'Device_Test_Commands',primary_key:'command_id',data:{
    command_id,project_id:binding.project_id,device_id,actor_user_id:req.projectUser.user_id,
    status:'pending',expires_at:new Date(Date.now()+45000).toISOString()
   }});
   return res.status(201).json({success:true,command_id,status:'pending',physical_unlock:false});
  }catch(e){console.warn('Serial admin test unavailable',e.message);return res.status(503).json({success:false,code:'COMMAND_STORAGE_UNAVAILABLE'});}
 });
 app.get('/api/serial-test/admin/commands/:id',requireProjectUser,async(req,res)=>{
  res.set('Cache-Control','no-store');
  if(!enabled())return unavailable(res);
  if(req.projectUser.global_role!=='super_admin')return res.status(403).json({success:false,code:'NOT_AUTHORIZED'});
  if(!/^[a-f0-9-]{36}$/i.test(req.params.id))return res.status(400).json({success:false,code:'INVALID_ID'});
  try{
   const row=(await store.dbCall('db.select',{table:'Device_Test_Commands',where:{command_id:req.params.id},limit:1})).rows?.[0];
   if(!row)return res.status(404).json({success:false,code:'NOT_FOUND'});
   return res.json({success:true,command_id:row.command_id,status:row.status!=='completed'&&Date.parse(row.expires_at)<=Date.now()?'expired':row.status,physical_unlock:false});
  }catch(e){return res.status(503).json({success:false,code:'COMMAND_STORAGE_UNAVAILABLE'});}
 });
 app.get('/api/device/serial-test/next',requireDevice,async(req,res)=>{
  res.set('Cache-Control','no-store');
  if(!enabled())return unavailable(res);
  try{
   const data=await store.rpc('ikey_serial_test_claim',{p_device_id:req.verifiedDevice.device_id});
   return res.json(data);
  }catch(e){return res.status(503).json({success:false,code:'COMMAND_STORAGE_UNAVAILABLE'});}
 });
 app.post('/api/device/serial-test/report',requireDevice,async(req,res)=>{
  res.set('Cache-Control','no-store');
  if(!enabled())return unavailable(res);
  const id=req.body?.command_id;
  if(typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id)||req.body?.result!=='SERIAL_PRINTED')
   return res.status(400).json({success:false,code:'INVALID_INPUT'});
  try{
   const done=await store.rpc('ikey_serial_test_complete',{p_device_id:req.verifiedDevice.device_id,p_command_id:id});
   return res.status(done===true?200:409).json({success:done===true,code:done===true?'COMPLETED':'NOT_CLAIMED'});
  }catch(e){return res.status(503).json({success:false,code:'COMMAND_STORAGE_UNAVAILABLE'});}
 });
};
