/** iKey staging-only atomic invitation redemption. Called only through keyed doPost dispatch. */
function ikeyRedeemInvitation_(p){
 const actor=String(p.actor_user_id||''),tokenHash=String(p.token_hash||'');
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 if(!uuid.test(actor)||!/^[a-f0-9]{64}$/i.test(tokenHash))throw Error('INVITATION_INVALID');
 const invitations=ikeyDbSheet_('Project_Invitations'),members=ikeyDbSheet_('Project_Memberships'),projects=ikeyDbSheet_('Projects');
 const ih=ikeyDbHeaders_(invitations),mh=ikeyDbHeaders_(members),ph=ikeyDbHeaders_(projects);
 function requireColumns(headers,keys){if(keys.some(k=>headers.indexOf(k)<0))throw Error('INVITATION_SCHEMA_INVALID');}
 requireColumns(ih,['invitation_id','project_id','created_by_user_id','token_hash','role','expires_at','status','created_at']);
 requireColumns(mh,['membership_id','project_id','user_id','role','status','created_at']);
 requireColumns(ph,['project_id','created_by_user_id','status']);
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(15000))throw Error('INVITATION_BUSY');
 try{
  function read(sheet,headers){const last=sheet.getLastRow();return last<2?[]:sheet.getRange(2,1,last-1,headers.length).getValues().map((values,i)=>({row:i+2,value:ikeyDbRecord_(headers,values)}));}
  const matching=read(invitations,ih).filter(x=>x.value.token_hash===tokenHash);
  if(matching.length!==1)throw Error('INVITATION_NOT_FOUND');
  const invite=matching[0],v=invite.value;
  if(v.status!=='pending'||v.role!=='member'||!uuid.test(String(v.project_id||''))||!uuid.test(String(v.created_by_user_id||''))||!Number.isFinite(Date.parse(v.expires_at))||Date.parse(v.expires_at)<=Date.now())throw Error('INVITATION_EXPIRED_OR_USED');
  const project=read(projects,ph).filter(x=>x.value.project_id===v.project_id);
  if(project.length!==1||project[0].value.created_by_user_id!==v.created_by_user_id||project[0].value.status!=='active')throw Error('INVITATION_PROJECT_UNVERIFIED');
  if(actor===v.created_by_user_id)throw Error('INVITATION_OWNER_ALREADY_MEMBER');
  const existing=read(members,mh).filter(x=>x.value.project_id===v.project_id&&x.value.user_id===actor);
  if(existing.length)throw Error('INVITATION_ALREADY_MEMBER');
  const id=Utilities.getUuid(),createdAt=new Date().toISOString();
  const membership={membership_id:id,project_id:v.project_id,user_id:actor,role:'member',status:'active',created_at:createdAt};
  const values=mh.map(h=>Object.prototype.hasOwnProperty.call(membership,h)?membership[h]:'');
  // Mark the token used first under the same script lock. A failed append cannot permit replay.
  invitations.getRange(invite.row,ih.indexOf('status')+1).setValue('redeemed');
  SpreadsheetApp.flush();
  members.appendRow(values);
  SpreadsheetApp.flush();
  return {redeemed:true,project_id:v.project_id,membership_id:id,role:'member'};
 }finally{lock.releaseLock();}
}
