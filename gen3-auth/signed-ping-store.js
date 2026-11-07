'use strict';
const {signCommandAssertion}=require('../lib/command-trust-assertion');
const {createPingStoreAdapter,ACTIONS}=require('./ping-store-adapter');
// Render-only trusted factory: caller supplies verified Web actor or device identity.
// GAS must independently verify the assertion, scope, actor and nonce.
function createSignedPingStore({call,secret}){
 if(typeof secret!=='string'||Buffer.byteLength(secret)<32)throw Error('COMMAND_TRUST_NOT_CONFIGURED');
 if(typeof call!=='function')throw Error('PING_TRANSPORT_REQUIRED');
 const adapter=createPingStoreAdapter(call);
 async function execute(operation,{project_id,device_id,command_id,result,actor_user_id,device_authenticated}={}){
  if(!Object.prototype.hasOwnProperty.call(ACTIONS,operation))throw Error('PING_ACTION_NOT_ALLOWED');
  const webOperation=operation==='create'||operation==='status';
  if(webOperation){
   if(typeof actor_user_id!=='string'||!actor_user_id.trim()||device_authenticated===true)
    throw Error('PING_WEB_ACTOR_REQUIRED');
  }else if(device_authenticated!==true||actor_user_id!=null){
   throw Error('PING_DEVICE_PRINCIPAL_REQUIRED');
  }
  const payload={project_id,device_id};
  if(operation==='report'||operation==='status')payload.command_id=command_id;
  if(operation==='report')payload.result=result;
  const action=ACTIONS[operation];
  const assertion=signCommandAssertion({secret,action,project_id,device_id,
   actor_user_id:webOperation?actor_user_id:null,payload});
  return adapter.execute(operation,{...payload,assertion});
 }
 return {execute};
}
module.exports={createSignedPingStore};
