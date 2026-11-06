/**
 * Read-only readiness for the pinned Bound Sandbox command store.
 * No IDs or secrets are printed. Does not mutate spreadsheet cells.
 */
function ikeyCommandStagingReadinessCandidate_() {
  const props=PropertiesService.getScriptProperties();
  const secret=props.getProperty('IKEY_COMMAND_TRUST_SECRET');
  const expected=props.getProperty('IKEY_SANDBOX_SPREADSHEET_ID');
  const enabled=props.getProperty('IKEY_SANDBOX_COMMAND_HTTP_ENABLED')==='true';
  const checks={
    trust_secret_configured:!!secret&&Utilities.newBlob(secret).getBytes().length>=32,
    sandbox_http_enabled:enabled,
    sandbox_id_pinned:!!expected,
    bound_spreadsheet_matches:false,
    command_schema_valid:false,
    nonce_schema_valid:false
  };
  // Never use openById: it could silently access a different spreadsheet.
  const book=SpreadsheetApp.getActiveSpreadsheet();
  checks.bound_spreadsheet_matches=!!book&&!!expected&&book.getId()===expected;
  if(checks.bound_spreadsheet_matches&&enabled){
    const command=book.getSheetByName('DeviceCommands');
    const nonce=book.getSheetByName('DeviceCommandNonces');
    const columns=['command_id','project_id','device_id','actor_user_id','action',
      'status','idempotency_key','created_at','expires_at','claim_token',
      'claimed_at','result_status','feedback_observed','reported_at'];
    if(command&&command.getLastColumn()===columns.length&&command.getLastRow()>=1){
      const actual=command.getRange(1,1,1,columns.length).getDisplayValues()[0];
      checks.command_schema_valid=columns.every((name,i)=>actual[i]===name);
    }
    if(nonce&&nonce.getLastColumn()===3&&nonce.getLastRow()>=1){
      const actual=nonce.getRange(1,1,1,3).getDisplayValues()[0];
      checks.nonce_schema_valid=['nonce','expires_at','created_at'].every((name,i)=>actual[i]===name);
    }
  }
  return {ok:Object.keys(checks).every(k=>checks[k]),checks};
}
