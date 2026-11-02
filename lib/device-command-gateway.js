'use strict';
// NOT mounted as an HTTP route. Dedicated GAS actions must be implemented,
// deployed and schema-verified before this adapter can be enabled.
const {randomBytes}=require('node:crypto');
const ACTIONS=Object.freeze({
 create:'deviceCommandCreateAtomic',
 claim:'deviceCommandClaimAtomic',
 report:'deviceCommandReportAtomic',
 get:'deviceCommandGet',
 expire:'deviceCommandExpireAtomic'
});
function createDeviceCommandGateway({call,verifyActor,verifyDeviceBinding,createClaimToken=()=>randomBytes(32).toString('hex')}={}){
 if(typeof call!=='function'||typeof verifyActor!=='function'||typeof verifyDeviceBinding!=='function'||typeof createClaimToken!=='function')throw Error('DEVICE_COMMAND_DEPENDENCIES_REQUIRED');
 async function authorized(actor,project_id,device_id){
  if(!actor||typeof actor.user_id!=='string')throw Error('ACTOR_NOT_VERIFIED');
  if(!await verifyActor(actor,project_id))throw Error('PROJECT_ADMIN_REQUIRED');
  if(!await verifyDeviceBinding(project_id,device_id))throw Error('DEVICE_BINDING_REQUIRED');
 }
 return Object.freeze({
  async create({actor,project_id,device_id,idempotency_key,action='unlock',timeout_ms=15000}){
   await authorized(actor,project_id,device_id);
   if(action!=='unlock')throw Error('INVALID_COMMAND');
   const response=await call(ACTIONS.create,{actor_user_id:actor.user_id,project_id,device_id,idempotency_key,action,timeout_ms});
   if(!response?.command?.command_id)throw Error('INVALID_CREATE_RESPONSE');
   return {...response.command,duplicate:response.duplicate===true};
  },
  async claim({device,project_id}){
   if(!device?.authenticated||!device.device_id)throw Error('DEVICE_NOT_VERIFIED');
   if(!await verifyDeviceBinding(project_id,device.device_id))throw Error('DEVICE_BINDING_REQUIRED');
   const claim_token=createClaimToken();
   if(typeof claim_token!=='string'||!/^[a-f0-9]{64}$/.test(claim_token))throw Error('INVALID_CLAIM_TOKEN');
   // GAS hashes and persists this proof under the shared transaction lock.
   // Only the authenticated device receives the plaintext proof; never log it.
   const response=await call(ACTIONS.claim,{project_id,device_id:device.device_id,claim_token});
   const command=response?.command||response;
   if(command==null)return null;
   if(!command||typeof command!=='object'||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(command.command_id)||
    command.project_id!==project_id||command.device_id!==device.device_id||
    command.status!=='claimed'||command.action!=='unlock'||
    !Number.isSafeInteger(command.deadline_at)||command.deadline_at<=Date.now()||
    command.deadline_at>Date.now()+60000)throw Error('INVALID_CLAIM_RESPONSE');
   // Only expose explicit command fields; never forward future GAS secrets.
   return {command_id:command.command_id,project_id,device_id:device.device_id,
    action:'unlock',
    status:'claimed',deadline_at:command.deadline_at,
    claim_token};
  },
  async report({device,project_id,command_id,claim_token,status,feedback_observed}){
   if(!device?.authenticated||!device.device_id)throw Error('DEVICE_NOT_VERIFIED');
   if(!await verifyDeviceBinding(project_id,device.device_id))throw Error('DEVICE_BINDING_REQUIRED');
   if(!['succeeded','failed'].includes(status)||typeof feedback_observed!=='boolean'||(status==='succeeded'&&!feedback_observed))throw Error('INVALID_RESULT');
   if(typeof claim_token!=='string'||!/^[a-f0-9]{64}$/.test(claim_token))throw Error('INVALID_CLAIM_TOKEN');
   const result=await call(ACTIONS.report,{project_id,device_id:device.device_id,command_id,claim_token,status,feedback_observed});
   // An HTTP 200 from GAS is not proof that the command was committed.
   if(!result||typeof result!=='object'||result.success===false||
      result.command?.command_id&&result.command.command_id!==command_id)
    throw Error('INVALID_REPORT_RESPONSE');
   return result;
  },
  async get({actor,project_id,device_id,command_id}){
   await authorized(actor,project_id,device_id);
   return call(ACTIONS.get,{actor_user_id:actor.user_id,project_id,device_id,command_id});
  }
 });
}
module.exports={createDeviceCommandGateway,ACTIONS};
