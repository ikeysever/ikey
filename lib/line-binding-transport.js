'use strict';
// Staging-only action transport contract. Never expose generic db.* and NEVER
// call this adapter until matching GAS actions are reviewed and deployed on
// isolated staging infrastructure. No production route imports this module.
const allowed=new Set(['lineBindingCreateChallengeAtomic','lineBindingConsumeChallengeAtomic','lineBindingGetByUser','lineBindingUnbindAtomic','lineBindingRecordWebhookEventAtomic']);
function createLineBindingTransport(call){
 if(typeof call!=='function')throw Error('LINE_TRANSPORT_UNAVAILABLE');
 const invoke=(action,payload)=>{if(!allowed.has(action))throw Error('LINE_ACTION_DENIED');return call(action,payload);};
 return {
  createChallengeAtomic:p=>invoke('lineBindingCreateChallengeAtomic',p),
  consumeChallengeAtomic:p=>invoke('lineBindingConsumeChallengeAtomic',p),
  getBindingByUser:p=>invoke('lineBindingGetByUser',p),
  unbindAtomic:p=>invoke('lineBindingUnbindAtomic',p),
  recordWebhookEventAtomic:p=>invoke('lineBindingRecordWebhookEventAtomic',p)
 };
}
module.exports={createLineBindingTransport};
