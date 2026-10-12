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
