"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"apps-script","Code.gs"),"utf8");
const headers={
 Gen3_Users:["user_id","password_hash","display_name","global_role","account_status","failed_login_attempts","locked_until","created_at","updated_at","username"],
 Auth_Tokens:["token_id","user_id","token_hash","purpose","created_at","expires_at","used_at"],
 Auth_Sessions:["session_id","user_id","session_token_hash","created_at","expires_at","last_seen_at","revoked_at","revoked_reason"],
 Auth_Audit_Logs:["audit_id","user_id","event_type","result","auth_method","ip_address","user_agent","details","created_at"]
};
function fixture(){
 const tables=Object.fromEntries(Object.entries(headers).map(([name,h])=>[name,[h.slice()]]));
 const logs=[];
 const ctx=vm.createContext({
  Logger:{log:s=>logs.push(s)},
  PropertiesService:{getScriptProperties:()=>({getProperty:key=>key==="GEN3_SPREADSHEET_ID"?"test-sheet":"test-api-key-at-least-32-characters-long"})},
  LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},
  SpreadsheetApp:{openById:()=>({getSheetByName:name=>tables[name]?{
   getLastRow:()=>tables[name].length,
   getRange:(row,col,n,w)=>({
    getValues:()=>tables[name].slice(row-1,row-1+n).map(x=>x.slice(col-1,col-1+w)),
    setValues:values=>{values.forEach((v,i)=>tables[name][row-1+i].splice(col-1,w,...v))}
   }),
   appendRow:values=>tables[name].push(values)
  }:null})},
  Utilities:{getUuid:()=>"audit-id"}
 });
 new vm.Script(source).runInContext(ctx);
 return {ctx,tables,logs};
}
test("Apps Script syntax and schema use username-only fields",()=>{
 assert.doesNotThrow(()=>new vm.Script(source,{filename:"Code.gs"}));
 const {ctx}=fixture();
 assert.deepEqual(Array.from(vm.runInContext("HEADERS.Gen3_Users",ctx)),headers.Gen3_Users);
 assert.deepEqual(Array.from(vm.runInContext("HEADERS.Auth_Tokens",ctx)),headers.Auth_Tokens);
 assert.doesNotMatch(source,/MailApp|sendMail|findByEmail|target_email|email_verified_at|google_sub|google_linked_at/);
});
test("spreadsheet formula injection guard protects untrusted names",()=>{
 const {ctx}=fixture();
 for(const v of ["=1+1","+SUM(1,2)","-1+2","@cmd","  =HYPERLINK(\"x\")"])assert.equal(ctx.cellText(v),"'"+v);
 assert.equal(ctx.cellText("普通姓名"),"普通姓名");
});
test("register, unique username, health, legacy activation and audit",()=>{
 const {ctx,tables}=fixture();
 assert.equal(ctx.execute("health",{}).version,"gen3-username-v3");
 const u={user_id:"u1",username:"student_1",password_hash:"scrypt:v1:test",display_name:"學生",global_role:"user",account_status:"active"};
 assert.equal(ctx.execute("registerAtomic",{user:u}).user_id,"u1");
 assert.equal(ctx.execute("registerAtomic",{user:{...u,user_id:"u2"}}),null);
 assert.equal(ctx.execute("findByLogin",{identifier:"student_1"}).user_id,"u1");
 assert.equal(ctx.execute("findByLogin",{identifier:"student@example.invalid"}),null);
 const user=tables.Gen3_Users[1];
 user[headers.Gen3_Users.indexOf("account_status")]="pending_verification";
 assert.equal(ctx.execute("recordLoginSuccessAtomic",{user_id:"u1"}).account_status,"active");
 assert.equal(ctx.execute("audit",{event:{user_id:"u1",event_type:"login",result:"success"}}),true);
 assert.equal(tables.Auth_Audit_Logs.length,2);
});
test("inspection is read only, schema mismatch is rejected, secrets not logged",()=>{
 const {ctx,tables,logs}=fixture();
 const report=ctx.inspectGen3Setup();
 assert.equal(report.ready,true);
 assert.deepEqual(Object.keys(report.sheets).sort(),Object.keys(headers).sort());
 assert.equal(logs.length,1);assert.equal(logs[0].includes("test-api-key"),false);
 tables.Gen3_Users[0][1]="email";
 assert.equal(ctx.inspectGen3Setup().ready,false);
 assert.throws(()=>ctx.execute("health",{}),/SCHEMA_MISMATCH_Gen3_Users/);
});
