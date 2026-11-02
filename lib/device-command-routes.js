'use strict';
// Command HTTP integration remains disabled pending verified GAS deployment.
const {createDeviceCommandGateway}=require('./device-command-gateway');
const {createCommandAuthorization}=require('./device-command-authorization');
function buildCommandGateway(store){
 if(!store||typeof store.commandCall!=='function'||typeof store.dbCall!=='function')throw Error('COMMAND_STORAGE_REQUIRED');
 const auth=createCommandAuthorization({dbCall:store.dbCall.bind(store)});
 return createDeviceCommandGateway({call:store.commandCall.bind(store),verifyActor:auth.verifyActor,verifyDeviceBinding:auth.verifyDeviceBinding});
}
module.exports={buildCommandGateway};
