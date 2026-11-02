'use strict';
// Command HTTP integration remains disabled pending verified GAS deployment.
const {createDeviceCommandGateway}=require('./device-command-gateway');
const {createCommandAuthorization}=require('./device-command-authorization');
function buildCommandGateway(store){
 if(!store||typeof store.commandCall!=='function'||typeof store.dbCall!=='function')throw Error('COMMAND_STORAGE_REQUIRED');
 const auth=createCommandAuthorization({dbCall:store.dbCall.bind(store)});
 return createDeviceCommandGateway({call:store.commandCall.bind(store),verifyActor:auth.verifyActor,verifyDeviceBinding:auth.verifyDeviceBinding});
}
function mountCommandRoutes(app,{store,requireProjectUser,sameProjectOrigin}){
 const gateway=store?buildCommandGateway(store):null;
 const root='/api/projects/:projectId/devices/:deviceId/commands';
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const device=/^[A-HJ-NP-Z2-9]{8}$/;
 const gate=(req,res,next)=>{
  res.set('Cache-Control','no-store');
  if(process.env.IKEY_PHYSICAL_UNLOCK_ENABLED!=='true'||!gateway)
   return res.status(503).json({success:false,code:'PHYSICAL_UNLOCK_DISABLED'});
  if(!uuid.test(req.params.projectId)||!device.test(req.params.deviceId))
   return res.status(400).json({success:false,code:'INVALID_REQUEST'});
  next();
 };
 app.post(root,gate,requireProjectUser,async(req,res)=>{
  if(!sameProjectOrigin(req))return res.status(403).json({success:false,code:'INVALID_ORIGIN'});
  const {idempotency_key,action,timeout_ms}=req.body||{};
  if(typeof idempotency_key!=='string'||!/^[A-Za-z0-9._:-]{8,128}$/.test(idempotency_key)||
    action!=='unlock'||!Number.isSafeInteger(timeout_ms)||timeout_ms<1000||timeout_ms>60000)
   return res.status(400).json({success:false,code:'INVALID_REQUEST'});
  try{
   const result=await gateway.create({actor:req.projectUser,project_id:req.params.projectId,
    device_id:req.params.deviceId,idempotency_key,action,timeout_ms});
   return res.status(result?.duplicate?200:202).json({success:true,result});
  }catch(err){
   if(['ACTOR_NOT_VERIFIED','PROJECT_ADMIN_REQUIRED','DEVICE_BINDING_REQUIRED'].includes(err.message))
    return res.status(403).json({success:false,code:'NOT_AUTHORIZED'});
   return res.status(503).json({success:false,code:'COMMAND_UNAVAILABLE'});
  }
 });
 app.get(root+'/:commandId',gate,requireProjectUser,async(req,res)=>{
  if(!uuid.test(req.params.commandId))return res.status(400).json({success:false,code:'INVALID_REQUEST'});
  try{
   const command=await gateway.get({actor:req.projectUser,project_id:req.params.projectId,
    device_id:req.params.deviceId,command_id:req.params.commandId});
   return command?res.json({success:true,command}):res.status(404).json({success:false,code:'NOT_FOUND'});
  }catch(err){
   if(['ACTOR_NOT_VERIFIED','PROJECT_ADMIN_REQUIRED','DEVICE_BINDING_REQUIRED'].includes(err.message))
    return res.status(403).json({success:false,code:'NOT_AUTHORIZED'});
   return res.status(503).json({success:false,code:'COMMAND_UNAVAILABLE'});
  }
 });
}
module.exports={buildCommandGateway,mountCommandRoutes};
