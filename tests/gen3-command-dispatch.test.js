'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../gen3-auth/Code.gs'),'utf8');
test('GEN3 command dispatch is behind authenticated doPost',()=>{
 const start=code.indexOf('function doPost(e)');
 const gate=code.indexOf('data.api_key!==secret',start);
 const dispatch=code.indexOf('execute(data.action,data.payload||{})',start);
 assert.ok(start>=0&&gate>start&&dispatch>gate);
});
test('GEN3 dispatch allowlists command actions and fails closed without handler',()=>{
 const start=code.indexOf('function execute(action,p)');
 const section=code.slice(start,start+550);
 for(const action of ['deviceCommandCreateAtomic','deviceCommandClaimAtomic','deviceCommandReportAtomic','deviceCommandGet'])
  assert.ok(section.includes(action),action);
 assert.match(section,/COMMAND_HANDLER_NOT_INSTALLED/);
});
