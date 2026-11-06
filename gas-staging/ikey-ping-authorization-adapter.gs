/* Staging-only GAS authorization adapter for the existing Gen3 device tables.
 * Requires gas-device-actions.gs and gas-device-authorization.gs in same project.
 * Must only be called after GEN3_API_KEY and signed assertion validation.
 * Does not authenticate an ESP32 by itself; Render must verify the device.
 */
function ikeyPingVerifiedDeviceBinding_(projectId,deviceId){
 if(typeof projectId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)||
    typeof deviceId!=='string'||!/^[A-HJ-NP-Z2-9]{8}$/.test(deviceId))return false;
 const factory=ikeyDeviceSheet_('Factory_Devices',IKEY_FACTORY_HEADERS);
 const bindings=ikeyDeviceSheet_('Project_Devices',IKEY_BIND_HEADERS);
 const active=ikeyDeviceRows_(factory).filter(r=>String(r[0])===deviceId&&String(r[4])==='active');
 const matching=ikeyDeviceRows_(bindings).filter(r=>String(r[2])===deviceId);
 // Duplicate registrations or bindings are ambiguous: deny rather than guess.
 return active.length===1&&matching.length===1&&String(matching[0][1])===projectId;
}
function ikeyPingAuthorization_(){
 return {
  verifyWebOwner:function(actorUserId,projectId,deviceId){
   if(typeof actorUserId!=='string'||typeof projectId!=='string'||
      typeof deviceId!=='string')return false;
   if(ikeyVerifyDeviceActor_('factoryDeviceList',{
    actor_user_id:actorUserId,project_id:projectId
   })!==true)return false;
   return ikeyPingVerifiedDeviceBinding_(projectId,deviceId);
  },
  verifyDeviceBinding:function(projectId,deviceId){
   return ikeyPingVerifiedDeviceBinding_(projectId,deviceId);
  }
 };
}
