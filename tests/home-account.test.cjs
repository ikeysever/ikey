"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname,"../public/home-account.js"),"utf8");

function makePage(fetchImpl) {
  const ids=["ikeyHomeAccount","ikeyHomeAccountProfile","ikeyHomeAccountLegacy",
    "ikeyHomeGreeting","ikeyHomeAccountMessage","ikeyHomeAccountRefresh",
    "ikeyHomeAccountHelp","ikeyHomeUsername","ikeyHomeDisplayName","ikeyHomeEmail",
    "ikeyHomeStatus","ikeyHomeRole"];
  const elements=Object.fromEntries(ids.map(id=>[id,{textContent:"",hidden:true,disabled:false,listeners:{},
    addEventListener(type,fn){this.listeners[type]=fn}}]));
  const events={};
  const window={};
  const document={
    getElementById:id=>elements[id]||null,
    addEventListener:(name,fn)=>{events[name]=fn}
  };
  vm.runInNewContext(source,{document,window,fetch:fetchImpl});
  events.DOMContentLoaded();
  return {elements,controller:window.iKeyHomeAccount};
}
const response=user=>({ok:true,json:async()=>({authenticated:true,user})});

test("Gen3 homepage shows only server-verified profile data",async()=>{
  let calls=0;
  const {elements,controller}=makePage(async(url,opts)=>{
    calls++;
    assert.equal(url,"/api/auth/me");
    assert.equal(opts.credentials,"same-origin");
    assert.equal(opts.cache,"no-store");
    return response({username:"student_12",display_name:"小安",email:"test@example.com",global_role:"user",account_status:"active"});
  });
  assert.equal(calls,0);
  await controller.load("gen3");
  assert.equal(calls,1);
  assert.equal(elements.ikeyHomeAccount.hidden,false);
  assert.equal(elements.ikeyHomeAccountProfile.hidden,false);
  assert.equal(elements.ikeyHomeUsername.textContent,"student_12");
  assert.equal(elements.ikeyHomeDisplayName.textContent,"小安");
  assert.equal(elements.ikeyHomeEmail.textContent,"test@example.com");
  assert.equal(elements.ikeyHomeRole.textContent,"一般使用者");
  assert.equal(elements.ikeyHomeStatus.textContent,"已啟用（電子郵件已驗證）");
  assert.equal(elements.ikeyHomeGreeting.textContent,"歡迎回來，小安");
  assert.equal(elements.ikeyHomeAccountRefresh.disabled,false);
});

test("Legacy administrator never requests or exposes Gen3 account profile",async()=>{
  const {elements,controller}=makePage(()=>{throw Error("must not fetch Gen3 profile")});
  await controller.load("legacy");
  assert.equal(elements.ikeyHomeAccount.hidden,false);
  assert.equal(elements.ikeyHomeAccountProfile.hidden,true);
  assert.equal(elements.ikeyHomeAccountLegacy.hidden,false);
  assert.equal(elements.ikeyHomeAccountRefresh.hidden,true);
  assert.equal(elements.ikeyHomeAccountHelp.hidden,true);
});

test("Failed profile lookup never exposes a previous user's data",async()=>{
  let fail=false;
  const {elements,controller}=makePage(async()=>{
    if(fail)return {ok:false,status:401};
    return response({username:"student_12",display_name:"小安",email:"test@example.com",global_role:"user",account_status:"active"});
  });
  await controller.load("gen3");
  fail=true;
  await controller.load("gen3");
  assert.equal(elements.ikeyHomeAccountProfile.hidden,true);
  assert.equal(elements.ikeyHomeEmail.textContent,"—");
  assert.match(elements.ikeyHomeAccountMessage.textContent,/登入狀態已失效/);
});

test("Logout invalidates in-flight profile responses",async()=>{
  let finish;
  const {elements,controller}=makePage(()=>new Promise(resolve=>{finish=resolve}));
  const loading=controller.load("gen3");
  controller.clear();
  finish(response({username:"student_12",display_name:"小安",email:"test@example.com",global_role:"user",account_status:"active"}));
  await loading;
  assert.equal(elements.ikeyHomeAccount.hidden,true);
  assert.equal(elements.ikeyHomeAccountProfile.hidden,true);
  assert.equal(elements.ikeyHomeEmail.textContent,"—");
});

test("Refresh button reloads the current verified profile",async()=>{
  let calls=0;
  const {elements,controller}=makePage(async()=>{calls++;return response({
    username:"student_12",display_name:"小安",email:"test@example.com",global_role:"user",account_status:"active"
  })});
  await controller.load("gen3");
  elements.ikeyHomeAccountRefresh.listeners.click();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls,2);
});
