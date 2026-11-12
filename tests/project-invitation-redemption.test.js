'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createInvitationRedemptionHandler}=require('../lib/project-invitation-redemption-handler');
const actor='11111111-1111-4111-8111-111111111111',projectId='22222222-2222-4222-8222-222222222222',membershipId='33333333-3333-4333-8333-333333333333',token=Buffer.alloc(24,7).toString('base64url');
async function invoke({user=actor,value={redeemed:true,project_id:projectId,membership_id:membershipId,role:'member'},throws=false,invitation_token=token}={}){
 const calls=[];
 const store={async projectCall(action,payload){calls.push({action,payload});if(throws)throw Error('not deployed');return value;}};
 const res={code:200,headers:{},set(k,v){this.headers[k]=v;return this;},status(n){this.code=n;return this;},json(v){this.body=v;return this;}};
 await createInvitationRedemptionHandler(store)({projectUser:{user_id:user},body:{invitation_token}},res);
 return {res,calls};
}
test('redeem uses only atomic GAS action and sends hash not raw token',async()=>{
 const {res,calls}=await invoke();
 assert.equal(res.code,200);assert.equal(res.headers['Cache-Control'],'no-store');
 assert.equal(calls.length,1);assert.equal(calls[0].action,'project.invitation.redeem');
 assert.equal(calls[0].payload.actor_user_id,actor);
 assert.match(calls[0].payload.token_hash,/^[a-f0-9]{64}$/);
 assert.equal(JSON.stringify(calls).includes(token),false);
});
test('invalid token never reaches GAS',async()=>{
 for(const invitation_token of ['invalid','',null,42]){
  const {res,calls}=await invoke({invitation_token});assert.equal(res.code,400);assert.equal(calls.length,0);
 }
});
test('GAS unavailable or response unverified fails closed',async()=>{
 for(const opts of [{throws:true},{value:{redeemed:false}},{value:null}]){
  const {res}=await invoke(opts);assert.equal(res.code,503);assert.equal(res.body.success,false);
 }
});
test('redemption route and GAS handler require a lock',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const root=path.join(__dirname,'..');
 const gas=fs.readFileSync(path.join(root,'gen3-auth/project-invitation-redemption.gs'),'utf8');
 const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
 assert.match(gas,/LockService\.getScriptLock\(\)/);
 assert.match(gas,/status'\)\+1\)\.setValue\('redeemed'\)/);
 assert.match(gas,/members\.appendRow\(values\)/);
 assert.match(server,/app\.post\('\/api\/project-invitations\/redeem',requireProjectUser/);
});

test('malformed or forged GAS redemption receipt fails closed',async()=>{
 for(const value of [
  {redeemed:true,project_id:'not-a-uuid',membership_id:membershipId,role:'member'},
  {redeemed:true,project_id:projectId,membership_id:'not-a-uuid',role:'member'},
  {redeemed:true,project_id:projectId,membership_id:membershipId,role:'owner'}
 ]){
  const {res}=await invoke({value});
  assert.equal(res.code,503);
  assert.equal(res.body.code,'INVITATION_REDEMPTION_UNVERIFIED');
 }
});
