'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=fs.readFileSync(require.resolve('../gas/device-command-trust.gs'),'utf8');
const ctx={};vm.createContext(ctx);vm.runInContext(src,ctx);
function ledger(rows){
 const data=[['nonce','expires_at'],...rows];
 return {data,getLastRow:()=>data.length,getRange:(r,c,n)=>({getValues:()=>data.slice(r-1,r-1+n).map(x=>x.slice(c-1,c+1))}),deleteRow:r=>data.splice(r-1,1)};
}
test('nonce pruning deletes only rows older than 24h past expiry',()=>{
 const now=200000000;
 const l=ledger([['expired',now-86400001],['boundary',now-86400000],['recent',now-1000],['bad','invalid']]);
 assert.equal(ctx.ikeyCommandNoncePruneLocked_(l,now,20),1);
 assert.deepEqual(l.data.map(r=>r[0]),['nonce','boundary','recent','bad']);
});
test('nonce pruning has strict batch limit and fails closed on invalid inputs',()=>{
 const now=200000000;
 const l=ledger([['a',0],['b',0],['c',0]]);
 assert.equal(ctx.ikeyCommandNoncePruneLocked_(l,now,2),2);
 assert.equal(l.data.length,2);
 assert.throws(()=>ctx.ikeyCommandNoncePruneLocked_(l,now,501),/COMMAND_REPLAY_MAINTENANCE_INVALID/);
});
