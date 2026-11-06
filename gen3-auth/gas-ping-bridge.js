'use strict';
// Render-only composition point. Does not register public HTTP routes.
const {createSheetsStore}=require('./sheets-store');
const {createSignedPingStore}=require('./signed-ping-store');
function createGasPingBridge({store,secret}={}){
 if(process.env.IKEY_GAS_PING_ENABLED!=='true')throw Error('GAS_PING_DISABLED');
 const resolved=store||createSheetsStore();
 if(!resolved||typeof resolved.pingCall!=='function')throw Error('GAS_PING_TRANSPORT_MISSING');
 return createSignedPingStore({
  call:(action,payload)=>resolved.pingCall(action,payload),
  secret:secret||process.env.IKEY_COMMAND_TRUST_SECRET
 });
}
module.exports={createGasPingBridge};
