/**
 * iKey 3.1 Mainline 2 - GAS device-auth contract candidate.
 * STAGING ONLY. Do not paste/deploy before reviewing the actual GAS project.
 * Read-only: does not create, update, or delete spreadsheet rows.
 * Integration: add the guarded branch documented below to the existing doPost dispatcher.
 *
 * Expected existing Script Property: GEN3_SPREADSHEET_ID.
 * Expected sheet: Devices
 * Columns: device_id,password_hash,status,created_by_user_id,created_at,updated_at
 * Response: one record or null, never an array.
 */
function ikeyDeviceAuthFindByIdCandidate_(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      Object.keys(payload).length !== 1 ||
      typeof payload.device_id !== 'string' ||
      !/^[A-HJ-NP-Z2-9]{8}$/.test(payload.device_id)) {
    throw Error('DEVICE_AUTH_INVALID_REQUEST');
  }
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('GEN3_SPREADSHEET_ID');
  if (!spreadsheetId) throw Error('DEVICE_AUTH_STORAGE_NOT_CONFIGURED');
  const tab = SpreadsheetApp.openById(spreadsheetId).getSheetByName('Devices');
  if (!tab) throw Error('DEVICE_AUTH_TABLE_NOT_FOUND');
  const lastCol = tab.getLastColumn();
  if (lastCol < 1 || lastCol > 80) throw Error('DEVICE_AUTH_SCHEMA_INVALID');
  const headers = tab.getRange(1, 1, 1, lastCol).getDisplayValues()[0].map(v => String(v).trim());
  const expected = ['device_id','password_hash','status','created_by_user_id','created_at','updated_at'];
  if (new Set(headers).size !== headers.length || expected.some(h => !headers.includes(h))) {
    throw Error('DEVICE_AUTH_SCHEMA_MISMATCH');
  }
  const count = tab.getLastRow() - 1;
  if (count < 1) return null;
  const idIndex = headers.indexOf('device_id');
  const rows = tab.getRange(2, 1, count, lastCol).getDisplayValues();
  let matched = null;
  for (const row of rows) {
    if (row[idIndex] !== payload.device_id) continue;
    if (matched !== null) throw Error('DEVICE_AUTH_DUPLICATE_DEVICE_ID');
    matched = Object.fromEntries(expected.map(h => [h, row[headers.indexOf(h)]]));
  }
  if (!matched) return null;
  // A malformed row must never be treated as an authenticated device.
  if (matched.status !== 'pre_registered' ||
      !/^scrypt:v1:[A-Za-z0-9_-]{22}:[A-Za-z0-9_-]{86}$/.test(matched.password_hash)) {
    return null;
  }
  return matched;
}

/**
 * Minimal integration into existing doPost(e), AFTER api_key validation and
 * payload normalization, BEFORE its existing action dispatch expression:
 *
 *   const result = action === 'deviceAuthFindById'
 *     ? ikeyDeviceAuthFindByIdCandidate_(payload)
 *     : action.startsWith('db.')
 *       ? ikeyDbDispatch_(action, payload)
 *       : ...existing branches unchanged...;
 *
 * Do not register this action under IKEY_DEVICE_ACTIONS: that list dispatches
 * to ikeyFactoryDeviceAction and uses a different factory-device schema.
 * Keep existing return respond({ok:true,result}) and error handling unchanged.
 */
function ikeyDeviceAuthDispatchCandidate_(action, payload, fallback) {
  if (action === 'deviceAuthFindById') return ikeyDeviceAuthFindByIdCandidate_(payload);
  return fallback();
}
