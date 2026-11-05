/**
 * iKey 3.1 — staging-only doPost command router integration.
 *
 * Integration point in the existing iKey_Gen3_Auth_API doPost:
 *   const result = action.startsWith('db.')
 *     ? ikeyDbDispatch_(action, payload)
 *     : IKEY_COMMAND_ACTIONS_CANDIDATE_.includes(action)
 *       ? ikeyCommandDispatchCandidate_(action, payload)
 *       : ...existing dispatch branches...
 *
 * IMPORTANT: Keep the existing GEN3_API_KEY check BEFORE this routing.
 * Do not install this in production until the staging spreadsheet, trust
 * secret, shared lock and end-to-end tests have been verified.
 */
const IKEY_COMMAND_ACTIONS_CANDIDATE_ = Object.freeze([
  'deviceCommandCreateAtomic',
  'deviceCommandGet',
  'deviceCommandClaimAtomic',
  'deviceCommandReportAtomic',
  'deviceCommandExpireAtomic'
]);
function ikeyCommandRouteCandidate_(action,payload,legacyDispatch) {
  if(typeof legacyDispatch!=='function')throw Error('COMMAND_LEGACY_DISPATCH_REQUIRED');
  if(IKEY_COMMAND_ACTIONS_CANDIDATE_.indexOf(action)!==-1)
    return ikeyCommandDispatchCandidate_(action,payload);
  return legacyDispatch(action,payload);
}

/**
 * Sandbox-only HTTP entry adapter. Invoke from the existing doPost AFTER
 * identifying the isolated sandbox deployment; do not replace production
 * doPost or forward the sandbox key to legacy handlers.
 *
 * @param {Object} request Parsed JSON body {api_key, action, payload}.
 * @param {Function} legacyDispatch Unused compatibility argument; never called by sandbox adapter.
 * @returns {Object} {ok,result} or {ok:false,error}; no secret disclosure.
 */
function ikeySandboxCommandHttpCandidate_(request,legacyDispatch) {
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
