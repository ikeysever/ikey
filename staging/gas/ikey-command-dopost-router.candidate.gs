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
