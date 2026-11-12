'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../gen3-auth/project-invitation-redemption.gs'),'utf8');
const projectId='11111111-1111-4111-8111-111111111111',owner='22222222-2222-4222-8222-222222222222',actor='33333333-3333-4333-8333-333333333333',other='44444444-4444-4444-8444-444444444444',hash='a'.repeat(64);
const schemas={
 Projects:['project_id','created_by_user_id','status'],
 Project_Invitations:['invitation_id','project_id','created_by_user_id','token_hash','role','expires_at','status','created_at','redeemed_by_user_id','membership_id'],
 Project_Memberships:['membership_id','project_id','user_id','role','status','created_at']
};
function harness({failAppend=false,failFlush=false,failFlushOn=0,failSetOn=0}={}){
 const data={
  Projects:[[projectId,owner,'active']],
  Project_Invitations:[['55555555-5555-4555-8555-555555555555',projectId,owner,hash,'member','2099-01-01T00:00:00Z','pending','2026-11-12T00:00:00Z','','']],
  Project_Memberships:[]
 };
 let locked=false,appendFailures=failAppend?1:0,flushFailures=failFlush?1:0,flushCount=0,setCount=0,next=0;
 function sheet(name){
  const headers=schemas[name],rows=data[name];
  return {
   getLastRow(){return rows.length+1},
   getRange(row,col,n=1,width=1){return {
    getValues(){return rows.slice(row-2,row-2+n).map(r=>r.slice(col-1,col-1+width))},
    setValue(v){setCount++;if(setCount===failSetOn)throw Error('SET_FAILED');rows[row-2][col-1]=v}
   }},
   appendRow(values){if(appendFailures-- >0)throw Error('APPEND_FAILED');rows.push(values.slice())}
  };
 }
 const sheets=Object.fromEntries(Object.keys(data).map(k=>[k,sheet(k)]));
 const context={
  ikeyDbSheet_:name=>sheets[name],
  ikeyDbHeaders_:s=>Object.keys(sheets).map(k=>[sheets[k],schemas[k]]).find(x=>x[0]===s)[1],
  ikeyDbRecord_:(headers,values)=>Object.fromEntries(headers.map((h,i)=>[h,values[i]])),
  LockService:{getScriptLock(){return {tryLock(){if(locked)return false;locked=true;return true},releaseLock(){locked=false}}}},
  SpreadsheetApp:{flush(){flushCount++;if(flushFailures-- >0||flushCount===failFlushOn)throw Error('FLUSH_FAILED')}},
  Utilities:{getUuid(){next++;return '66666666-6666-4666-8666-'+String(next).padStart(12,'0')}},
  Date,Error,String,Number,Array,Object
 };
 vm.createContext(context);vm.runInContext(code,context);
 return {redeem:(user=actor)=>context.ikeyRedeemInvitation_({actor_user_id:user,token_hash:hash}),data};
}
test('one redemption creates exactly one membership and finalizes invitation',()=>{
 const h=harness(),result=h.redeem();
 assert.equal(result.redeemed,true);
 assert.equal(h.data.Project_Memberships.length,1);
 assert.equal(h.data.Project_Invitations[0][6],'redeemed');
 assert.throws(()=>h.redeem(),/INVITATION_EXPIRED_OR_USED/);
});
test('failed append can be retried by same actor but not stolen',()=>{
 const h=harness({failAppend:true});
 assert.throws(()=>h.redeem(),/APPEND_FAILED/);
 assert.equal(h.data.Project_Invitations[0][6],'redeeming');
 assert.throws(()=>h.redeem(other),/INVITATION_RESERVED_BY_OTHER_USER/);
 const result=h.redeem();
 assert.equal(h.data.Project_Memberships.length,1);
 assert.equal(result.membership_id,h.data.Project_Memberships[0][0]);
 assert.equal(h.data.Project_Invitations[0][6],'redeemed');
});
test('failure on initial reservation flush remains recoverable',()=>{
 const h=harness({failFlush:true});
 assert.throws(()=>h.redeem(),/FLUSH_FAILED/);
 assert.equal(h.data.Project_Invitations[0][6],'redeeming');
 h.redeem();
 assert.equal(h.data.Project_Memberships.length,1);
});
test('duplicate membership and altered project owner fail closed',()=>{
 const h=harness();
 h.data.Project_Memberships.push(['77777777-7777-4777-8777-777777777777',projectId,actor,'member','active','2026-11-12T00:00:00Z']);
 assert.throws(()=>h.redeem(),/INVITATION_ALREADY_MEMBER/);
 const x=harness();x.data.Projects[0][1]=other;
 assert.throws(()=>x.redeem(),/INVITATION_PROJECT_UNVERIFIED/);
});

test('failure after membership append recovers without duplicate membership',()=>{
 const h=harness({failFlushOn:2});
 assert.throws(()=>h.redeem(),/FLUSH_FAILED/);
 assert.equal(h.data.Project_Invitations[0][6],'redeeming');
 assert.equal(h.data.Project_Memberships.length,1);
 h.redeem();
 assert.equal(h.data.Project_Memberships.length,1);
 assert.equal(h.data.Project_Invitations[0][6],'redeemed');
});
test('failure while finalizing invitation recovers existing membership',()=>{
 const h=harness({failFlushOn:3});
 assert.throws(()=>h.redeem(),/FLUSH_FAILED/);
 assert.equal(h.data.Project_Memberships.length,1);
 // Sheet mutation can be visible even when flush reports an error.
 // A retry must never append a second membership.
 assert.throws(()=>h.redeem(),/INVITATION_EXPIRED_OR_USED/);
 assert.equal(h.data.Project_Memberships.length,1);
});

test('partial reservation actor write recovers with same user and rejects another',()=>{
 const h=harness({failSetOn:2});
 assert.throws(()=>h.redeem(),/SET_FAILED/);
 assert.equal(h.data.Project_Invitations[0][6],'pending');
 assert.equal(h.data.Project_Invitations[0][8],actor);
 assert.throws(()=>h.redeem(other),/INVITATION_RESERVED_BY_OTHER_USER/);
 h.redeem();
 assert.equal(h.data.Project_Memberships.length,1);
 assert.equal(h.data.Project_Invitations[0][6],'redeemed');
});
test('partial reservation ID write reuses original membership ID',()=>{
 const h=harness({failSetOn:3});
 assert.throws(()=>h.redeem(),/SET_FAILED/);
 const original=h.data.Project_Invitations[0][9];
 assert.match(original,/^[0-9a-f-]{36}$/);
 h.redeem();
 assert.equal(h.data.Project_Memberships.length,1);
 assert.equal(h.data.Project_Memberships[0][0],original);
});
