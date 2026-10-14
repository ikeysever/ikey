"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../public/home-dashboard.js"),"utf8");

function page(fetchImpl) {
  const ids=["ikeyV3Greeting","ikeyV3AccountMessage","ikeyV3AccountRefresh",
    "ikeyV3AccountHelp","ikeyV3Gen3Fields","ikeyV3AdminFields","ikeyV3Username",
    "ikeyV3DisplayName","ikeyV3Role","ikeyV3AccountStatus",
    "ikeyV3AdminUsername","ikeyV3AdminRole"];
  const elements=Object.fromEntries(ids.map(id=>[id,{textContent:"",hidden:true,disabled:false,listeners:{},
    addEventListener(type,fn){this.listeners[type]=fn}}]));
  const events={},window={};
  const document={getElementById:id=>elements[id]||null,addEventListener:(event,fn)=>{events[event]=fn}};
  vm.runInNewContext(source,{window,document,fetch:fetchImpl});
  events.DOMContentLoaded();
  return {elements,controller:window.iKeyHomeDashboard};
}
const response=user=>({ok:true,json:async()=>({authenticated:true,user})});

test("Gen3 account details come only from verified /api/auth/me",async()=>{
  let calls=0;
  const {elements:e,controller}=page(async(url,options)=>{
    calls++;
    assert.equal(url,"/api/auth/me");
    assert.equal(options.credentials,"same-origin");
    assert.equal(options.cache,"no-store");
    return response({username:"student_12",display_name:"小安",global_role:"user",account_status:"active"});
  });
  await controller.load("gen3");
  assert.equal(calls,1);
  assert.equal(e.ikeyV3Gen3Fields.hidden,false);
  assert.equal(e.ikeyV3AdminFields.hidden,true);
  assert.equal(e.ikeyV3Username.textContent,"student_12");
  assert.equal(e.ikeyV3DisplayName.textContent,"小安");
  assert.equal(e.ikeyV3Role.textContent,"一般使用者");
  assert.equal(e.ikeyV3AccountStatus.textContent,"已啟用");
  assert.equal(e.ikeyV3Greeting.textContent,"歡迎回來，小安");
});

test("Admin account uses independent server session and no Gen3 email",async()=>{
  const {elements:e,controller}=page(async(url,options)=>{
    assert.equal(url,"/api/login/session");
    assert.equal(options.credentials,"same-origin");
    return {ok:true,json:async()=>({authenticated:true,account:"ikey",globalRole:"superadmin"})};
  });
  await controller.load("legacy");
  assert.equal(e.ikeyV3Gen3Fields.hidden,true);
  assert.equal(e.ikeyV3AdminFields.hidden,false);
  assert.equal(e.ikeyV3AdminUsername.textContent,"ikey");
  assert.equal(e.ikeyV3AdminRole.textContent,"超級管理員");
  assert.equal(e.ikeyV3AccountHelp.hidden,true);
  assert.equal(e.ikeyV3Greeting.textContent,"歡迎回來，ikey");
});

test("Expired session clears all private fields instead of showing stale identity",async()=>{
  let expired=false;
  const {elements:e,controller}=page(async()=>{
    if(expired)return {ok:false,status:401};
    return response({username:"student_12",display_name:"小安",global_role:"user",account_status:"active"});
  });
  await controller.load("gen3");
  expired=true;
  await controller.load("gen3");
  assert.equal(e.ikeyV3Gen3Fields.hidden,true);
  assert.match(e.ikeyV3AccountMessage.textContent,/登入狀態已失效/);
});

test("Admin session failure does not guess an account",async()=>{
  const {elements:e,controller}=page(async()=>({ok:false,status:401}));
  await controller.load("legacy");
  assert.equal(e.ikeyV3AdminFields.hidden,true);
  assert.equal(e.ikeyV3AdminUsername.textContent,"—");
});

test("Logout invalidates pending responses for either login kind",async()=>{
  for(const kind of ["gen3","legacy"]){
    let finish;
    const {elements:e,controller}=page(()=>new Promise(resolve=>{finish=resolve}));
    const pending=controller.load(kind);
    controller.clear();
    finish(kind==="gen3"?response({username:"secret",global_role:"user",account_status:"active"}):
      {ok:true,json:async()=>({authenticated:true,account:"ikey",globalRole:"superadmin"})});
    await pending;
    assert.equal(e.ikeyV3Gen3Fields.hidden,true);
    assert.equal(e.ikeyV3AdminFields.hidden,true);
    assert.equal(e.ikeyV3AdminUsername.textContent,"—");
  }
});

test("Refresh button re-fetches current account without storing identity",async()=>{
  let calls=0;
  const {elements:e,controller}=page(async()=>{calls++;return response({
    username:"student_12",display_name:"小安",global_role:"user",account_status:"active"
  })});
  await controller.load("gen3");
  e.ikeyV3AccountRefresh.listeners.click();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls,2);
  assert.doesNotMatch(source,/localStorage|sessionStorage|innerHTML/);
});
