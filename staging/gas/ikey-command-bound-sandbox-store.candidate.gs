/**
 * Bound Sandbox-only spreadsheet adapter.
 * Install only in iKey-Mainline2-Bound-Sandbox. Never deploy to production.
 * Requires IKEY_SANDBOX_SPREADSHEET_ID set to the exact bound spreadsheet ID.
 * Both command and nonce operations use the SAME bound spreadsheet.
 */
function ikeyBoundSandboxSpreadsheetCandidate_() {
  const props=PropertiesService.getScriptProperties();
  if(props.getProperty('IKEY_SANDBOX_COMMAND_HTTP_ENABLED')!=='true')
    throw Error('SANDBOX_COMMAND_DISABLED');
  const expected=props.getProperty('IKEY_SANDBOX_SPREADSHEET_ID');
  if(!expected)throw Error('SANDBOX_SPREADSHEET_NOT_CONFIGURED');
  const book=SpreadsheetApp.getActiveSpreadsheet();
  if(!book||book.getId()!==expected)
    throw Error('SANDBOX_SPREADSHEET_BINDING_MISMATCH');
  return book;
}
function ikeyBoundCommandSheetCandidate_() {
  const sheet=ikeyBoundSandboxSpreadsheetCandidate_().getSheetByName('DeviceCommands');
  if(!sheet)throw Error('COMMAND_SHEET_MISSING');
  return sheet;
}
function ikeyBoundNonceSheetCandidate_() {
  const sheet=ikeyBoundSandboxSpreadsheetCandidate_().getSheetByName('DeviceCommandNonces');
  if(!sheet)throw Error('COMMAND_NONCE_SHEET_MISSING');
  return sheet;
}
