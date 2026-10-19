/**
 * iKey Gen3 dedicated Apps Script deployment (not the legacy database API).
 * Script Properties: GEN3_SPREADSHEET_ID, GEN3_API_KEY
 * Deploy as Web App executing as owner, with restricted access where possible.
 * API key must be 32+ random bytes; never commit it to GitHub.
 * WARNING: Apps Script Web Apps may redirect; do not log credentials.
 */
const TABS = Object.freeze({
 users:"Gen3_Users", sessions:"Auth_Sessions", audit:"Auth_Audit_Logs", tokens:"Auth_Tokens", requests:"Project_Requests", history:"Project_Review_History",settings:"Project_Settings",members:"Project_Members"
});
const HEADERS = Object.freeze({
 Gen3_Users:["user_id","password_hash","display_name","global_role","account_status","failed_login_attempts","locked_until","created_at","updated_at","username"],
 Auth_Tokens:["token_id","user_id","token_hash","purpose","created_at","expires_at","used_at"],
 Auth_Sessions:["session_id","user_id","session_token_hash","created_at","expires_at","last_seen_at","revoked_at","revoked_reason"],
 Auth_Audit_Logs:["audit_id","user_id","event_type","result","auth_method","ip_address","user_agent","details","created_at"],
 Project_Requests:["request_id","project_id","user_id","request_type","request_status","reviewed_by","created_at","reviewed_at","project_name","project_description"],
 Project_Review_History:["history_id","request_id","actor_user_id","event_type","from_status","to_status","note","created_at"],
 Project_Settings:["request_id","purpose","theme","sound","mode","updated_at"],
 Project_Members:["request_id","member_user_id","member_role","created_at"]
});
const AUTH_TABS = [TABS.users, TABS.sessions, TABS.audit, TABS.tokens];
function respond(data){return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON)}
function sheet(name) {
 const id=PropertiesService.getScriptProperties().getProperty("GEN3_SPREADSHEET_ID");
 if(!id)throw Error("DATABASE_NOT_CONFIGURED");
 const tab=SpreadsheetApp.openById(id).getSheetByName(name);
 if(!tab)throw Error("MISSING_SHEET_"+name);
 const expected=HEADERS[name];
 if(expected) {
  const actual=tab.getRange(1,1,1,expected.length).getValues()[0];
  if(expected.some((v,i)=>actual[i]!==v))throw Error("SCHEMA_MISMATCH_"+name);
 }
 return tab;
}
function rows(name) {
 const tab=sheet(name),n=tab.getLastRow();
 if(n<2)return [];
 const headers=HEADERS[name],data=tab.getRange(2,1,n-1,headers.length).getValues();
 return data.map((r,i)=>({index:i+2,value:Object.fromEntries(headers.map((h,j)=>[h,String(r[j]??"")]))}));
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
 switch(action) {
  case "registerAtomic":return locked(()=>{
   const u=p.user||{},username=String(u.username||"").trim().toLowerCase();
   if(!/^[a-z][a-z0-9_]{3,23}$/.test(username))throw Error("INVALID_USERNAME");
   if(!u.user_id||!/^scrypt:v1:/.test(String(u.password_hash||""))||
      !String(u.display_name||"").trim()||String(u.display_name).length>80||
      u.global_role!=="user"||u.account_status!=="active"||u.username!==username)
      throw Error("INVALID_REGISTRATION");
   if(rows(TABS.users).some(r=>r.value.username.toLowerCase()===username))return null;
   append(TABS.users,u);return {user_id:u.user_id};
  });
  case "throttleAtomic":return locked(()=>{
   const key=String(p.key||"");
   const limit=Number(p.limit),windowMs=Number(p.window_ms);
   if(!/^[a-f0-9]{64}$/.test(key)||!Number.isInteger(limit)||limit<1||limit>100||windowMs<1000||windowMs>86400000)throw Error("INVALID_RATE_LIMIT");
   const r=rows(TABS.tokens).find(x=>x.value.purpose==="rate_limit"&&x.value.token_hash===key);
   const now=Date.now();
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
  case "findByLogin":return rows(TABS.users).find(r=>r.value.username.toLowerCase()===String(p.identifier||"").trim().toLowerCase())?.value||null;
  case "findById":return rows(TABS.users).find(r=>r.value.user_id===p.user_id)?.value||null;
  case "recordLoginFailureAtomic":return locked(()=>{
   const r=rows(TABS.users).find(x=>x.value.user_id===p.user_id);
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
   const r=rows(TABS.users).find(x=>x.value.user_id===p.user_id);
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
   const r=rows(TABS.users).find(x=>x.value.user_id===userId);
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
   const u=rows(TABS.users).find(x=>x.value.user_id===p.session.user_id)?.value;
   if(!u || u.account_status!=="active")throw Error("ACCOUNT_UNAVAILABLE");
   append(TABS.sessions,p.session);return true;
  });
  case "findSessionByHash":return rows(TABS.sessions).find(x=>x.value.session_token_hash===p.hash)?.value||null;
  case "touchSession":return locked(()=>{
   const r=rows(TABS.sessions).find(x=>x.value.session_id===p.session_id);
   if(!r||r.value.revoked_at||Date.parse(r.value.expires_at)<=Date.now())return false;
   const u=rows(TABS.users).find(x=>x.value.user_id===r.value.user_id)?.value;
   if(!u||u.account_status!=="active")return false;
   r.value.expires_at=p.expires_at;r.value.last_seen_at=p.last_seen_at;
   overwrite(TABS.sessions,r.index,r.value);return true;
  });
  case "revokeSession":return locked(()=>{
   const r=rows(TABS.sessions).find(x=>x.value.session_id===p.session_id);
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
function doPost(e) {
 try {
  const data=JSON.parse(e.postData?.contents||"{}");
  const secret=PropertiesService.getScriptProperties().getProperty("GEN3_API_KEY");
  if(!secret || secret.length<32 || data.api_key!==secret)return respond({ok:false,error:"UNAUTHORIZED"});
  return respond({ok:true,result:execute(data.action,data.payload||{})});
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
