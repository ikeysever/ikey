'use strict';
// iKey generic Sheets engine v1. Add this file to the EXISTING Gen3 Apps Script project.
// IMPORTANT: Do NOT add another doPost(). Existing doPost must dispatch:
// if (/^db\\./.test(action)) return ikeyDbDispatch_(action, payload);
// Keep the existing api_key check, existing action routing and existing deployment.
// Required Script Property: IKEY_DB_SPREADSHEET_ID (existing iKey_Database ID).
//
// Trust boundary: this engine only accepts authenticated Render-to-GAS requests.
// Never expose the Apps Script API key to browsers or ESP32 devices.
// A server-side allowlist must restrict table access; the engine also enforces one.
// Script Property IKEY_DB_ALLOWED_TABLES: comma-separated table names, initially Projects.
// New approved tables require configuration only, not a GAS code change.
function ikeyDbAllowedTables_() {
  const raw=PropertiesService.getScriptProperties().getProperty('IKEY_DB_ALLOWED_TABLES') || 'Projects';
  return raw.split(',').map(s=>s.trim()).filter(Boolean);
}
// Expand configuration only after Render authorization policies for the new table are reviewed.
// NEVER include Gen3_Users, Auth_Sessions, Auth_Tokens, Auth_Audit_Logs, or Users.
const IKEY_DB_ALLOWED_ACTIONS_ = Object.freeze(['db.health','db.schema','db.select','db.insert','db.update','db.delete']);
const IKEY_DB_MAX_ROWS_ = 100;
const IKEY_DB_MAX_FIELDS_ = 80;

function ikeyDbDispatch_(action, payload) {
  if (IKEY_DB_ALLOWED_ACTIONS_.indexOf(action) === -1) throw Error('DB_ACTION_DENIED');
  const request = payload || {};
  if (action === 'db.health') {
    const ss = ikeyDbSpreadsheet_();
    return { engine:'ikey-db-v1', ready:true, spreadsheet_id:ss.getId() };
  }
  const sheet = ikeyDbSheet_(request.table);
  const headers = ikeyDbHeaders_(sheet);
  if (action === 'db.schema') return { table:sheet.getName(), columns:headers };
  if (action === 'db.select') return ikeyDbSelect_(sheet, headers, request);
  if (action === 'db.insert') return ikeyDbInsert_(sheet, headers, request);
  if (action === 'db.update') return ikeyDbUpdate_(sheet, headers, request);
  if (action === 'db.delete') return ikeyDbDelete_(sheet, headers, request);
  throw Error('DB_ACTION_DENIED');
}

function ikeyDbSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('IKEY_DB_SPREADSHEET_ID');
  if (!id) throw Error('DB_NOT_CONFIGURED');
  const ss = SpreadsheetApp.openById(id);
  if (!ss) throw Error('DB_UNAVAILABLE');
  return ss;
}
function ikeyDbSheet_(name) {
  if (typeof name !== 'string' || ikeyDbAllowedTables_().indexOf(name) < 0) throw Error('DB_TABLE_DENIED');
  const sheet = ikeyDbSpreadsheet_().getSheetByName(name);
  if (!sheet) throw Error('DB_TABLE_NOT_FOUND');
  return sheet;
}
function ikeyDbHeaders_(sheet) {
  const count = sheet.getLastColumn();
  if (!count || count > IKEY_DB_MAX_FIELDS_) throw Error('DB_SCHEMA_INVALID');
  const headers = sheet.getRange(1, 1, 1, count).getDisplayValues()[0].map(x => String(x).trim());
  if (headers.some(h => !/^[a-z][a-z0-9_]*$/.test(h)) || new Set(headers).size !== headers.length) throw Error('DB_SCHEMA_INVALID');
  return headers;
}
function ikeyDbRecord_(headers, row) {
  const obj = {};
  headers.forEach((h, i) => { obj[h] = row[i]; });
  return obj;
}
function ikeyDbWhere_(headers, where) {
  if (!where || typeof where !== 'object' || Array.isArray(where)) throw Error('DB_WHERE_REQUIRED');
  const keys = Object.keys(where);
  if (!keys.length || keys.length > 4 || keys.some(k => headers.indexOf(k) < 0)) throw Error('DB_WHERE_INVALID');
  if (keys.some(k => where[k] === null || typeof where[k] === 'object' || String(where[k]).length > 200)) throw Error('DB_WHERE_INVALID');
  return record => keys.every(k => String(record[k]) === String(where[k]));
}
function ikeyDbSelect_(sheet, headers, req) {
  const predicate = ikeyDbWhere_(headers, req.where);
  const limit = req.limit === undefined ? 50 : Number(req.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > IKEY_DB_MAX_ROWS_) throw Error('DB_LIMIT_INVALID');
  const last = sheet.getLastRow();
  if (last < 2) return { rows:[], count:0 };
  const values = sheet.getRange(2,1,last-1,headers.length).getValues();
  const rows = [];
  for (let i=0;i<values.length;i++) {
    const record=ikeyDbRecord_(headers,values[i]);
    if (predicate(record)) {
      rows.push(record);
      if (rows.length === limit) break;
    }
  }
  return { rows:rows, count:rows.length };
}
function ikeyDbValues_(headers, data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error('DB_DATA_INVALID');
  const keys = Object.keys(data);
  if (!keys.length || keys.some(k => headers.indexOf(k) < 0)) throw Error('DB_FIELD_DENIED');
  for (const key of keys) {
    const v=data[key];
    if (!['string','number','boolean'].includes(typeof v) || String(v).length > 2000 || (typeof v === 'number' && !Number.isFinite(v))) throw Error('DB_VALUE_INVALID');
    // Prevent spreadsheet formula injection in all text fields.
    if (typeof v === 'string' && /^[=+@\-\t\r]/.test(v)) throw Error('DB_FORMULA_DENIED');
  }
  return keys;
}
function ikeyDbInsert_(sheet, headers, req) {
  const data=req.data;
  ikeyDbValues_(headers,data);
  const primary=req.primary_key;
  if (typeof primary !== 'string' || headers.indexOf(primary) < 0 || !data[primary]) throw Error('DB_PRIMARY_KEY_REQUIRED');
  const lock=LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw Error('DB_BUSY');
  try {
    const last=sheet.getLastRow();
    if (last > 1) {
      const index=headers.indexOf(primary)+1;
      const ids=sheet.getRange(2,index,last-1,1).getDisplayValues();
      if (ids.some(row=>String(row[0])===String(data[primary]))) throw Error('DB_DUPLICATE_KEY');
    }
    const row=headers.map(h=>Object.prototype.hasOwnProperty.call(data,h)?data[h]:'');
    sheet.getRange(last+1,1,1,headers.length).setValues([row]);
    SpreadsheetApp.flush();
    return { inserted:true, record:ikeyDbRecord_(headers,row) };
  } finally { lock.releaseLock(); }
}
function ikeyDbUniqueTarget_(sheet,headers,where) {
  const keys=Object.keys(where||{});
  if (keys.length!==1 || !/_id$/.test(keys[0])) throw Error('DB_UNIQUE_ID_REQUIRED');
  const predicate=ikeyDbWhere_(headers,where);
  const last=sheet.getLastRow();
  if(last<2)throw Error('DB_NOT_FOUND');
  const values=sheet.getRange(2,1,last-1,headers.length).getValues();
  const matches=[];
  values.forEach((row,i)=>{if(predicate(ikeyDbRecord_(headers,row)))matches.push(i+2);});
  if(matches.length!==1)throw Error(matches.length?'DB_NOT_UNIQUE':'DB_NOT_FOUND');
  return matches[0];
}
function ikeyDbUpdate_(sheet,headers,req) {
  const keys=ikeyDbValues_(headers,req.data);
  if(keys.some(k=>/_id$/.test(k)))throw Error('DB_PRIMARY_KEY_IMMUTABLE');
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(15000))throw Error('DB_BUSY');
  try{
    const row=ikeyDbUniqueTarget_(sheet,headers,req.where);
    keys.forEach(k=>sheet.getRange(row,headers.indexOf(k)+1).setValue(req.data[k]));
    SpreadsheetApp.flush();
    return { updated:true };
  }finally{lock.releaseLock();}
}
function ikeyDbDelete_(sheet,headers,req) {
  // Soft-delete only; irreversible row deletion is deliberately unsupported.
  if(headers.indexOf('status')<0)throw Error('DB_SOFT_DELETE_UNSUPPORTED');
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(15000))throw Error('DB_BUSY');
  try{
    const row=ikeyDbUniqueTarget_(sheet,headers,req.where);
    sheet.getRange(row,headers.indexOf('status')+1).setValue('deleted');
    SpreadsheetApp.flush();
    return { deleted:true, soft_deleted:true };
  }finally{lock.releaseLock();}
}
