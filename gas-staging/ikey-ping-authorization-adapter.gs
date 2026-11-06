/* Staging-only GAS authorization adapter.
 * Requires existing ikeyVerifyDeviceActor_ and projectAccessGet.
 * A project admin is NOT proof of a device's factory binding.
 * Wire a real device binding resolver before enabling this dispatcher.
 */
function ikeyPingAuthorization_(verifyBinding){
 if(typeof verifyBinding!=='function')throw Error('PING_BINDING_VERIFIER_REQUIRED');
 function bound(projectId,deviceId){
  return verifyBinding(projectId,deviceId)===true;
 }
 return {
  verifyWebOwner:function(actorUserId,projectId,deviceId){
   if(typeof actorUserId!=='string'||typeof projectId!=='string'||
      typeof deviceId!=='string')return false;
   // Reuse the existing active-user + project admin authorization.
   if(ikeyVerifyDeviceActor_('factoryDeviceList',{
    actor_user_id:actorUserId,project_id:projectId
   })!==true)return false;
   return bound(projectId,deviceId);
  },
  verifyDeviceBinding:function(projectId,deviceId){
   return bound(projectId,deviceId);
  }
 };
}
