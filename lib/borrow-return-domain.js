'use strict';
// Pure borrow/return transition validation. No database writes or device commands.
const STATES=Object.freeze({AVAILABLE:'available',BORROWED:'borrowed'});
function transition(action,slot,actorId,now){
 if(action!=='borrow'&&action!=='return')return {ok:false,code:'INVALID_ACTION'};
 if(!slot||typeof slot!=='object'||slot.is_active!==true)return {ok:false,code:'SLOT_INACTIVE'};
 if(typeof actorId!=='string'||!actorId.trim())return {ok:false,code:'INVALID_ACTOR'};
 if(typeof now!=='string'||!Number.isFinite(Date.parse(now)))return {ok:false,code:'INVALID_TIMESTAMP'};
 if(action==='borrow'){
  if(slot.status!==STATES.AVAILABLE)return {ok:false,code:'SLOT_NOT_AVAILABLE'};
  if(slot.borrower_id!=null)return {ok:false,code:'INCONSISTENT_SLOT'};
  return {ok:true,next:{status:STATES.BORROWED,borrower_id:actorId,borrowed_at:now},event:'borrow'};
 }
 if(slot.status!==STATES.BORROWED)return {ok:false,code:'SLOT_NOT_BORROWED'};
 if(typeof slot.borrower_id!=='string'||!slot.borrower_id)return {ok:false,code:'INCONSISTENT_SLOT'};
 if(slot.borrower_id!==actorId)return {ok:false,code:'NOT_BORROWER'};
 return {ok:true,next:{status:STATES.AVAILABLE,borrower_id:null,borrowed_at:null},event:'return'};
}
module.exports={STATES,transition};
