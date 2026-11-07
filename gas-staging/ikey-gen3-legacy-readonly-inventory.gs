/* iKey Gen3 — READ-ONLY legacy GAS inventory, 2026-11-07.
 * Run ONLY in the existing iKey_Gen3_Auth_API editor, not in staging.
 * Does not mutate sheets, script properties, routes or deployment.
 * Logs names and booleans only; never prints property values or credentials.
 */
function ikeyGen3ReadOnlyInventory_(){
 const exists=function(name){try{return typeof globalThis[name]==='function'}catch(_){return false}};
 const funcs=['doPost','respond','ikeyFactoryDeviceAction','ikeyVerifyDeviceActor_',
  'ikeyDeviceSheet_','ikeyDeviceRows_','executeProjectAccess','executeAdminAccount',
  'ikeyDbDispatch_','ikeyPingTryDispatch_','ikeyPingPreflight_'];
 const functions={};
 funcs.forEach(function(name){functions[name]=exists(name)});
 const props=PropertiesService.getScriptProperties();
 const names=['GEN3_SPREADSHEET_ID','GEN3_API_KEY','IKEY_COMMAND_TRUST_SECRET'];
 const properties={};
 names.forEach(function(name){
  const value=props.getProperty(name);
  properties[name]={configured:!!value,at_least_32_chars:typeof value==='string'&&value.length>=32};
 });
 const expected=['Factory_Devices','Project_Devices','Device_Ping_Commands','Device_Ping_Nonces'];
 const sheets={};
 const id=props.getProperty('GEN3_SPREADSHEET_ID');
 if(id){
  try{
   const book=SpreadsheetApp.openById(id);
   expected.forEach(function(name){
    const tab=book.getSheetByName(name);
    sheets[name]={exists:!!tab,header_columns:tab?tab.getLastColumn():0};
   });
  }catch(_){sheets.error='SPREADSHEET_UNAVAILABLE'}
 }
 const report={project:'existing Gen3 editor (caller supplied)',functions:functions,properties:properties,sheets:sheets,
  note:'Presence only; does not prove authorization correctness, route wiring or deployment'};
 Logger.log(JSON.stringify(report,null,2));
 return report;
}
