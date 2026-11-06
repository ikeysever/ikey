/**
 * iKey 3.1 — isolated Bound Sandbox HTTP command adapter.
 * Only allowlisted command actions are accepted. No legacy dispatch exists.
 * Install ONLY in the isolated Bound Sandbox GAS project, never production.
 * Pair with ikey-bound-sandbox-dopost.candidate.gs after checking for an
 * existing doPost function in that project.
 */
const IKEY_COMMAND_ACTIONS_CANDIDATE_ = Object.freeze([
  'deviceCommandCreateAtomic',
  'deviceCommandGet',
  'deviceCommandClaimAtomic',
  'deviceCommandReportAtomic',
  'deviceCommandExpireAtomic'
]);

function ikeySandboxCommandHttpCandidate_(request) {
  if(!request||typeof request!=='object'||Array.isArray(request))
    return {ok:false,error:'INVALID_REQUEST'};
  const action=request.action;
  if(typeof action!=='string'||!action||action.length>128)
    return {ok:false,error:'INVALID_ACTION'};
  // Sandbox credentials must never authorize legacy GAS operations.
  if(IKEY_COMMAND_ACTIONS_CANDIDATE_.indexOf(action)===-1)
    return {ok:false,error:'SANDBOX_COMMAND_ACTION_NOT_ALLOWED'};
  const props=PropertiesService.getScriptProperties();
  if(props.getProperty('IKEY_SANDBOX_COMMAND_HTTP_ENABLED')!=='true')
    return {ok:false,error:'SANDBOX_COMMAND_DISABLED'};
  const expected=props.getProperty('IKEY_SANDBOX_COMMAND_GAS_KEY');
  if(!expected||Utilities.newBlob(expected).getBytes().length<32)
    return {ok:false,error:'SANDBOX_COMMAND_KEY_NOT_CONFIGURED'};
  if(typeof request.api_key!=='string'||
     !ikeyCommandEqual_(request.api_key,expected))
    return {ok:false,error:'UNAUTHORIZED'};
  if(!request.payload||typeof request.payload!=='object'||
     Array.isArray(request.payload))
    return {ok:false,error:'INVALID_PAYLOAD'};
  try {
    return {ok:true,result:ikeyCommandDispatchCandidate_(action,request.payload)};
  } catch(e) {
    // Never return raw exception strings that might expose internal details.
    return {ok:false,error:'SANDBOX_COMMAND_FAILED'};
  }
}
