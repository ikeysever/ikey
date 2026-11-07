/* iKey GAS ping staging preflight: read-only, no deployment or mutations.
 * Run manually in the SAME Apps Script project after adding all ping .gs files.
 * Does not reveal Script Property values or device credentials.
 */
function ikeyPingPreflight_(){
 const props=PropertiesService.getScriptProperties();
 const id=props.getProperty('GEN3_SPREADSHEET_ID');
 const secret=props.getProperty('IKEY_COMMAND_TRUST_SECRET');
 const apiKey=props.getProperty('GEN3_API_KEY');
 const result={
  legacy_factory_headers:typeof IKEY_FACTORY_HEADERS!=='undefined',
  legacy_binding_headers:typeof IKEY_BIND_HEADERS!=='undefined',
  spreadsheet_configured:Boolean(id),
  api_key_configured:typeof apiKey==='string'&&apiKey.length>=32,
  trust_secret_configured:typeof secret==='string'&&secret.length>=32,
  legacy_actor_verifier:typeof ikeyVerifyDeviceActor_==='function',
  factory_actions:typeof ikeyFactoryDeviceAction==='function',
  ping_dispatcher:typeof ikeyPingDispatchAuthorized_==='function',
  ping_route_seam:typeof ikeyPingTryDispatch_==='function',
  ping_authorization:typeof ikeyPingAuthorization_==='function',
  sheets:{}
 };
 if(id){
  const book=SpreadsheetApp.openById(id);
  [
   ['Factory_Devices',typeof IKEY_FACTORY_HEADERS!=='undefined'?IKEY_FACTORY_HEADERS:null],
   ['Project_Devices',typeof IKEY_BIND_HEADERS!=='undefined'?IKEY_BIND_HEADERS:null],
   ['Device_Ping_Commands',typeof IKEY_PING_COLUMNS_!=='undefined'?IKEY_PING_COLUMNS_:null],
   ['Device_Ping_Nonces',['nonce','expires_at']]
  ].forEach(function(entry){
   const tab=book.getSheetByName(entry[0]);
   result.sheets[entry[0]]=Boolean(Array.isArray(entry[1])&&tab&&tab.getLastColumn()>=entry[1].length&&
    tab.getRange(1,1,1,entry[1].length).getDisplayValues()[0].join('|')===entry[1].join('|'));
  });
 }
 result.ready=result.legacy_factory_headers&&result.legacy_binding_headers&&result.spreadsheet_configured&&result.api_key_configured&&result.trust_secret_configured&&
  result.legacy_actor_verifier&&result.factory_actions&&
  result.ping_dispatcher&&result.ping_route_seam&&result.ping_authorization&&
  Object.keys(result.sheets).length===4&&
  Object.values(result.sheets).every(Boolean);
 return result;
}
