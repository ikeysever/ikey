/* iKey 3.1 — staging GAS ping routing seam.
 * Integrate ONLY into a verified copy of the existing doPost after GEN3_API_KEY
 * authentication, preserving all existing routing and response wrappers.
 * No doPost is declared here, so adding this file cannot activate a route.
 */
const IKEY_PING_ACTIONS_=[
 'devicePingCreate','devicePingClaim','devicePingReport','devicePingStatus'
];
function ikeyPingIsAction_(action){
 return typeof action==='string'&&IKEY_PING_ACTIONS_.indexOf(action)!==-1;
}
/* Returns {handled:false} for every non-ping action. Do not use a fallback
 * that silently dispatches an unrecognized action into the ping queue.
 */
function ikeyPingTryDispatch_(action,payload){
 if(!ikeyPingIsAction_(action))return {handled:false};
 return {
  handled:true,
  result:ikeyPingDispatchAuthorized_(action,payload,ikeyPingAuthorization_())
 };
}
