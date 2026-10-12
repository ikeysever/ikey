"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const express=require("express");
const {createRouter}=require("./routes");
const {passwordVerify}=require("./core");
const old={...process.env};
process.env.GEN3_APPS_SCRIPT_URL="https://script.google.com/macros/s/test-only/exec";
process.env.GEN3_APPS_SCRIPT_KEY="test_only_key_at_least_32_characters_long";
function fakeStore(){
 const users=[],tokens=[],audit=[],sent=[];
 return {users,tokens,audit,sent,
 sendMail:async(to,subject,body)=>{sent.push({to,subject,text:body});return true},
 registerAtomic:async u=>{if(users.some(x=>x.email===u.email||x.username===u.username))return null;users.push(u);return u},
 findByEmail:async email=>users.find(u=>u.email===email)||null,
 findByLogin:async id=>users.find(u=>u.email===id||u.username===id)||null,
 findById:async id=>users.find(u=>u.user_id===id)||null,
 recordLoginFailureAtomic:async id=>users.find(u=>u.user_id===id),
 recordLoginSuccessAtomic:async id=>users.find(u=>u.user_id===id),
 createSession:async()=>true,findSessionByHash:async()=>null,touchSession:async()=>true,revokeSession:async()=>true,
 throttleAtomic:async()=>true,
 createToken:async t=>{tokens.push(t);return true},
 consumeTokenAtomic:async(hash,purpose,pass)=>{
  const t=tokens.find(x=>x.token_hash===hash&&x.purpose===purpose&&!x.used_at);
  if(!t)return null;t.used_at=new Date().toISOString();
  const u=users.find(x=>x.user_id===t.user_id);
  if(purpose==="verify_email"){u.email_verified_at=new Date().toISOString();u.account_status="active"}
  if(purpose==="reset_password")u.password_hash=pass;
  return {user_id:u.user_id}
 },audit:async e=>{audit.push(e);return true}
 };
}
test("registration, verification, login and single-use password reset",async()=>{
 const store=fakeStore(),app=express();app.use(express.json());app.use("/api/auth",createRouter(store));
 const server=app.listen(0);
 const base="http://127.0.0.1:"+server.address().port;
 const sent=store.sent,original=global.fetch;
 async function post(path,data){const r=await original(base+path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});return {status:r.status,body:await r.json()};}
 try{
  for(const endpoint of ["/api/auth/google/start","/api/auth/google/link","/api/auth/google/callback"]){
   const response=await original(base+endpoint);
   assert.equal(response.status,404,endpoint);
  }
  let r=await post("/api/auth/register",{username:"student_1",display_name:"測試學生",email:"student@example.com",password:"safePassword123"});
  assert.equal(r.status,201);assert.equal(store.users[0].account_status,"pending_verification");assert.equal(sent.length,1);
  r=await post("/api/auth/login",{identifier:"student_1",password:"safePassword123"});assert.equal(r.status,403);
  const token1=new URL(sent[0].text.split("\n").pop()).searchParams.get("token");
  r=await post("/api/auth/verify-email",{token:token1});assert.equal(r.status,200);
  r=await post("/api/auth/verify-email",{token:token1});assert.equal(r.status,400);
  r=await post("/api/auth/login",{identifier:"student_1",password:"safePassword123"});assert.equal(r.status,200);
  r=await post("/api/auth/register",{username:"student_1",display_name:"另一人",email:"another@example.com",password:"safePassword123"});assert.equal(r.status,409);
  r=await post("/api/auth/forgot-password",{email:"student@example.com"});assert.equal(r.status,200);
  const token2=new URL(sent.at(-1).text.split("\n").pop()).searchParams.get("token");
  r=await post("/api/auth/reset-password",{token:token2,password:"newPassword123"});assert.equal(r.status,200);
  assert.equal(passwordVerify("newPassword123",store.users[0].password_hash),true);
  r=await post("/api/auth/reset-password",{token:token2,password:"newPassword456"});assert.equal(r.status,400);
  store.sendMail=async()=>{throw Error("MAIL_PROVIDER_UNAVAILABLE")};
  r=await post("/api/auth/register",{username:"student_2",display_name:"測試新用戶",email:"newstudent@example.com",password:"safePassword123"});
  assert.equal(r.status,202);assert.equal(r.body.email_sent,false);
  assert.equal(store.users.find(u=>u.email==="newstudent@example.com").account_status,"pending_verification");
 }finally{await new Promise(resolve=>server.close(resolve));Object.assign(process.env,old)}
});
