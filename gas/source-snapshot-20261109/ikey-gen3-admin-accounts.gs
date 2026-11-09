/** iKey Gen3 Admin Accounts addon — STAGING ONLY.
 * Add this as a separate .gs file to the SAME Apps Script project.
 * Requires existing TABS, rows, findRow, overwrite, append, locked, execute.
 * Dispatch ONLY the allowlisted actions below from authenticated doPost.
 * Never log actor_session_hash or password_hash.
 */
// IKEY_ADMIN_ACCOUNT_ACTIONS is declared in 程式碼.gs.
function iKeyAdminActor_(p) {
  const hash = String(p.actor_session_hash || '');
  if (!/^[a-f0-9]{64}$/.test(hash)) throw Error('ADMIN_SESSION_REQUIRED');
  const s = findRow(TABS.sessions,'session_token_hash',hash)?.value;

const expires = s ? Date.parse(s.expires_at) : NaN;
if (!s || s.revoked_at ||
    !Number.isFinite(expires) ||
    expires <= Date.now()) {
  throw Error('ADMIN_SESSION_INVALID');
}

  const actor = findRow(TABS.users,'user_id',s.user_id)?.value;
 
if (!actor || actor.account_status !== 'active' || actor.global_role !== 'super_admin') {
  throw Error('ADMIN_FORBIDDEN');
}

  return actor;
}
function iKeyAdminPublic_(u) {
  return {user_id:u.user_id,username:u.username,display_name:u.display_name,
    global_role:u.global_role,account_status:u.account_status,created_at:u.created_at};
}
function iKeyAdminRevoke_(userId, reason) {
  let count=0, now=new Date().toISOString();
  rows(TABS.sessions).forEach(r=>{
    if(r.value.user_id===userId && !r.value.revoked_at){
      r.value.revoked_at=now;r.value.revoked_reason=reason;
      overwrite(TABS.sessions,r.index,r.value);count++;
    }
  });
  return count;
}
function iKeyAdminAudit_(actor,target,action,detail) {
  append(TABS.audit,{audit_id:Utilities.getUuid(),user_id:actor.user_id,
    event_type:action,result:'success',auth_method:'session',ip_address:'',
    user_agent:'',details:JSON.stringify({target_user_id:target.user_id,...detail}),
    created_at:new Date().toISOString()});
}
function iKeyAdminLastAdmin_(target) {
  if(target.global_role!=='admin'||target.account_status!=='active')return false;
  return rows(TABS.users).filter(r=>r.value.global_role==='admin'&&r.value.account_status==='active').length<=1;
}
function executeAdminAccount(action,p) {
  const allowedActions = [
  'adminAccountList',
  'adminAccountSetStatus',
  'adminAccountSetRole',
  'adminAccountRevokeSessions',
  'adminAccountResetPassword'
];


if (!allowedActions.includes(action)) {
  throw Error('ADMIN_ACTION_DENIED');
}

  if(action==='adminAccountList') {
    iKeyAdminActor_(p);
    const limit=Number(p.limit||50);
    if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('ADMIN_LIMIT_INVALID');
    return {accounts:rows(TABS.users).slice(0,limit).map(r=>iKeyAdminPublic_(r.value)),limited:rows(TABS.users).length>limit};
  }
  return locked(()=>{
    const actor=iKeyAdminActor_(p);
    const id=String(p.target_user_id||'');
    if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('ADMIN_TARGET_INVALID');
    const targetRow=findRow(TABS.users,'user_id',id);
    if(!targetRow)throw Error('ADMIN_TARGET_NOT_FOUND');
    const target=targetRow.value;
    if(target.user_id===actor.user_id)throw Error('ADMIN_SELF_ACTION_DENIED');
    const now=new Date().toISOString();
    let revoked=0, detail={};
    if(action==='adminAccountSetStatus') {
      const status=String(p.status||'');
      if(!['active','disabled'].includes(status))throw Error('ADMIN_STATUS_INVALID');
      if(status==='disabled'&&iKeyAdminLastAdmin_(target))throw Error('ADMIN_LAST_ADMIN');
      if(target.account_status===status)throw Error('ADMIN_NO_CHANGE');
      target.account_status=status;
      if(status==='active'){target.locked_until='';target.failed_login_attempts='0';}
      target.updated_at=now;
      overwrite(TABS.users,targetRow.index,target);
      if(status==='disabled')revoked=iKeyAdminRevoke_(id,'admin_account_disabled');
      detail={status};
    } else if(action==='adminAccountSetRole') {
      const role=String(p.role||'');
      if(!['user','admin'].includes(role))throw Error('ADMIN_ROLE_INVALID');
      if(target.global_role===role)throw Error('ADMIN_NO_CHANGE');
      if(role==='user'&&iKeyAdminLastAdmin_(target))throw Error('ADMIN_LAST_ADMIN');
      target.global_role=role;target.updated_at=now;
      overwrite(TABS.users,targetRow.index,target);
      revoked=iKeyAdminRevoke_(id,'admin_role_changed');detail={role};
    } else if(action==='adminAccountRevokeSessions') {
      revoked=iKeyAdminRevoke_(id,'admin_forced_logout');
    } else if(action==='adminAccountResetPassword') {
      const hash=String(p.password_hash||'');
      // Hash generated and validated by the trusted Render server, never by the browser.
      if(!/^scrypt:v1:[^\s]{20,512}$/.test(hash))throw Error('ADMIN_PASSWORD_HASH_INVALID');
      target.password_hash=hash;target.updated_at=now;
      target.failed_login_attempts='0';target.locked_until='';
      overwrite(TABS.users,targetRow.index,target);
      revoked=iKeyAdminRevoke_(id,'admin_password_reset');
    }
    iKeyAdminAudit_(actor,target,action,detail);
    return {success:true,target:iKeyAdminPublic_(target),revoked_sessions:revoked};
  });
}


