"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"apps-script","Code.gs"),"utf8");
test("Apps Script parses without stray escaped newline sequences",()=>{
  assert.doesNotThrow(()=>new vm.Script(source,{filename:"Code.gs"}));
});
test("Sheets formula injection guard protects untrusted text",()=>{
  const ctx=vm.createContext({});
  new vm.Script(source).runInContext(ctx);
  for(const value of ["=1+1","+SUM(1,2)","-1+2","@cmd","  =HYPERLINK(\"x\")"]){
    assert.equal(ctx.cellText(value),"'"+value);
  }
  assert.equal(ctx.cellText("普通姓名"),"普通姓名");
});
test("legacy tab names are not part of Gen3 write target schema",()=>{
  for(const name of ["Users","Classes","Classrooms","Schedules","Slot_Status","Borrow_Records","Devices","System_Logs","Projects","Project_Memberships","Project_Requests"]){
    assert.equal(source.includes('append("'+name+'"'),false);
  }
});

test("MailApp health and token-bound delivery reject spoofing, replay, and expiry",()=>{
 const crypto=require("node:crypto");
 const raw="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-";
 const hash=crypto.createHash("sha256").update(raw).digest("hex");
 const user={user_id:"u1",email:"student@example.com",account_status:"pending_verification"};
 const token={token_hash:hash,user_id:"u1",target_email:user.email,purpose:"verify_email",used_at:"",
   expires_at:new Date(Date.now()+30*60000).toISOString()};
 const columns={
  Gen3_Users:["user_id","email","password_hash","display_name","global_role","account_status","failed_login_attempts","locked_until","created_at","updated_at","google_sub","google_linked_at","email_verified_at","username"],
  Auth_Tokens:["token_id","user_id","token_hash","purpose","target_email","created_at","expires_at","used_at"],
  Auth_Sessions:["session_id","user_id","session_token_hash","created_at","expires_at","last_seen_at","revoked_at","revoked_reason"],
  Auth_Audit_Logs:["audit_id","user_id","event_type","result","auth_method","ip_address","user_agent","details","created_at"]
 };
 const tables=Object.fromEntries(Object.entries(columns).map(([name,headers])=>[name,[headers]]));
 tables.Gen3_Users.push(columns.Gen3_Users.map(k=>user[k]||""));
 tables.Auth_Tokens.push(columns.Auth_Tokens.map(k=>token[k]||""));
 const sent=[];
 const ctx=vm.createContext({
  MailApp:{getRemainingDailyQuota:()=>10,sendEmail:x=>sent.push(x)},
  LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},
  PropertiesService:{getScriptProperties:()=>({getProperty:()=> "test-spreadsheet"})},
  SpreadsheetApp:{openById:()=>({getSheetByName:name=>tables[name]?{
    getLastRow:()=>tables[name].length,
    getRange:(row,col,n,w)=>({getValues:()=>tables[name].slice(row-1,row-1+n).map(x=>x.slice(col-1,col-1+w))})
  }:null})},
  Utilities:{DigestAlgorithm:{SHA_256:"sha256"},Charset:{UTF_8:"utf8"},
    computeDigest:(_,value)=>Array.from(crypto.createHash("sha256").update(value).digest())}
 });
 new vm.Script(source).runInContext(ctx);
 assert.equal(ctx.execute("health",{}).version,"gen3-mailapp-v2");
 const subject="iKey 電子郵件驗證";
 const body="請在 30 分鐘內開啟連結驗證電子郵件：\nhttps://ikey.onrender.com/gen3/verify-email.html?token="+raw;
 assert.equal(ctx.execute("sendMail",{to:user.email,subject,body}),true);
 assert.equal(sent.length,1);
 assert.throws(()=>ctx.execute("sendMail",{to:"other@example.com",subject,body}),/INVALID_MAIL_TOKEN/);
 assert.throws(()=>ctx.execute("sendMail",{to:user.email,subject:"iKey 密碼重設",body}),/INVALID_MAIL/);
 assert.throws(()=>ctx.execute("sendMail",{to:user.email,subject,body:body.replace(raw,"x".repeat(64))}),/INVALID_MAIL_TOKEN/);
 tables.Auth_Tokens[1][columns.Auth_Tokens.indexOf("used_at")]=new Date().toISOString();
 assert.throws(()=>ctx.execute("sendMail",{to:user.email,subject,body}),/INVALID_MAIL_TOKEN/);
 tables.Auth_Tokens[1][columns.Auth_Tokens.indexOf("used_at")]="";
 tables.Auth_Tokens[1][columns.Auth_Tokens.indexOf("expires_at")]=new Date(Date.now()-1000).toISOString();
 assert.throws(()=>ctx.execute("sendMail",{to:user.email,subject,body}),/INVALID_MAIL_TOKEN/);
 assert.equal(sent.length,1);
});

test("read-only setup inspection checks Apps Script properties, schema and MailApp without exposing secrets",()=>{
 const headers={
  Gen3_Users:["user_id","email","password_hash","display_name","global_role","account_status","failed_login_attempts","locked_until","created_at","updated_at","google_sub","google_linked_at","email_verified_at","username"],
  Auth_Tokens:["token_id","user_id","token_hash","purpose","target_email","created_at","expires_at","used_at"],
  Auth_Sessions:["session_id","user_id","session_token_hash","created_at","expires_at","last_seen_at","revoked_at","revoked_reason"],
  Auth_Audit_Logs:["audit_id","user_id","event_type","result","auth_method","ip_address","user_agent","details","created_at"]
 };
 const secret="secret_only_for_test_at_least_32_chars";
 const messages=[];
 const ctx=vm.createContext({
  Logger:{log:s=>messages.push(s)},
  PropertiesService:{getScriptProperties:()=>({getProperty:name=>name==="GEN3_SPREADSHEET_ID"?"sheet-test-id":secret})},
  SpreadsheetApp:{openById:()=>({getSheetByName:name=>({
   getRange:()=>({getValues:()=>[headers[name]]})
  })})},
  MailApp:{getRemainingDailyQuota:()=>15}
 });
 new vm.Script(source).runInContext(ctx);
 const report=ctx.inspectGen3Setup();
 assert.equal(report.ready,true);
 assert.equal(report.mailAuthorized,true);
 assert.equal(report.mailQuotaAvailable,true);
 assert.deepEqual(Object.keys(report.sheets).sort(),Object.keys(headers).sort());
 assert.equal(messages.length,1);
 assert.equal(messages[0].includes(secret),false);
 assert.equal(messages[0].includes("sheet-test-id"),false);
});

test("MailApp explicit authorization check is read-only and exposes the real exception",()=>{
 const messages=[];
 const ctx=vm.createContext({
  Logger:{log:s=>messages.push(s)},
  MailApp:{getRemainingDailyQuota:()=>12,sendEmail:()=>{throw Error("must never send mail")}}
 });
 new vm.Script(source).runInContext(ctx);
 assert.equal(ctx.authorizeGen3MailApp(),true);
 assert.deepEqual(messages,[JSON.stringify({mailAuthorized:true,mailQuotaAvailable:true})]);
 const denied=vm.createContext({
  Logger:{log:()=>{throw Error("should not log on failure")}},
  MailApp:{getRemainingDailyQuota:()=>{throw Error("Authorization is required to perform that action")}}
 });
 new vm.Script(source).runInContext(denied);
 assert.throws(()=>denied.authorizeGen3MailApp(),/Authorization is required/);
});
