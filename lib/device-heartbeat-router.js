'use strict';
// Non-actuating heartbeat endpoints. Device authentication is supplied by device-auth.js.
module.exports=function mountDeviceHeartbeat(app,{store,requireDevice,requireProjectUser}){
 const valid=id=>/^[A-HJ-NP-Z2-9]{8}$/.test(String(id||''));
 const fresh=row=>row&&Number.isFinite(Date.parse(row.last_seen_at))&&Date.now()-Date.parse(row.last_seen_at)<=120000;
 app.post('/api/device/heartbeat',requireDevice,async(req,res)=>{
  res.set('Cache-Control','no-store');
  if(req.body&&Object.keys(req.body).length)return res.status(400).json({success:false,code:'INVALID_INPUT'});
  const id=req.verifiedDevice.device_id;
  try{
   const now=new Date().toISOString();
   const existing=await store.dbCall('db.select',{table:'Device_Heartbeats',where:{device_id:id},limit:1});
   if(existing.rows.length){
    const result=await store.dbCall('db.update',{table:'Device_Heartbeats',where:{device_id:id},data:{last_seen_at:now}});
    if(result.count!==1)throw Error('HEARTBEAT_UPDATE_FAILED');
   }else{
    try{await store.dbCall('db.insert',{table:'Device_Heartbeats',primary_key:'device_id',data:{device_id:id,last_seen_at:now}});}
    catch(e){if(e.message!=='SUPABASE_DUPLICATE_KEY')throw e;
     const result=await store.dbCall('db.update',{table:'Device_Heartbeats',where:{device_id:id},data:{last_seen_at:now}});
     if(result.count!==1)throw Error('HEARTBEAT_UPDATE_FAILED');
    }
   }
   return res.json({success:true,device_id:id,server_time:now,heartbeat_interval_seconds:30,physical_unlock_enabled:false});
  }catch(e){console.warn('Device heartbeat unavailable',e.message);return res.status(503).json({success:false,code:'HEARTBEAT_STORAGE_UNAVAILABLE'});}
 });
 app.get('/api/projects/:projectId/devices/:deviceId/live',requireProjectUser,async(req,res)=>{
  res.set('Cache-Control','no-store');
  const {projectId,deviceId}=req.params;
  if(!projectId||projectId.length>128||!valid(deviceId))return res.status(400).json({success:false,code:'INVALID_INPUT'});
  try{
   const project=(await store.dbCall('db.select',{table:'Projects',where:{project_id:projectId},limit:1})).rows[0];
   if(!project||project.status!=='active')return res.status(404).json({success:false,code:'NOT_FOUND'});
   const owner=project.created_by_user_id===req.projectUser.user_id;
   const member=owner?null:(await store.dbCall('db.select',{table:'Project_Access',where:{project_id:projectId,user_id:req.projectUser.user_id,entry_type:'member',status:'approved'},limit:1})).rows[0];
   if(!owner&&!member)return res.status(403).json({success:false,code:'NOT_AUTHORIZED'});
   const binding=(await store.dbCall('db.select',{table:'Project_Devices',where:{project_id:projectId,device_id:deviceId},limit:1})).rows[0];
   if(!binding||binding.status==='deleted')return res.status(404).json({success:false,code:'NOT_FOUND'});
   const row=(await store.dbCall('db.select',{table:'Device_Heartbeats',where:{device_id:deviceId},limit:1})).rows[0];
   return res.json({success:true,device_id:deviceId,online:Boolean(fresh(row)),last_seen_at:row?.last_seen_at||null,physical_unlock_enabled:false});
  }catch(e){console.warn('Device live status unavailable',e.message);return res.status(503).json({success:false,code:'LIVE_STATUS_UNAVAILABLE'});}
 });
};