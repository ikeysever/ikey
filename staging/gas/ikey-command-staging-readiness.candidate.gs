/**
 * Read-only staging readiness check for command GAS integration.
 * Never prints secret values or spreadsheet IDs; never changes sheet cells.
 * Execute manually in isolated Apps Script sandbox before enabling command API.
 */
function ikeyCommandStagingReadinessCandidate_() {
  const props=PropertiesService.getScriptProperties();
  const secret=props.getProperty('IKEY_COMMAND_TRUST_SECRET');
  const commandId=props.getProperty('IKEY_COMMAND_SPREADSHEET_ID');
  const nonceId=props.getProperty('IKEY_COMMAND_NONCE_SPREADSHEET_ID');
  const checks={
    trust_secret_configured:!!secret&&Utilities.newBlob(secret).getBytes().length>=32,
    command_store_configured:!!commandId,
    nonce_store_configured:!!nonceId,
    isolated_stores_configured:!!commandId&&!!nonceId,
    command_schema_valid:false,
    nonce_schema_valid:false
  };
  if(commandId) {
    const book=SpreadsheetApp.openById(commandId);
    const sheet=book.getSheetByName('DeviceCommands');
    const columns=['command_id','project_id','device_id','actor_user_id','action',
      'status','idempotency_key','created_at','expires_at','claim_token',
      'claimed_at','result_status','feedback_observed','reported_at'];
    if(sheet&&sheet.getLastColumn()===columns.length&&sheet.getLastRow()>=1) {
      const actual=sheet.getRange(1,1,1,columns.length).getDisplayValues()[0];
      checks.command_schema_valid=columns.every((name,i)=>actual[i]===name);
    }
  }
  if(nonceId) {
    const book=SpreadsheetApp.openById(nonceId);
    const sheet=book.getSheetByName('DeviceCommandNonces');
    if(sheet&&sheet.getLastColumn()===3&&sheet.getLastRow()>=1) {
      const actual=sheet.getRange(1,1,1,3).getDisplayValues()[0];
      checks.nonce_schema_valid=['nonce','expires_at','created_at'].every((name,i)=>actual[i]===name);
    }
  }
  return {ok:Object.keys(checks).every(k=>checks[k]),checks};
}
