'use strict';
// Opt-in announcement mutation controller. Not mounted in server.js.
// No direct db.insert/update/delete fallback: GAS must provide the verified
// intent-first journaled mutation endpoint before this can be enabled.
const ALLOWED=new Set(['create','update','delete']);
function makeAnnouncementMutator({authorize,writeJournaled}={}){
 if(typeof authorize!=='function'||typeof writeJournaled!=='function')throw Error('ANNOUNCEMENT_ADAPTER_NOT_CONFIGURED');
 return async function mutate({actor,operation,announcementId,payload,operationId}={}){
  if(!ALLOWED.has(operation))throw Error('ANNOUNCEMENT_OPERATION_DENIED');
  if(typeof announcementId!=='string'||!/^[-a-zA-Z0-9_]{1,100}$/.test(announcementId))throw Error('ANNOUNCEMENT_ID_INVALID');
  if(typeof operationId!=='string'||!/^[a-zA-Z0-9_-]{16,128}$/.test(operationId))throw Error('ANNOUNCEMENT_OPERATION_ID_REQUIRED');
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('ANNOUNCEMENT_PAYLOAD_INVALID');
  // Deny by default. Caller must verify live session, global role and scope.
  if(await authorize({actor,operation,announcementId})!==true)throw Error('ANNOUNCEMENT_FORBIDDEN');
  // No generic DB writes: only the independently reviewed GAS journal endpoint.
  const result=await writeJournaled({operation,announcementId,payload,operationId,actor});
  if(!result||result.committed!==true||!Number.isSafeInteger(result.revision)||result.revision<1)
   throw Error('ANNOUNCEMENT_COMMIT_UNVERIFIED');
  return {committed:true,revision:result.revision,operationId};
 };
}
module.exports={makeAnnouncementMutator};
