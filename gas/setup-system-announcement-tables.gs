'use strict';
// Run manually by the owner in the EXISTING Gen3 Apps Script project.
// This creates only the two approved announcement sheets. It never clears,
// renames, or overwrites an existing sheet. If a sheet exists with a different
// header row, the function stops before changing either sheet.
function setupSystemAnnouncementTables() {
  const props = PropertiesService.getScriptProperties();
  const environment = props.getProperty('IKEY_ENVIRONMENT');
  const stagingId = props.getProperty('IKEY_STAGING_SPREADSHEET_ID');
  const spreadsheetId = props.getProperty('GEN3_SPREADSHEET_ID');
  if (environment !== 'staging' || !stagingId || !spreadsheetId || spreadsheetId !== stagingId) {
    throw new Error('STAGING_ONLY: Set IKEY_ENVIRONMENT=staging and make GEN3_SPREADSHEET_ID match IKEY_STAGING_SPREADSHEET_ID. No sheet was changed.');
  }
  const definitions = [
    {
      name: 'System_Announcements',
      headers: [
        'announcement_id','title','content','category','priority','status',
        'created_by_user_id','updated_by_user_id','created_at','updated_at',
        'published_at','scheduled_at','expires_at','archived_at','deleted_at'
      ]
    },
    {
      name: 'System_Announcement_Reads',
      headers: ['read_id','announcement_id','user_id','read_at']
    }
  ];
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const existing = definitions.map(def => {
    const sheet = spreadsheet.getSheetByName(def.name);
    if (!sheet) return { def, sheet: null, create: true };
    const lastColumn = sheet.getLastColumn();
    const headers = lastColumn
      ? sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(v => String(v).trim())
      : [];
    if (headers.length && (headers.length !== def.headers.length ||
      headers.some((value, index) => value !== def.headers[index]))) {
      throw new Error('Existing sheet schema mismatch: ' + def.name + '. No sheet was changed.');
    }
    if (!headers.length && sheet.getLastRow() > 0) {
      throw new Error('Existing sheet has data but no header row: ' + def.name + '. No sheet was changed.');
    }
    return { def, sheet, create: false, writeHeader: headers.length === 0 };
  });
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('Could not acquire database setup lock');
  try {
    existing.forEach(item => {
      let sheet = item.sheet;
      if (item.create) sheet = spreadsheet.insertSheet(item.def.name);
      if (item.create || item.writeHeader) {
        sheet.getRange(1, 1, 1, item.def.headers.length).setValues([item.def.headers]);
        sheet.setFrozenRows(1);
      }
    });
    const allowed = new Set((props.getProperty('IKEY_DB_ALLOWED_TABLES') || 'Projects')
      .split(',').map(value => value.trim()).filter(Boolean));
    definitions.forEach(def => allowed.add(def.name));
    props.setProperty('IKEY_DB_ALLOWED_TABLES', Array.from(allowed).join(','));
    SpreadsheetApp.flush();
    return {
      success: true,
      created_or_verified: definitions.map(def => def.name),
      allowed_tables: Array.from(allowed)
    };
  } finally {
    lock.releaseLock();
  }
}
