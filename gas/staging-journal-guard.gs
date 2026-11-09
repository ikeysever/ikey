'use strict';
// Staging-only fail-closed journal consistency utilities. No deployment or GAS writes.
// The source writer must hold the SAME script lock while updating source, journal and state.
// Recovery is deliberately manual: never auto-advance a cursor after an ambiguous failure.
var IKEY_JOURNAL_HEADERS_ = 'sequence,record_id,version,deleted,payload_json,occurred_at';
function ikeyJournalFail_(code){throw new Error(code);}
function ikeyJournalInt_(v){if(v===''||v===null||v===undefined||!Number.isSafeInteger(Number(v))||Number(v)<0)ikeyJournalFail_('JOURNAL_INVALID_NUMBER');return Number(v);}
function ikeyJournalAudit_(state,log){
 var header=log.getRange(1,1,1,6).getDisplayValues()[0].join(',');
 if(header!==IKEY_JOURNAL_HEADERS_)ikeyJournalFail_('JOURNAL_SCHEMA_INVALID');
 var states=state.getDataRange().getValues().filter(function(row){return row[0]==='revision';});
 if(states.length!==1)ikeyJournalFail_('JOURNAL_REVISION_INVALID');
 var committed=ikeyJournalInt_(states[0][1]);
 var rows=log.getDataRange().getValues(),last=0,committedCount=0;
 for(var i=1;i<rows.length;i++){
  var r=rows[i],seq=ikeyJournalInt_(r[0]);
  if(seq!==last+1||!String(r[1])||ikeyJournalInt_(r[2])!==seq||typeof r[3]!=='boolean')ikeyJournalFail_('JOURNAL_CORRUPT');
  try{var payload=JSON.parse(String(r[4]));if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error();}catch(e){ikeyJournalFail_('JOURNAL_CORRUPT');}
  last=seq;if(seq<=committed)committedCount++;
 }
 if(last!==committed||committedCount!==committed)ikeyJournalFail_('JOURNAL_PENDING_RECONCILIATION');
 return {revision:committed,rows:rows.length-1};
}
function ikeyJournalWrite_(args){
 // An external write-through handler must provide an idempotent source mutation.
 // This helper is NOT called by any production handler and does not deploy itself.
 if(!args||typeof args.mutateSource!=='function'||typeof args.openSheets!=='function'||typeof args.acquireLock!=='function')ikeyJournalFail_('JOURNAL_INVALID_HANDLER');
 if(typeof args.id!=='string'||!args.id||args.id.length>200||typeof args.deleted!=='boolean'||!args.value||typeof args.value!=='object'||Array.isArray(args.value))ikeyJournalFail_('JOURNAL_INVALID_CHANGE');
 var lock=args.acquireLock();
 if(!lock||!lock.tryLock(15000))ikeyJournalFail_('JOURNAL_BUSY');
 try{
  var sheets=args.openSheets(),audit=ikeyJournalAudit_(sheets.state,sheets.log);
  // No journal write if source mutation fails.
  args.mutateSource();
  var next=audit.revision+1;
  // Any failure after source mutation is ambiguous; fail closed until manual reconciliation.
  sheets.log.appendRow([next,args.id,next,args.deleted,JSON.stringify(args.value),new Date().toISOString()]);
  SpreadsheetApp.flush();
  var stateRows=sheets.state.getDataRange().getValues(),updated=false;
  for(var i=1;i<stateRows.length;i++)if(stateRows[i][0]==='revision'){sheets.state.getRange(i+1,2).setValue(next);updated=true;break;}
  if(!updated)ikeyJournalFail_('JOURNAL_REVISION_INVALID');
  SpreadsheetApp.flush();
  ikeyJournalAudit_(sheets.state,sheets.log);
  return {revision:next};
 }finally{lock.releaseLock();}
}

/**
 * Intent-first write for staging announcement handlers only.
 * Append the durable journal intent BEFORE mutating the source. A pending tail
 * blocks all sync reads until the operator reconciles source vs intent.
 * This is NOT a multi-sheet transaction, and is deliberately not auto-retried.
 * The caller must pass the actual announcement source mutation; this helper
 * does not install or override any production handler.
 */
function ikeyJournalWriteIntent_(args){
 if(!args||typeof args.openSheets!=='function'||typeof args.acquireLock!=='function'||typeof args.mutateSource!=='function')ikeyJournalFail_('JOURNAL_INVALID_HANDLER');
 if(typeof args.id!=='string'||!args.id||args.id.length>200||typeof args.deleted!=='boolean'||!args.value||typeof args.value!=='object'||Array.isArray(args.value))ikeyJournalFail_('JOURNAL_INVALID_CHANGE');
 var lock=args.acquireLock();
 if(!lock||!lock.tryLock(15000))ikeyJournalFail_('JOURNAL_BUSY');
 try{
  var sheets=args.openSheets(),audit=ikeyJournalAudit_(sheets.state,sheets.log);
  var next=audit.revision+1;
  if(!Number.isSafeInteger(next))ikeyJournalFail_('JOURNAL_REVISION_OVERFLOW');
  // The intent is visible to audit but is not committed until revision advances.
  sheets.log.appendRow([next,args.id,next,args.deleted,JSON.stringify(args.value),new Date().toISOString()]);
  SpreadsheetApp.flush();
  // If mutation or commit fails, leave the pending tail for manual recovery.
  args.mutateSource();
  SpreadsheetApp.flush();
  var rows=sheets.state.getDataRange().getValues(),matches=[];
  for(var i=1;i<rows.length;i++)if(rows[i][0]==='revision')matches.push(i+1);
  if(matches.length!==1)ikeyJournalFail_('JOURNAL_REVISION_INVALID');
  sheets.state.getRange(matches[0],2).setValue(next);
  SpreadsheetApp.flush();
  ikeyJournalAudit_(sheets.state,sheets.log);
  return {revision:next};
 }finally{lock.releaseLock();}
}
