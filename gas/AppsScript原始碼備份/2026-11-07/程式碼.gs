/**
 * iKey Gen3 V14 DIAGNOSTIC CANDIDATE (based on supplied V12 candidate).
 * Does not alter Sheets schema, credentials, session rules, or login semantics.
 * Deploy only after comparing this source against the ACTUAL V13 editor source.
 * Detailed timings appear in Apps Script Executions logs, NOT Render logs.
 * Keep GEN3_FAST_LOOKUP and GEN3_FAST_LOGIN as currently configured.
 */
/**
 * iKey Gen3 dedicated Apps Script deployment (not the legacy database API).
 * Script Properties: GEN3_SPREADSHEET_ID, GEN3_API_KEY
 * Deploy as Web App executing as owner, with restricted access where possible.
 * API key must be 32+ random bytes; never commit it to GitHub.
 * WARNING: Apps Script Web Apps may redirect; do not log credentials.
 */
const TABS = Object.freeze({
 users:"Gen3_Users", sessions:"Auth_Sessions", audit:"Auth_Audit_Logs", tokens:"Auth_Tokens", requests:"Project_Requests", history:"Project_Review_History",settings:"Project_Settings",members:"Project_Members",access:"Project_Access"
});
const HEADERS = Object.freeze({
 Gen3_Users:["user_id","password_hash","display_name","global_role","account_status","failed_login_attempts","locked_until","created_at","updated_at","username"],
 Auth_Tokens:["token_id","user_id","token_hash","purpose","created_at","expires_at","used_at"],
 Auth_Sessions:["session_id","user_id","session_token_hash","created_at","expires_at","last_seen_at","revoked_at","revoked_reason"],
 Auth_Audit_Logs:["audit_id","user_id","event_type","result","auth_method","ip_address","user_agent","details","created_at"],
 Project_Requests:["request_id","project_id","user_id","request_type","request_status","reviewed_by","created_at","reviewed_at","project_name","project_description"],
 Project_Review_History:["history_id","request_id","actor_user_id","event_type","from_status","to_status","note","created_at"],
 Project_Settings:["request_id","purpose","theme","sound","mode","updated_at"],
 Project_Members:["request_id","member_user_id","member_role","created_at"],
 Projects:["project_id","project_name","description","created_by_user_id","authorization_method","scheduled_authorization","status","created_at","updated_at","notification_theme","notification_sound_pack","notification_volume"],
 Project_Access:["entry_id","project_id","entry_type","user_id","role","status","invite_hash","join_policy","created_at","updated_at","reviewed_by"]
});
const AUTH_TABS = [TABS.users, TABS.sessions, TABS.audit, TABS.tokens];
function respond(data){return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON)}
let _spreadsheet = null;
const _sheetCache = Object.create(null);
function sheet(name) {
 if (_sheetCache[name]) return _sheetCache[name];
 const id=PropertiesService.getScriptProperties().getProperty("GEN3_SPREADSHEET_ID");
 if(!id)throw Error("DATABASE_NOT_CONFIGURED");
 const tab=(_spreadsheet || (_spreadsheet=SpreadsheetApp.openById(id))).getSheetByName(name);
 if(!tab)throw Error("MISSING_SHEET_"+name);
 const expected=HEADERS[name];
 if(expected) {
  const actual=tab.getRange(1,1,1,expected.length).getValues()[0];
  if(expected.some((v,i)=>actual[i]!==v))throw Error("SCHEMA_MISMATCH_"+name);
 }
 return (_sheetCache[name]=tab);
}
function rows(name) {
 const tab=sheet(name),n=tab.getLastRow();
 if(n<2)return [];
 const headers=HEADERS[name],data=tab.getRange(2,1,n-1,headers.length).getValues();
 return data.map((r,i)=>({index:i+2,value:Object.fromEntries(headers.map((h,j)=>[h,String(r[j]??"")]))}));
}
// Fast lookup by a single column instead of loading the entire sheet on every auth request.
// Use matchEntireCell to prevent prefix collisions. Never cache user/session state across requests.
function findRow(name, field, value, caseInsensitive=false) {
 const headers=HEADERS[name],col=headers.indexOf(field)+1;
 if(!col)throw Error("UNKNOWN_LOOKUP_FIELD");
 const tab=sheet(name),last=tab.getLastRow();
 if(last<2)return null;
 const finder=tab.getRange(2,col,last-1,1).createTextFinder(String(value??""))
   .matchEntireCell(true).matchCase(!caseInsensitive).useRegularExpression(false);
 const found=finder.findNext();
 if(!found)return null;
 const index=found.getRow();
 const cells=tab.getRange(index,1,1,headers.length).getValues()[0];
 return {index,value:Object.fromEntries(headers.map((h,j)=>[h,String(cells[j]??"")]))};
}
function cellText(value) {
 const s=String(value??"");
 return /^\s*[=+\-@]/.test(s) ? "'"+s : s;
}
function append(name,value) {
 const tab=sheet(name);
 tab.appendRow(HEADERS[name].map(h=>cellText(value[h])));
}
function overwrite(name,index,value) {
 const tab=sheet(name);
 tab.getRange(index,1,1,HEADERS[name].length).setValues([HEADERS[name].map(h=>cellText(value[h]))]);
}
function locked(fn) {
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(25000))throw Error("DATABASE_BUSY");
 try{return fn()}finally{lock.releaseLock()}
}

function execute(action,p) {
  // iKey 3.1 — Device Command Dispatcher
  if ([
    'deviceCommandCreateAtomic',
    'deviceCommandClaimAtomic',
    'deviceCommandReportAtomic',
    'deviceCommandGet'
  ].includes(action)) {
    if (typeof ikeyDeviceCommandAction !== 'function') {
      throw Error('COMMAND_HANDLER_NOT_INSTALLED');
    }
    return ikeyDeviceCommandAction(action,p);
  }

  switch(action) {

  case "registerAtomic":return locked(()=>{
   const u=p.user||{},username=String(u.username||"").trim().toLowerCase();
   if(!/^[a-z][a-z0-9_]{3,23}$/.test(username))throw Error("INVALID_USERNAME");
   if(!u.user_id||!/^scrypt:v1:/.test(String(u.password_hash||""))||
      !String(u.display_name||"").trim()||String(u.display_name).length>80||
      u.global_role!=="user"||u.account_status!=="active"||u.username!==username)
      throw Error("INVALID_REGISTRATION");
   if(Boolean(findRow(TABS.users,"username",username,true)))return null;
   append(TABS.users,u);return {user_id:u.user_id};
  });
  // V12: one remote request for shared rate limiting and credential lookup.
  // Keep the rate-limit mutation under the same script lock; do not cache credentials.
  case "loginLookupAtomic":return locked(()=>{
   const key=String(p.key||""), identifier=String(p.identifier||"").trim().toLowerCase();
   const limit=Number(p.limit),windowMs=Number(p.window_ms);
   if(!/^[a-f0-9]{64}$/.test(key)||!/^[a-z][a-z0-9_]{3,23}$/.test(identifier)||
      !Number.isInteger(limit)||limit<1||limit>100||windowMs<1000||windowMs>86400000)
      throw Error("INVALID_LOGIN_LOOKUP");
   const r=findRow(TABS.tokens,"token_hash",key);
   const now=Date.now();
   if(r && r.value.purpose!=="rate_limit")throw Error("RATE_LIMIT_TOKEN_COLLISION");
   let allowed=true;
   if(!r){
     append(TABS.tokens,{token_id:Utilities.getUuid(),user_id:"1",token_hash:key,purpose:"rate_limit",created_at:new Date(now).toISOString(),expires_at:new Date(now+windowMs).toISOString(),used_at:""});
   }else if(Date.parse(r.value.expires_at)<=now){
     r.value.user_id="1";r.value.created_at=new Date(now).toISOString();r.value.expires_at=new Date(now+windowMs).toISOString();overwrite(TABS.tokens,r.index,r.value);
   }else{
     const n=Number(r.value.user_id||0);
     if(n>=limit)allowed=false;
     else {r.value.user_id=String(n+1);overwrite(TABS.tokens,r.index,r.value);}
   }
   if(!allowed)return {allowed:false,user:null};
   return {allowed:true,user:findRow(TABS.users,"username",identifier,true)?.value||null};
  });
  case "throttleAtomic":return locked(()=>{
   const key=String(p.key||"");
   const limit=Number(p.limit),windowMs=Number(p.window_ms);
   if(!/^[a-f0-9]{64}$/.test(key)||!Number.isInteger(limit)||limit<1||limit>100||windowMs<1000||windowMs>86400000)throw Error("INVALID_RATE_LIMIT");
   const r=findRow(TABS.tokens,"token_hash",key);
   const now=Date.now();
   if(r && r.value.purpose!=="rate_limit")throw Error("RATE_LIMIT_TOKEN_COLLISION");
   if(!r){append(TABS.tokens,{token_id:Utilities.getUuid(),user_id:"1",token_hash:key,purpose:"rate_limit",created_at:new Date(now).toISOString(),expires_at:new Date(now+windowMs).toISOString(),used_at:""});return true;}
   if(Date.parse(r.value.expires_at)<=now){r.value.user_id="1";r.value.created_at=new Date(now).toISOString();r.value.expires_at=new Date(now+windowMs).toISOString();overwrite(TABS.tokens,r.index,r.value);return true;}
   const n=Number(r.value.user_id||0);
   if(n>=limit)return false;
   r.value.user_id=String(n+1);overwrite(TABS.tokens,r.index,r.value);return true;
  });
  case "health":return (()=>{
   AUTH_TABS.forEach(name=>sheet(name));
   return {version:"gen3-username-v3",storage:true};
  })();
  case "findByLogin":return findRow(TABS.users,"username",String(p.identifier||"").trim().toLowerCase(),true)?.value||null;
  case "findById":return findRow(TABS.users,"user_id",p.user_id)?.value||null;
  case "recordLoginFailureAtomic":return locked(()=>{
   const r=findRow(TABS.users,"user_id",p.user_id);
   if(!r)return null;
   const u=r.value;
   if(u.account_status==="disabled"||u.account_status==="pending_deletion")return null;
   const until=Date.parse(u.locked_until||"");
   if(u.account_status==="temporarily_locked"&&until>Date.now())return u;
   const attempts=Number(u.failed_login_attempts||0)+1;
   u.failed_login_attempts=String(attempts);
   if(attempts>=5){u.account_status="temporarily_locked";u.locked_until=new Date(Date.now()+15*60000).toISOString();}
   u.updated_at=new Date().toISOString();overwrite(TABS.users,r.index,u);return u;
  });
  case "recordLoginSuccessAtomic":return locked(()=>{
   const r=findRow(TABS.users,"user_id",p.user_id);
   if(!r)return null;
   const u=r.value;
   if(u.account_status==="disabled"||u.account_status==="pending_deletion")return null;
   if(u.account_status==="temporarily_locked") {
    if(Date.parse(u.locked_until||"")>Date.now())return null;
    u.account_status="active";u.locked_until="";
   }
   
   if(u.account_status!=="active")return null;
   u.failed_login_attempts="0";u.updated_at=new Date().toISOString();
   overwrite(TABS.users,r.index,u);return u;
  });
  case "completeLoginAtomic":return locked(()=>{
   const userId=String(p.user_id||""),session=p.session||{};
   if(!userId||session.user_id!==userId||!session.session_id||!session.session_token_hash||!session.expires_at)throw Error("INVALID_LOGIN_COMPLETION");
   const r=findRow(TABS.users,"user_id",userId);
   if(!r)return null;
   const u=r.value;
   if(u.account_status==="disabled"||u.account_status==="pending_deletion")return null;
   if(u.account_status==="temporarily_locked"){
     if(Date.parse(u.locked_until||"")>Date.now())return null;
     u.account_status="active";u.locked_until="";
   }
   if(u.account_status!=="active")return null;
   // Complete all security-critical writes under one Apps Script lock.
   // The session is appended last so no successful session exists without an audit record.
   u.failed_login_attempts="0";u.updated_at=new Date().toISOString();
   overwrite(TABS.users,r.index,u);
   append(TABS.audit,{audit_id:Utilities.getUuid(),user_id:userId,event_type:"login",result:"success",auth_method:"password",ip_address:"",user_agent:"",details:"",created_at:new Date().toISOString()});
   append(TABS.sessions,session);
   return u;
  });
  case "createSession":return locked(()=>{
   const u=findRow(TABS.users,"user_id",p.session.user_id)?.value;
   if(!u || u.account_status!=="active")throw Error("ACCOUNT_UNAVAILABLE");
   append(TABS.sessions,p.session);return true;
  });
  // Single remote request for session + current user. No cross-request auth cache.
  case "resolveSession":return (()=>{
   const hash=String(p.hash||"");
   if(!/^[a-f0-9]{64}$/.test(hash))return null;
   const session=findRow(TABS.sessions,"session_token_hash",hash)?.value;
   if(!session||session.revoked_at||Date.parse(session.expires_at)<=Date.now())return null;
   const user=findRow(TABS.users,"user_id",session.user_id)?.value;
   if(!user)return null;
   return {session,user};
  })();
  // Look up and revoke the exact token in a single locked execution.
  case "revokeSessionByHash":return locked(()=>{
   const hash=String(p.hash||"");
   if(!/^[a-f0-9]{64}$/.test(hash))return false;
   const r=findRow(TABS.sessions,"session_token_hash",hash);
   if(!r)return false;
   if(r.value.revoked_at)return true;
   r.value.revoked_at=new Date().toISOString();r.value.revoked_reason="logout";
   overwrite(TABS.sessions,r.index,r.value);
   return true;
  });
  case "findSessionByHash":return findRow(TABS.sessions,"session_token_hash",p.hash)?.value||null;
  case "touchSession":return locked(()=>{
   const r=findRow(TABS.sessions,"session_id",p.session_id);
   if(!r||r.value.revoked_at||Date.parse(r.value.expires_at)<=Date.now())return false;
   const u=findRow(TABS.users,"user_id",r.value.user_id)?.value;
   if(!u||u.account_status!=="active")return false;
   r.value.expires_at=p.expires_at;r.value.last_seen_at=p.last_seen_at;
   overwrite(TABS.sessions,r.index,r.value);return true;
  });
  case "revokeSession":return locked(()=>{
   const r=findRow(TABS.sessions,"session_id",p.session_id);
   if(!r)return false;
   r.value.revoked_at=new Date().toISOString();r.value.revoked_reason=p.reason||"logout";
   overwrite(TABS.sessions,r.index,r.value);return true;
  });
  case "audit":return locked(()=>{
   const v=p.event||{};
   append(TABS.audit,{audit_id:Utilities.getUuid(),user_id:v.user_id||"",event_type:v.event_type||"",
    result:v.result||"",auth_method:v.auth_method||"",ip_address:"",
    user_agent:"",details:"",created_at:new Date().toISOString()});return true;
  });
  case "projectDraftSave":return locked(()=>{
   const actor=String(p.actor_user_id||"").trim(),d=p.draft||{};
   const name=String(d.project_name||"").trim(),description=String(d.project_description||"").trim();
   const id=String(d.request_id||"").trim();
   const cfg=d.settings||{},members=Array.isArray(d.members)?d.members:[];
   const purpose=String(cfg.purpose||"").trim(),theme=String(cfg.theme||"").trim(),sound=String(cfg.sound||"").trim(),mode=String(cfg.mode||"").trim();
   if(!["tools","shared_box","consumables","parts","medicine","custom"].includes(mode)||purpose.length>2000||theme.length>60||sound.length>60||members.length>50)throw Error("INVALID_PROJECT_SETTINGS");
   const ids=new Set();
   for(const m of members){const uid=String(m.user_id||"").trim(),role=String(m.role||"").trim();if(!/^[a-zA-Z0-9_-]{1,100}$/.test(uid)||!["member","manager","viewer"].includes(role)||ids.has(uid))throw Error("INVALID_PROJECT_MEMBER");ids.add(uid)}
   sheet(TABS.settings);sheet(TABS.members);
   const persist=(rid)=>{
     const now=new Date().toISOString(),v={request_id:rid,purpose,theme,sound,mode,updated_at:now};
     const old=rows(TABS.settings).find(x=>x.value.request_id===rid);
     if(old)overwrite(TABS.settings,old.index,v);else append(TABS.settings,v);
     const tab=sheet(TABS.members);
     const existing=rows(TABS.members).filter(x=>x.value.request_id===rid);
     for(const row of existing.slice().reverse())tab.deleteRow(row.index);
     for(const m of members)append(TABS.members,{request_id:rid,member_user_id:String(m.user_id).trim(),member_role:String(m.role),created_at:now});
   };
   if(!actor||!rows(TABS.users).some(r=>r.value.user_id===actor&&r.value.account_status==="active"))throw Error("ACTOR_NOT_ACTIVE");
   if(!name||name.length>100||description.length>2000||(id&&!/^[a-zA-Z0-9_-]{1,100}$/.test(id)))throw Error("INVALID_PROJECT_DRAFT");
   const existing=id?rows(TABS.requests).find(r=>r.value.request_id===id):null;
   if(id&&!existing)throw Error("REQUEST_NOT_FOUND");
   if(existing){
    if(existing.value.user_id!==actor)throw Error("REQUEST_FORBIDDEN");
    if(existing.value.request_status!=="draft")throw Error("REQUEST_NOT_EDITABLE");
    existing.value.project_name=name;existing.value.project_description=description;
    overwrite(TABS.requests,existing.index,existing.value);
    persist(id);
    return {request_id:id,request_status:"draft"};
   }
   const requestId=Utilities.getUuid(),now=new Date().toISOString();
   append(TABS.requests,{request_id:requestId,project_id:"",user_id:actor,request_type:"create",request_status:"draft",reviewed_by:"",created_at:now,reviewed_at:"",project_name:name,project_description:description});
   persist(requestId);
   append(TABS.history,{history_id:Utilities.getUuid(),request_id:requestId,actor_user_id:actor,event_type:"draft_created",from_status:"",to_status:"draft",note:"",created_at:now});
   return {request_id:requestId,request_status:"draft"};
  });
  case "projectRequestsMine":return (()=>{
   const actor=String(p.actor_user_id||"");
   if(!actor)throw Error("INVALID_ACTOR");
   const settings=rows(TABS.settings),members=rows(TABS.members);return rows(TABS.requests).filter(r=>r.value.user_id===actor).map(r=>({...r.value,settings:settings.find(s=>s.value.request_id===r.value.request_id)?.value||null,members:members.filter(m=>m.value.request_id===r.value.request_id).map(m=>m.value)}));
  })();
  case "projectRequestSubmit":return locked(()=>{
   const actor=String(p.actor_user_id||""),id=String(p.request_id||"");
   if(!actor||!id||!/^[a-zA-Z0-9_-]{1,100}$/.test(id))throw Error("INVALID_REQUEST");
   const r=rows(TABS.requests).find(x=>x.value.request_id===id);
   if(!r)throw Error("REQUEST_NOT_FOUND");
   if(r.value.user_id!==actor)throw Error("REQUEST_FORBIDDEN");
   if(r.value.request_status!=="draft")throw Error("REQUEST_NOT_SUBMITTABLE");
   const now=new Date().toISOString();
   r.value.request_status="pending";
   overwrite(TABS.requests,r.index,r.value);
   append(TABS.history,{history_id:Utilities.getUuid(),request_id:id,actor_user_id:actor,event_type:"submitted",from_status:"draft",to_status:"pending",note:"",created_at:now});
   return {request_id:id,request_status:"pending"};
  });
  case "projectReviewHistoryMine":return (()=>{
   const actor=String(p.actor_user_id||""),id=String(p.request_id||"");
   if(!actor||!id)throw Error("INVALID_REQUEST");
   const request=rows(TABS.requests).find(x=>x.value.request_id===id)?.value;
   if(!request)throw Error("REQUEST_NOT_FOUND");
   if(request.user_id!==actor)throw Error("REQUEST_FORBIDDEN");
   return rows(TABS.history).filter(r=>r.value.request_id===id).map(r=>r.value);
  })();
  default:throw Error("UNKNOWN_ACTION");
 }
}
// V14 diagnostic-only instrumentation: no user data, credentials, token hashes, or row values.
// Per-execution metrics only; no cross-request cache or data-model changes.
let _gen3Profile = null;
function gen3ProfileCall(name, fn, args) {
  if (!_gen3Profile) return fn.apply(null, args);
  const started = Date.now();
  try { return fn.apply(null, args); }
  finally {
    const stat = _gen3Profile[name] || (_gen3Profile[name] = {calls:0,total_ms:0,max_ms:0});
    const ms = Date.now() - started;
    stat.calls++; stat.total_ms += ms; stat.max_ms = Math.max(stat.max_ms, ms);
  }
}
const _gen3SheetOriginal = sheet;
sheet = function(name) { return gen3ProfileCall('sheet', _gen3SheetOriginal, [name]); };
const _gen3FindRowOriginal = findRow;
findRow = function(name, field, value, caseInsensitive) {
  return gen3ProfileCall('findRow', _gen3FindRowOriginal, [name,field,value,caseInsensitive]);
};
const _gen3AppendOriginal = append;
append = function(name, value) { return gen3ProfileCall('append', _gen3AppendOriginal, [name,value]); };
const _gen3OverwriteOriginal = overwrite;
overwrite = function(name, index, value) { return gen3ProfileCall('overwrite', _gen3OverwriteOriginal, [name,index,value]); };
const _gen3LockedOriginal = locked;
locked = function(fn) { return gen3ProfileCall('locked', _gen3LockedOriginal, [fn]); };
// Only fixed operation names; never log dynamic request payloads.
const GEN3_PROFILE_ACTIONS = Object.freeze({
  loginLookupAtomic:true, completeLoginAtomic:true, resolveSession:true,
  revokeSessionByHash:true, throttleAtomic:true, findByLogin:true
});

// Dedicated access actions are NOT generic db.* operations.
// project-data.gs must be present in the same Apps Script project.
const IKEY_PROJECT_ACCESS_ACTIONS_ = Object.freeze([
  'projectSettingsUpdate', 'projectAccessConfigure', 'projectAccessJoin',
  'projectAccessMine', 'projectAccessGet', 'projectAccessList',
  'projectAccessReview'
]);

// Editor-only read-only schema check. Does not expose Project_Access through db.*.
function iKey_CheckProjectAccessIntegration() {
  if (typeof executeProjectAccess !== 'function') throw Error('PROJECT_DATA_GS_MISSING');
  const required = ['Projects', TABS.access];
  const result = {};
  required.forEach(name => {
    sheet(name);
    result[name] = 'PASS';
  });
  Logger.log(JSON.stringify({integration: 'PASS', tables: result}));
  return result;
}

function doPost(e) {
 try {
  const data=JSON.parse(e.postData?.contents||"{}");
  const secret=PropertiesService.getScriptProperties().getProperty("GEN3_API_KEY");
  if(!secret || secret.length<32 || data.api_key!==secret)return respond({ok:false,error:"UNAUTHORIZED"});
  const start=Date.now();
  const action=String(data.action||"");
  _gen3Profile = GEN3_PROFILE_ACTIONS[action] ? Object.create(null) : null;
  try {
    const payload = data.payload && typeof data.payload === 'object' && !Array.isArray(data.payload)
      ? data.payload
      : {};
    const IKEY_PROJECT_ACTIONS = [
  'projectCreate',
  'projectListMine',
  'projectAccessConfigure',
  'projectAccessJoin',
  'projectAccessMine',
  'projectAccessGet',
  'projectAccessList',
  'projectAccessReview',
  'projectSettingsUpdate'
];

const IKEY_DEVICE_ACTIONS = [
  'factoryDeviceRegister',
  'factoryDeviceCredentialGet',
  'factoryDeviceBind',
  'factoryDeviceList',
  'factoryDeviceUpdate'
];


const IKEY_ADMIN_ACCOUNT_ACTIONS = [
  'adminAccountList',
  'adminAccountSetStatus',
  'adminAccountSetRole',
  'adminAccountRevokeSessions',
  'adminAccountResetPassword'
];



const result = action.startsWith('db.')
  ? ikeyDbDispatch_(action, payload)
  : IKEY_DEVICE_ACTIONS.includes(action)
    ? ikeyFactoryDeviceAction(action, payload)
    : IKEY_PROJECT_ACTIONS.includes(action)
      ? executeProjectAccess(action, payload)
      : IKEY_ADMIN_ACCOUNT_ACTIONS.includes(action)
        ? executeAdminAccount(action, payload)
        : execute(action, payload);

    if (_gen3Profile) console.info("Gen3 V14 profile", JSON.stringify({
      action, total_ms:Date.now()-start, steps:_gen3Profile
    }));
    else console.info("Gen3 action timing",action,Date.now()-start,"ms");
    return respond({ok:true,result});
  } finally { _gen3Profile=null; }
 } catch(err){return respond({ok:false,error:String(err.message||"INTERNAL_ERROR")})}
}

// Read-only setup inspection. Never log secrets or personal data.
function inspectGen3Setup(){
 const props=PropertiesService.getScriptProperties();
 const report={spreadsheetIdConfigured:Boolean(props.getProperty("GEN3_SPREADSHEET_ID")),
  apiKeyConfigured:String(props.getProperty("GEN3_API_KEY")||"").length>=32,sheets:{}};
 for(const name of AUTH_TABS){
  try{sheet(name);report.sheets[name]="ok"}
  catch(err){report.sheets[name]=String(err.message||"ERROR").startsWith("SCHEMA_MISMATCH")?"schema_mismatch":"not_accessible"}
 }
 report.ready=report.spreadsheetIdConfigured&&report.apiKeyConfigured&&Object.values(report.sheets).every(v=>v==="ok");
 Logger.log(JSON.stringify(report));return report;
}

/* iKey 3.1 generic Sheets engine — integrated into Gen3 V14 candidate.
 * Keeps existing GEN3_SPREADSHEET_ID and GEN3_API_KEY.
 * Optional Script Property IKEY_DB_ALLOWED_TABLES defaults to Projects.
  * For announcements, append System_Announcements and System_Announcement_Reads
  * to the existing comma-separated allowlist in the GAS Script Properties.
  * Preserve all existing allowed tables; this source edit does not change deployment properties.
 * Never expose the GAS API key to the browser.
 */
const IKEY_DB_ACTIONS_=['db.health','db.schema','db.select','db.insert','db.update','db.delete'];
const IKEY_DB_PROTECTED_=['Users','Gen3_Users','Auth_Tokens','Auth_Sessions','Auth_Audit_Logs'];
function ikeyDbDispatch_(action,p){
  if(IKEY_DB_ACTIONS_.indexOf(action)<0)throw Error('DB_ACTION_DENIED');
  const db=SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('GEN3_SPREADSHEET_ID'));
  if(action==='db.health')return {ready:true,engine:'ikey-db-v1'};
  const allowed=(PropertiesService.getScriptProperties().getProperty('IKEY_DB_ALLOWED_TABLES')||'Projects').split(',').map(x=>x.trim());
  const name=p.table;
  if(typeof name!=='string'||allowed.indexOf(name)<0||IKEY_DB_PROTECTED_.indexOf(name)>=0)throw Error('DB_TABLE_DENIED');
  const tab=db.getSheetByName(name);
  if(!tab)throw Error('DB_TABLE_NOT_FOUND');
  const n=tab.getLastColumn();
  if(n<1||n>80)throw Error('DB_SCHEMA_INVALID');
  const columns=tab.getRange(1,1,1,n).getDisplayValues()[0].map(x=>x.trim());
  if(columns.some(x=>!/^[a-z][a-z0-9_]*$/.test(x))||new Set(columns).size!==columns.length)throw Error('DB_SCHEMA_INVALID');
  if(action==='db.schema')return {table:name,columns};
  const toRecord=row=>Object.fromEntries(columns.map((key,i)=>[key,row[i]]));
  const where=p.where;
  function predicate(){
    if(!where||typeof where!=='object'||Array.isArray(where))throw Error('DB_WHERE_REQUIRED');
    const keys=Object.keys(where);
    if(keys.length<1||keys.length>4||keys.some(k=>columns.indexOf(k)<0||where[k]===null||typeof where[k]==='object'))throw Error('DB_WHERE_INVALID');
    return row=>keys.every(k=>String(row[k])===String(where[k]));
  }
  function validate(data){
    if(!data||typeof data!=='object'||Array.isArray(data))throw Error('DB_DATA_INVALID');
    const keys=Object.keys(data);
    if(!keys.length||keys.some(k=>columns.indexOf(k)<0))throw Error('DB_FIELD_DENIED');
    for(const k of keys){
      const v=data[k];
      const maxLength=(name==='System_Announcements'&&k==='content')?10000:2000;
       if(!['string','number','boolean'].includes(typeof v)||String(v).length>maxLength||(typeof v==='number'&&!Number.isFinite(v)))throw Error('DB_VALUE_INVALID');
      if(typeof v==='string'&&/^[=+@\-\t\r]/.test(v))throw Error('DB_FORMULA_DENIED');
    }
    return keys;
  }
  function values(){
    const last=tab.getLastRow();
    return last<2?[]:tab.getRange(2,1,last-1,n).getValues().map(toRecord);
  }
  if(action==='db.select'){
    const matches=predicate();
    const limit=p.limit===undefined?50:Number(p.limit);
    if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('DB_LIMIT_INVALID');
    const rows=values().filter(matches).slice(0,limit);
    return {rows,count:rows.length};
  }
  // All mutating operations share the SAME script lock as existing Gen3 auth actions.
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(25000))throw Error('DATABASE_BUSY');
  try{
    if(action==='db.insert'){
      validate(p.data);
      if(typeof p.primary_key!=='string'||columns.indexOf(p.primary_key)<0||!p.data[p.primary_key])throw Error('DB_PRIMARY_KEY_REQUIRED');
      if(values().some(row=>String(row[p.primary_key])===String(p.data[p.primary_key])))throw Error('DB_DUPLICATE_KEY');
      const record=Object.fromEntries(columns.map(k=>[k,Object.prototype.hasOwnProperty.call(p.data,k)?p.data[k]:'']));
      tab.getRange(tab.getLastRow()+1,1,1,n).setValues([columns.map(k=>record[k])]);
      SpreadsheetApp.flush();
      return {inserted:true,record};
    }
    const keys=Object.keys(where||{});
    if(keys.length!==1||!/_id$/.test(keys[0]))throw Error('DB_UNIQUE_ID_REQUIRED');
    const matches=predicate();
    const all=values();
    const indices=[];
    all.forEach((row,i)=>{if(matches(row))indices.push(i+2)});
    if(indices.length!==1)throw Error(indices.length?'DB_NOT_UNIQUE':'DB_NOT_FOUND');
    const row=indices[0];
    if(action==='db.update'){
      const fields=validate(p.data);
      if(fields.some(k=>/_id$/.test(k)))throw Error('DB_PRIMARY_KEY_IMMUTABLE');
      fields.forEach(k=>tab.getRange(row,columns.indexOf(k)+1).setValue(p.data[k]));
      SpreadsheetApp.flush();return {updated:true};
    }
    if(action==='db.delete'){
      if(columns.indexOf('status')<0)throw Error('DB_SOFT_DELETE_UNSUPPORTED');
      tab.getRange(row,columns.indexOf('status')+1).setValue('deleted');
      SpreadsheetApp.flush();return {deleted:true,soft_deleted:true};
    }
    throw Error('DB_ACTION_DENIED');
  }finally{lock.releaseLock()}
}

function iKey_TestCommandDispatcherSafe() {
  const actions = [
    'deviceCommandCreateAtomic',
    'deviceCommandClaimAtomic',
    'deviceCommandReportAtomic',
    'deviceCommandGet'
  ];

  const results = {};

  actions.forEach(action => {
    try {
      execute(action, {});
      results[action] = 'FAIL_UNEXPECTED_ACCEPT';
    } catch (err) {
      const code = String(err.message || err);
      results[action] =
        code === 'INVALID_REQUEST'
          ? 'PASS_REJECTED'
          : 'CHECK_' + code;
    }
  });

  Logger.log(JSON.stringify(results));
  return results;
}


