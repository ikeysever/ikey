'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../gas/staging-journal-guard.gs'),'utf8');
function setup(){
 const sheet=rows=>({rows,getDataRange(){return {getValues:()=>this.rows.map(x=>x.slice())}},getRange(r,c,n=1,w=1){return {getDisplayValues:()=>rows.slice(r-1,r-1+n).map(x=>x.slice(c-1,c-1+w).map(String)),setValue:v=>{rows[r-1][c-1]=v}}},appendRow:x=>rows.push(x)});
 const state=sheet([['name','value'],['revision',0]]),log=sheet([['sequence','record_id','version','deleted','payload_json','occurred_at']]);
 const ctx={SpreadsheetApp:{flush:()=>{}},Date,JSON,Number,String,Error};vm.createContext(ctx);vm.runInContext(source,ctx);
 const write=(overrides={})=>ctx.ikeyJournalWrite_({id:'a',deleted:false,value:{title:'A'},mutateSource:()=>{},openSheets:()=>({state,log}),acquireLock:()=>({tryLock:()=>true,releaseLock:()=>{}}),...overrides});
 return {state,log,audit:()=>ctx.ikeyJournalAudit_(state,log),write,writeIntent:(overrides={})=>ctx.ikeyJournalWriteIntent_({id:'a',deleted:false,value:{title:'A'},mutateSource:()=>{},openSheets:()=>({state,log}),acquireLock:()=>({tryLock:()=>true,releaseLock:()=>{}}),...overrides})};
}
test('empty journal is valid',()=>assert.equal(setup().audit().revision,0));
test('valid committed journal entry',()=>{const t=setup();t.log.rows.push([1,'a',1,false,'{}','now']);t.state.rows[1][1]=1;assert.equal(t.audit().revision,1)});
test('pending append is not silently committed',()=>{const t=setup();t.log.rows.push([1,'a',1,false,'{}','now']);assert.throws(()=>t.audit(),/JOURNAL_PENDING_RECONCILIATION/)});
test('sequence gap is rejected',()=>{const t=setup();t.log.rows.push([2,'a',2,false,'{}','now']);t.state.rows[1][1]=2;assert.throws(()=>t.audit(),/JOURNAL_CORRUPT/)});
test('successful write-through commits journal and cursor',()=>{const t=setup();let n=0;assert.equal(t.write({mutateSource:()=>n++}).revision,1);assert.equal(n,1);assert.equal(t.audit().revision,1)});
test('source failure leaves journal untouched',()=>{const t=setup();assert.throws(()=>t.write({mutateSource:()=>{throw Error('source failed')}}),/source failed/);assert.equal(t.log.rows.length,1)});
test('journal append failure never advances cursor',()=>{const t=setup();t.log.appendRow=()=>{throw Error('append failed')};assert.throws(()=>t.write(),/append failed/);assert.equal(t.state.rows[1][1],0)});
test('blank revision is rejected',()=>{const t=setup();t.state.rows[1][1]='';assert.throws(()=>t.audit(),/JOURNAL_INVALID_NUMBER/)});

test('intent-first writer commits only after source mutation',()=>{
 const t=setup();let observed=0;
 assert.equal(t.writeIntent({mutateSource:()=>{observed=t.log.rows.length;}}).revision,1);
 assert.equal(observed,2);assert.equal(t.audit().revision,1);
});
test('failed source mutation leaves blocking pending intent',()=>{
 const t=setup();
 assert.throws(()=>t.writeIntent({mutateSource:()=>{throw Error('source failed')}}),/source failed/);
 assert.equal(t.state.rows[1][1],0);assert.equal(t.log.rows.length,2);
 assert.throws(()=>t.audit(),/JOURNAL_PENDING_RECONCILIATION/);
});
test('subsequent writes are rejected until pending intent reconciled',()=>{
 const t=setup();assert.throws(()=>t.writeIntent({mutateSource:()=>{throw Error('failed')}}),/failed/);
 assert.throws(()=>t.writeIntent(),/JOURNAL_PENDING_RECONCILIATION/);
 assert.equal(t.log.rows.length,2);
});
test('intent append failure never mutates source',()=>{
 const t=setup();let called=false;t.log.appendRow=()=>{throw Error('append failed')};
 assert.throws(()=>t.writeIntent({mutateSource:()=>{called=true}}),/append failed/);
 assert.equal(called,false);assert.equal(t.state.rows[1][1],0);
});
test('lock failure rejects before mutation',()=>{
 const t=setup();let called=false;
 assert.throws(()=>t.writeIntent({mutateSource:()=>{called=true},acquireLock:()=>({tryLock:()=>false,releaseLock:()=>{}})}),/JOURNAL_BUSY/);
 assert.equal(called,false);
});
