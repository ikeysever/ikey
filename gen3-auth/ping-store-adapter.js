'use strict';
// Trusted Render-to-GAS adapter for non-actuating ping operations only.
// Caller must already be authenticated and authorized by the HTTP layer.
// GAS dispatcher must independently verify the signed actor/device assertion.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEVICE=/^[A-HJ-NP-Z2-9]{8}$/;
const ACTIONS=Object.freeze({
 create:'devicePingCreate',claim:'devicePingClaim',
 report:'devicePingReport',status:'devicePingStatus'
});
function createPingStoreAdapter(call){
 if(typeof call!=='function')throw Error('PING_TRANSPORT_REQUIRED');
 async function execute(operation,{project_id,device_id,command_id,result,assertion}={}){
  if(!Object.prototype.hasOwnProperty.call(ACTIONS,operation))throw Error('PING_ACTION_NOT_ALLOWED');
  if(!UUID.test(String(project_id||''))||!DEVICE.test(String(device_id||'')))
   throw Error('PING_SCOPE_INVALID');
  if((operation==='report'||operation==='status')&&!UUID.test(String(command_id||'')))
   throw Error('PING_COMMAND_ID_INVALID');
  if(operation==='report'&&!['completed','failed'].includes(result))
   throw Error('PING_RESULT_INVALID');
  // This assertion must be produced by a trusted session-aware signer.
  // Never allow a browser or device to supply its own authorization proof.
  if(typeof assertion!=='string'||assertion.length<32||assertion.length>4096)
   throw Error('PING_ASSERTION_REQUIRED');
  const payload={project_id,device_id,command_assertion:assertion};
  if(operation==='report'||operation==='status')payload.command_id=command_id;
  if(operation==='report')payload.result=result;
  const response=await call(ACTIONS[operation],payload);
  if(!response||typeof response!=='object'||Array.isArray(response))
   throw Error('PING_RESPONSE_INVALID');
  return response;
 }
 return {execute};
}
module.exports={createPingStoreAdapter,ACTIONS};
