/**
 * iKey Gen3 dedicated Apps Script deployment (not the legacy database API).
 * Script Properties: GEN3_SPREADSHEET_ID, GEN3_API_KEY
 * Deploy as Web App executing as owner, with restricted access where possible.
 * API key must be 32+ random bytes; never commit it to GitHub.
 * WARNING: Apps Script Web Apps may redirect; do not log credentials.
 */
const TABS = Object.freeze({
 users:"Gen3_Users", sessions:"Auth_Sessions", audit:"Auth_Audit_Logs", tokens:"Auth_Tokens"
});
const HEADERS = Object.freeze({
 Gen3_Users:["user_id","email","password_hash","display_name","global_role","account_status","failed_login_attempts","locked_until","created_at","updated_at","google_sub","google_linked_at","email_verified_at","username"],
 Auth_Tokens:["token_id","user_id","token_hash","purpose","target_email","created_at","expires_at","used_at"],
 Auth_Sessions:["session_id","user_id","session_token_hash","created_at","expires_at","last_seen_at","revoked_at","revoked_reason"],
 Auth_Audit_Logs:["audit_id","user_id","event_type","result","auth_method","ip_address","user_agent","details","created_at"]
});
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
   const email=String(p.user?.email||"").trim().toLowerCase();
   if(!email || !p.user?.user_id || !p.user?.password_hash || !/^scrypt:v1:/.test(p.user.password_hash) || rows(TABS.users).some(r=>r.value.email.toLowerCase()===email || (p.user.username && r.value.username.toLowerCase()===p.user.username.toLowerCase())))return null;
   if(!/^[a-z][a-z0-9_]{3,23}$/.test(String(p.user.username||"")))throw Error("INVALID_USERNAME");
   if(p.user.global_role!=="user" || p.user.account_status!=="pending_verification" || p.user.email!==email)throw Error("INVALID_REGISTRATION");
   append(TABS.users,p.user);return {user_id:p.user.user_id};
  });
  case "findByGoogleSub":return rows(TABS.users).find(r=>r.value.google_sub===String(p.sub||"") && !!r.value.google_sub)?.value||null;
  case "registerGoogleAtomic":return locked(()=>{
   const u=p.user||{};
   if(!u.google_sub||!u.user_id||!u.email||!u.email.includes("@")||u.global_role!=="user"||u.account_status!=="active"||!u.email_verified_at)throw Error("INVALID_GOOGLE_ACCOUNT");
   const all=rows(TABS.users);
   if(all.some(r=>r.value.google_sub===u.google_sub||r.value.email.toLowerCase()===u.email.toLowerCase()))return null;
   append(TABS.users,u);return u;
  });
  case "linkGoogleAtomic":return locked(()=>{
   const all=rows(TABS.users),r=all.find(x=>x.value.user_id===p.user_id);
   if(!r||r.value.account_status!=="active"||!p.sub||all.some(x=>x.value.google_sub===p.sub && x.value.user_id!==p.user_id))return null;
   if(r.value.google_sub && r.value.google_sub!==p.sub)return null;
   r.value.google_sub=p.sub;r.value.google_linked_at=new Date().toISOString();r.value.updated_at=r.value.google_linked_at;
   overwrite(TABS.users,r.index,r.value);return r.value;
  });
  case "throttleAtomic":return locked(()=>{
   const key=String(p.key||"");
   const limit=Number(p.limit),windowMs=Number(p.window_ms);
   if(!/^[a-f0-9]{64}$/.test(key)||!Number.isInteger(limit)||limit<1||limit>100||windowMs<1000||windowMs>86400000)throw Error("INVALID_RATE_LIMIT");
   const r=rows(TABS.tokens).find(x=>x.value.purpose==="rate_limit"&&x.value.token_hash===key);
   const now=Date.now();
   if(!r){append(TABS.tokens,{token_id:Utilities.getUuid(),user_id:"1",token_hash:key,purpose:"rate_limit",target_email:"",created_at:new Date(now).toISOString(),expires_at:new Date(now+windowMs).toISOString(),used_at:""});return true;}
   if(Date.parse(r.value.expires_at)<=now){r.value.user_id="1";r.value.created_at=new Date(now).toISOString();r.value.expires_at=new Date(now+windowMs).toISOString();overwrite(TABS.tokens,r.index,r.value);return true;}
   const n=Number(r.value.user_id||0);
   if(n>=limit)return false;
   r.value.user_id=String(n+1);overwrite(TABS.tokens,r.index,r.value);return true;
  });
  case "health":return (()=>{
   // Read-only release gate: require the dedicated schema and authorized MailApp.
   Object.values(TABS).forEach(name=>sheet(name));
   const quota=MailApp.getRemainingDailyQuota();
   return {version:"gen3-mailapp-v2",storage:true,mail_ready:Number.isFinite(quota)&&quota>0};
  })();
  case "sendMail":return locked(()=>{
   const to=String(p.to||"").trim().toLowerCase();
   const subject=String(p.subject||""),body=String(p.body||"");
   const match=body.match(/^請在 (15|30) 分鐘內開啟連結(重設密碼|驗證電子郵件)：\nhttps:\/\/ikey\.onrender\.com\/gen3\/(reset-password|verify-email)\.html\?token=([A-Za-z0-9_-]{40,128})$/);
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)||to.length>254||body.length>3000||!match)throw Error("INVALID_MAIL");
   const purpose=match[2]==="重設密碼"?"reset_password":"verify_email";
   if(match[1]!== (purpose==="reset_password"?"15":"30") ||
      match[3]!== (purpose==="reset_password"?"reset-password":"verify-email") ||
      subject!==(purpose==="reset_password"?"iKey 密碼重設":"iKey 電子郵件驗證"))throw Error("INVALID_MAIL");
   const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,match[4],Utilities.Charset.UTF_8);
   const hash=bytes.map(b=>("0"+(b&255).toString(16)).slice(-2)).join("");
   const token=rows(TABS.tokens).find(x=>x.value.token_hash===hash&&x.value.purpose===purpose&&!x.value.used_at&&
     x.value.target_email===to&&Date.parse(x.value.expires_at)>Date.now());
   if(!token)throw Error("INVALID_MAIL_TOKEN");
   const user=rows(TABS.users).find(x=>x.value.user_id===token.value.user_id)?.value;
   if(!user||user.email!==to||
      (purpose==="verify_email"?user.account_status!=="pending_verification":user.account_status!=="active"))throw Error("INVALID_MAIL_RECIPIENT");
   if(MailApp.getRemainingDailyQuota()<1)throw Error("MAIL_QUOTA_EXCEEDED");
   MailApp.sendEmail({to,subject,body,name:"iKey 智慧鑰匙管理系統"});
   return true;
  });
  case "createToken":return locked(()=>{
   const t=p.token||{};
   if(!t.token_hash||!t.user_id||!["verify_email","reset_password"].includes(t.purpose)||Date.parse(t.expires_at)<=Date.now())throw Error("INVALID_TOKEN");
   const u=rows(TABS.users).find(x=>x.value.user_id===t.user_id)?.value;
   if(!u||u.email!==t.target_email||u.account_status==="disabled")return false;
   append(TABS.tokens,t);return true;
  });
  case "consumeTokenAtomic":return locked(()=>{
   const r=rows(TABS.tokens).find(x=>x.value.token_hash===p.token_hash && x.value.purpose===p.purpose);
   if(!r||r.value.used_at||Date.parse(r.value.expires_at)<=Date.now())return null;
   const u=rows(TABS.users).find(x=>x.value.user_id===r.value.user_id);
   if(!u||u.value.email!==r.value.target_email||u.value.account_status==="disabled"||u.value.account_status==="pending_deletion")return null;
   if(p.purpose==="reset_password"){
    if(!/^scrypt:v1:/.test(String(p.password_hash||"")))throw Error("INVALID_PASSWORD_HASH");
    u.value.password_hash=p.password_hash;u.value.failed_login_attempts="0";u.value.locked_until="";u.value.account_status="active";
    u.value.updated_at=new Date().toISOString();overwrite(TABS.users,u.index,u.value);
    rows(TABS.sessions).filter(x=>x.value.user_id===u.value.user_id&&!x.value.revoked_at).forEach(x=>{
     x.value.revoked_at=new Date().toISOString();x.value.revoked_reason="password_reset";overwrite(TABS.sessions,x.index,x.value);
    });
   }else if(p.purpose==="verify_email"){
    u.value.email_verified_at=new Date().toISOString();
    if(u.value.account_status==="pending_verification")u.value.account_status="active";
    u.value.updated_at=new Date().toISOString();overwrite(TABS.users,u.index,u.value);
   }
   r.value.used_at=new Date().toISOString();overwrite(TABS.tokens,r.index,r.value);
   return {user_id:u.value.user_id};
  });
  case "findByLogin":return rows(TABS.users).find(r=>(r.value.email===String(p.identifier||"").trim().toLowerCase()||r.value.username.toLowerCase()===String(p.identifier||"").trim().toLowerCase()))?.value||null;
  case "findByEmail":return rows(TABS.users).find(r=>r.value.email===String(p.email||"").toLowerCase())?.value||null;
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

// Run this once from the Apps Script editor after setting Script Properties.
// Read-only: checks schema, MailApp permission and quota; never prints secrets.
function inspectGen3Setup() {
 const properties=PropertiesService.getScriptProperties();
 const report={
  spreadsheetIdConfigured:Boolean(properties.getProperty("GEN3_SPREADSHEET_ID")),
  apiKeyConfigured:String(properties.getProperty("GEN3_API_KEY")||"").length>=32,
  sheets:{},
  mailAuthorized:false,
  mailQuotaAvailable:false
 };
 for(const name of Object.values(TABS)){
  try{sheet(name);report.sheets[name]="ok"}
  catch(err){report.sheets[name]=String(err.message||"ERROR").startsWith("SCHEMA_MISMATCH")?"schema_mismatch":"not_accessible"}
 }
 try{
  const quota=MailApp.getRemainingDailyQuota();
  report.mailAuthorized=true;
  report.mailQuotaAvailable=Number.isFinite(quota)&&quota>0;
 }catch(err){
  // Do not log raw Apps Script errors; they may contain account or file details.
  const message=String(err&&err.message||"");
  report.mailError=/permission|authorization|authorized|scope|consent/i.test(message)
   ?"MAILAPP_PERMISSION_REQUIRED":"MAILAPP_CHECK_FAILED";
  report.mailAuthorized=false;
 }
 report.ready=report.spreadsheetIdConfigured&&report.apiKeyConfigured&&
  Object.values(report.sheets).every(v=>v==="ok")&&report.mailAuthorized&&report.mailQuotaAvailable;
 Logger.log(JSON.stringify(report));
 return report;
}

// Run this from the editor to request MailApp authorization or show the exact
// Apps Script execution error. Read-only: does NOT send any email.
function authorizeGen3MailApp() {
 const quota=MailApp.getRemainingDailyQuota();
 Logger.log(JSON.stringify({
  mailAuthorized:true,
  mailQuotaAvailable:Number.isFinite(quota)&&quota>0
 }));
 return quota>0;
}
