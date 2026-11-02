'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {EXISTING,NEW,planCommandSheets}=require('../scripts/plan-command-sheets-offline');
test('offline plan creates exactly four header-only tabs without mutating baseline',()=>{
 const before=[...EXISTING];const original=JSON.stringify(before);
 const plan=planCommandSheets(before);
 assert.deepEqual(plan.map(s=>s.name),Object.keys(NEW));
 assert.deepEqual(plan.map(s=>s.headers.length),[10,15,6,2]);
 for(const sheet of plan){assert.deepEqual(sheet.rows,[sheet.headers]);}
 assert.equal(JSON.stringify(before),original);
});
test('offline plan rejects conflicting tab names and missing baseline',()=>{
 assert.throws(()=>planCommandSheets([...EXISTING,'DeviceCommands']),/COMMAND_SHEET_NAME_CONFLICT/);
 assert.throws(()=>planCommandSheets(EXISTING.slice(1)),/BASELINE_SHEETS_MISSING/);
 assert.throws(()=>planCommandSheets([...EXISTING,EXISTING[0]]),/INVALID_EXISTING_SHEETS/);
});
