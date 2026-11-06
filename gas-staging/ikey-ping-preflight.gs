/* iKey GAS ping staging preflight: read-only, no deployment or mutations.
 * Run manually in the SAME Apps Script project after adding all ping .gs files.
 * Does not reveal Script Property values or device credentials.
 */
function ikeyPingPreflight_(){
 const props=PropertiesService.getScriptProperties();
 const id=props.getProperty('GEN3_SPREADSHEET_ID');
 const secret=props.getProperty('IKEY_COMMAND_TRUST_SECRET');
 const result={
  spreadsheet_configured:Boolean(id),
  trust_secret_configured:typeof secret==='string'&&secret.length>=32,
  legacy_actor_verifier:typeof ikeyVerifyDeviceActor_==='function',
  factory_actions:typeof ikeyFactoryDeviceAction==='function',
  ping_dispatcher:typeof ikeyPingDispatchAuthorized_==='function',
  ping_authorization:typeof ikeyPingAuthorization_==='function',
  sheets:{}
 };
 if(id){
  const book=SpreadsheetApp.openById(id);
  [
   ['Factory_Devices',IKEY_FACTORY_HEADERS],
   ['Project_Devices',IKEY_BIND_HEADERS],
   ['Device_Ping_Commands',IKEY_PING_COLUMNS_],
   ['Device_Ping_Nonces',['nonce','expires_at']]
  ].forEach(function(entry){
   const tab=book.getSheetByName(entry[0]);
   result.sheets[entry[0]]=Boolean(tab&&tab.getLastColumn()>=entry[1].length&&
    tab.getRange(1,1,1,entry[1].length).getDisplayValues()[0].join('|')===entry[1].join('|'));
  });
 }
 result.ready=result.spreadsheet_configured&&result.trust_secret_configured&&
  result.legacy_actor_verifier&&result.factory_actions&&
  result.ping_dispatcher&&result.ping_authorization&&
  Object.keys(result.sheets).length===4&&
  Object.values(result.sheets).every(Boolean);
 return result;
}
