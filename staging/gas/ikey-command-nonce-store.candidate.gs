/**
 * iKey command nonce store — staging candidate.
 * Uses a dedicated sheet in the SANDBOX spreadsheet; never calls this against
 * production without a verified dispatcher and explicit rollout approval.
 * Requires IKEY_COMMAND_NONCE_SPREADSHEET_ID Script Property.
 * Sheet name: DeviceCommandNonces, columns nonce, expires_at, created_at.
 */
function ikeyCommandReserveNonceCandidate_(verified) {
  if(!verified || !/^[0-9a-f]{32}$/.test(verified.nonce||'') ||
     !Number.isSafeInteger(verified.exp) || verified.exp<=Date.now())
    throw Error('COMMAND_NONCE_INVALID');
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(10000))throw Error('COMMAND_NONCE_LOCK_BUSY');
  try {
    const id=PropertiesService.getScriptProperties()
      .getProperty('IKEY_COMMAND_NONCE_SPREADSHEET_ID');
    if(!id)throw Error('COMMAND_NONCE_STORE_NOT_CONFIGURED');
    const sheet=SpreadsheetApp.openById(id).getSheetByName('DeviceCommandNonces');
    if(!sheet)throw Error('COMMAND_NONCE_SHEET_MISSING');
    const lastCol=sheet.getLastColumn();
    const headers=sheet.getRange(1,1,1,lastCol).getDisplayValues()[0];
    const keys=['nonce','expires_at','created_at'];
    if(lastCol!==3 || keys.some((key,i)=>headers[i]!==key))
      throw Error('COMMAND_NONCE_SCHEMA_MISMATCH');
    const lastRow=sheet.getLastRow();
    if(lastRow>1){
      const nonces=sheet.getRange(2,1,lastRow-1,1).getDisplayValues();
      if(nonces.some(row=>row[0]===verified.nonce))
        throw Error('COMMAND_NONCE_REPLAY');
    }
    // A nonce remains recorded permanently to prevent replay even if clocks
    // drift or the sender reuses a nonce. Prune only with a separately
    // reviewed retention policy.
    sheet.appendRow([verified.nonce,String(verified.exp),new Date().toISOString()]);
    SpreadsheetApp.flush();
    return true;
  } finally {lock.releaseLock();}
}
/**
 * Gate for dispatcher integration. Must be called before any command
 * read/mutation; it does not itself execute the command.
 */
function ikeyCommandAuthorizeCandidate_(action,payload) {
  const verified=ikeyCommandVerifyAssertionCandidate_(action,payload);
  ikeyCommandReserveNonceCandidate_(verified);
  return verified;
}
