/* Staging-only durable nonce ledger. Requires a separate sheet:
 * Device_Ping_Nonces | nonce | expires_at
 * Provision the sheet manually in an isolated staging spreadsheet.
 * Never enable dispatcher routes without this file and permission checks.
 */
function ikeyPingConsumeNonce_(nonce,expiresAt){
 if(typeof nonce!=='string'||!/^[a-f0-9]{32}$/.test(nonce)||
    !Number.isFinite(expiresAt)||expiresAt<=Date.now())
  throw Error('PING_NONCE_INVALID');
 const id=PropertiesService.getScriptProperties().getProperty('GEN3_SPREADSHEET_ID');
 if(!id)throw Error('PING_NONCE_STORAGE_NOT_CONFIGURED');
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(15000))throw Error('PING_NONCE_LOCK_TIMEOUT');
 try{
  const sheet=SpreadsheetApp.openById(id).getSheetByName('Device_Ping_Nonces');
  if(!sheet)throw Error('PING_NONCE_SHEET_MISSING');
  const headers=sheet.getRange(1,1,1,2).getValues()[0];
  if(headers[0]!=='nonce'||headers[1]!=='expires_at')
   throw Error('PING_NONCE_SCHEMA_MISMATCH');
  const count=sheet.getLastRow()-1;
  if(count>0){
   const values=sheet.getRange(2,1,count,2).getValues();
   if(values.some(row=>row[0]===nonce))throw Error('PING_ASSERTION_REPLAY');
  }
  sheet.appendRow([nonce,expiresAt]);
 }finally{lock.releaseLock()}
}
