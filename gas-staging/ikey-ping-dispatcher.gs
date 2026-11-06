/* Staging-only trusted GAS dispatcher integration seam.
 * Invoke only AFTER the existing doPost dispatcher validates GEN3_API_KEY.
 * No automatic doPost registration or production deployment.
 * Authorization callbacks MUST consult trusted GAS user/project/device records.
 */
function ikeyPingDispatchAuthorized_(action,payload,authorization){
 if(!['devicePingCreate','devicePingClaim','devicePingReport','devicePingStatus'].includes(action))
  throw Error('PING_ACTION_NOT_ALLOWED');
 if(!authorization||typeof authorization.verifyWebOwner!=='function'||
    typeof authorization.verifyDeviceBinding!=='function')
  throw Error('PING_AUTHORIZATION_NOT_CONFIGURED');
 const identity=ikeyPingVerifyAssertion_(action,payload);
 const web=action==='devicePingCreate'||action==='devicePingStatus';
 if(web){
  // Callback must validate an active actor and project owner, AND that the
  // requested device belongs to this project. A signed actor is not enough.
  if(authorization.verifyWebOwner(identity.actor_user_id,identity.project_id,identity.device_id)!==true)
   throw Error('PING_PROJECT_ACCESS_DENIED');
 }else{
  // Callback must validate active factory registration and project binding.
  // Device authentication must be independently established at Render.
  if(authorization.verifyDeviceBinding(identity.project_id,identity.device_id)!==true)
   throw Error('PING_DEVICE_ACCESS_DENIED');
 }
 return ikeyPingCommandAction_(action,payload);
}
