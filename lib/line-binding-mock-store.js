'use strict';
// Test-only repository and exclusive call queue. Production never imports this.
const domain=require('./line-binding-domain');
const clone=x=>JSON.parse(JSON.stringify(x));
class MockLineBindingStore{
 constructor(){this.bindingRows=[];this.auditRows=[];this.users=new Map();this.sessions=new Map();this.queue=Promise.resolve();this.writes=0;this.failAt=0;}
 seed(userId,sessionHash='s-'+userId){const user={user_id:userId,account_status:'active',password_hash:'test-hash',global_role:'user'};this.users.set(userId,user);this.sessions.set(sessionHash,{user,session:{expires_at:new Date(9e12).toISOString(),revoked_at:''}});return sessionHash;}
 write(){if(++this.writes===this.failAt)throw Error('INJECTED_WRITE_FAILURE');}
 repository(){return {
  schema(){},bindings:()=>clone(this.bindingRows),logs:()=>clone(this.auditRows),actor:h=>this.sessions.get(h),user:id=>this.users.get(id),
  appendBinding:r=>{this.write();this.bindingRows.push(clone(r));},
  updateBinding:r=>{this.write();this.bindingRows[this.bindingRows.findIndex(x=>x.binding_id===r.binding_id)]=clone(r);},
  appendLog:r=>{this.write();this.auditRows.push(clone(r));},
  updateLog:r=>{this.write();this.auditRows[this.auditRows.findIndex(x=>x.audit_id===r.audit_id)]=clone(r);}
 };}
 invoke(action,p,now=Date.now()){
  const work=this.queue.then(()=>domain.execute(this.repository(),action,p,now));this.queue=work.catch(()=>{});return work;
 }
}
module.exports={MockLineBindingStore,TTL_MS:300000};
