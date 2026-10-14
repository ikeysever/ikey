"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),express=require("express");
const {createRouter}=require("./routes");
const {passwordVerify}=require("./core");
function fakeStore(){
 const users=[],audit=[];
 return {users,audit,
  registerAtomic:async u=>{if(users.some(x=>x.username===u.username))return null;users.push(u);return u},
  findByLogin:async id=>users.find(u=>u.username===id)||null,
  findById:async id=>users.find(u=>u.user_id===id)||null,
  recordLoginFailureAtomic:async id=>users.find(u=>u.user_id===id),
  recordLoginSuccessAtomic:async id=>{const u=users.find(x=>x.user_id===id);if(u?.account_status==="pending_verification")u.account_status="active";return u},
  createSession:async()=>true,findSessionByHash:async()=>null,touchSession:async()=>true,revokeSession:async()=>true,
  throttleAtomic:async()=>true,audit:async e=>{audit.push(e);return true}
 };
}
test("username-only registration, login and removed mail routes",async()=>{
 const store=fakeStore(),app=express();app.use(express.json());app.use("/api/auth",createRouter(store));
 const server=app.listen(0),base="http://127.0.0.1:"+server.address().port;
 async function post(path,data){const r=await fetch(base+path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});const raw=await r.text();let body={};try{body=JSON.parse(raw)}catch{}return {status:r.status,body};}
 try{
  let r=await post("/api/auth/register",{username:"student_1",display_name:"測試學生",password:"safePassword123"});
  assert.equal(r.status,201);assert.equal(store.users[0].account_status,"active");
  assert.equal(Object.hasOwn(store.users[0],"email"),false);
  assert.equal(Object.hasOwn(r.body.user,"email"),false);
  r=await post("/api/auth/login",{identifier:"student_1",password:"safePassword123"});
  assert.equal(r.status,200);assert.equal(Object.hasOwn(r.body.user,"email"),false);
  r=await post("/api/auth/register",{username:"student_1",display_name:"另一人",password:"safePassword123"});assert.equal(r.status,409);
  r=await post("/api/auth/register",{username:"student_2",display_name:"另一人",email:"ignored@example.invalid",password:"safePassword123"});assert.equal(r.status,201);
  assert.equal(Object.hasOwn(store.users[1],"email"),false);
  r=await post("/api/auth/login",{identifier:"ignored@example.invalid",password:"safePassword123"});assert.equal(r.status,401);
  for(const endpoint of ["resend-verification","forgot-password","reset-password","verify-email"]){
   r=await post("/api/auth/"+endpoint,{});assert.equal(r.status,404,endpoint);
  }
  store.users[0].account_status="pending_verification";
  r=await post("/api/auth/login",{identifier:"student_1",password:"safePassword123"});assert.equal(r.status,200);
  assert.equal(store.users[0].account_status,"active");
  assert.equal(passwordVerify("safePassword123",store.users[0].password_hash),true);
 }finally{await new Promise(resolve=>server.close(resolve))}
});
