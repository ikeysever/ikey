'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const mount=require('../lib/serial-test-router');

function setup({enabled=false,backend='supabase',origin=true,user={user_id:'owner',global_role:'user'},device='ABCDEFGH',rpcResult=true}={}){
 const oldEnabled=process.env.IKEY_SERIAL_TEST_ENABLED,oldBackend=process.env.IKEY_STORAGE_BACKEND;
 process.env.IKEY_SERIAL_TEST_ENABLED=String(enabled);
 process.env.IKEY_STORAGE_BACKEND=backend;
 const routes=new Map(),calls=[];
 const app={get:(path,...handlers)=>routes.set('GET '+path,handlers.at(-1)),post:(path,...handlers)=>routes.set('POST '+path,handlers.at(-1))};
 const store={
  dbCall:async(action,params)=>{
   calls.push({action,params});
   const rows={Projects:[{project_id:'p',status:'active',created_by_user_id:'owner'}],Project_Access:[],Project_Devices:[{project_id:'p',device_id:device}],Devices:[{device_id:device,status:'pre_registered'}]};
   if(action==='db.select')return {rows:rows[params.table]||[]};
   return {rows:[]};
  },
  rpc:async(name,args)=>{calls.push({rpc:name,args});return rpcResult;}
 };
 mount(app,{store,requireProjectUser:(_req,_res,next)=>next(),requireDevice:(_req,_res,next)=>next(),sameProjectOrigin:()=>origin});
 async function invoke(method,path,{body={},params={},projectUser=user,verifiedDevice={device_id:device}}={}){
  const handler=routes.get(method+' '+path);
  assert.ok(handler,'Route missing: '+method+' '+path);
  const req={body,params,projectUser,verifiedDevice};
  const res={statusCode:200,headers:{},set(k,v){this.headers[k]=v;return this;},status(n){this.statusCode=n;return this;},json(data){this.body=data;return this;}};
  await handler(req,res);
  return res;
 }
 function restore(){if(oldEnabled===undefined)delete process.env.IKEY_SERIAL_TEST_ENABLED;else process.env.IKEY_SERIAL_TEST_ENABLED=oldEnabled;if(oldBackend===undefined)delete process.env.IKEY_STORAGE_BACKEND;else process.env.IKEY_STORAGE_BACKEND=oldBackend;}
 return {invoke,calls,restore};
}
async function scenario(options,fn){const env=setup(options);try{await fn(env);}finally{env.restore();}}
test('serial test disabled by default; no storage writes',()=>scenario({},async({invoke,calls})=>{
 const res=await invoke('POST','/api/serial-test/commands',{body:{project_id:'p',device_id:'ABCDEFGH'}});
 assert.equal(res.statusCode,503);assert.equal(res.body.code,'SERIAL_TEST_DISABLED');assert.equal(calls.length,0);
}));
test('serial test requires explicit Supabase backend',()=>scenario({enabled:true,backend:'gas'},async({invoke,calls})=>{
 const res=await invoke('GET','/api/device/serial-test/next');
 assert.equal(res.statusCode,503);assert.equal(calls.length,0);
}));
test('invalid origin denied without database operations',()=>scenario({enabled:true,origin:false},async({invoke,calls})=>{
 const res=await invoke('POST','/api/serial-test/commands',{body:{project_id:'p',device_id:'ABCDEFGH'}});
 assert.equal(res.statusCode,403);assert.equal(res.body.code,'INVALID_ORIGIN');assert.equal(calls.length,0);
}));
test('invalid device ID rejected',()=>scenario({enabled:true},async({invoke,calls})=>{
 const res=await invoke('POST','/api/serial-test/commands',{body:{project_id:'p',device_id:'invalid'}});
 assert.equal(res.statusCode,400);assert.equal(calls.length,0);
}));
test('owner may enqueue serial-only test with physical_unlock false',()=>scenario({enabled:true},async({invoke,calls})=>{
 const res=await invoke('POST','/api/serial-test/commands',{body:{project_id:'p',device_id:'ABCDEFGH'}});
 assert.equal(res.statusCode,201);assert.equal(res.body.physical_unlock,false);
 assert.equal(calls.filter(x=>x.action==='db.insert').length,1);
 assert.equal(calls.find(x=>x.action==='db.insert').params.table,'Device_Test_Commands');
}));
test('non-admin project user cannot enqueue serial test',()=>scenario({enabled:true,user:{user_id:'outsider',global_role:'user'}},async({invoke,calls})=>{
 const res=await invoke('POST','/api/serial-test/commands',{body:{project_id:'p',device_id:'ABCDEFGH'}});
 assert.equal(res.statusCode,403);assert.equal(res.body.code,'NOT_AUTHORIZED');
 assert.equal(calls.filter(x=>x.action==='db.insert').length,0);
}));
test('device claim is scoped to authenticated device',()=>scenario({enabled:true},async({invoke,calls})=>{
 const res=await invoke('GET','/api/device/serial-test/next');
 assert.equal(res.statusCode,200);
 assert.deepEqual(calls[0],{rpc:'ikey_serial_test_claim',args:{p_device_id:'ABCDEFGH'}});
}));
test('device report requires SERIAL_PRINTED and valid UUID',()=>scenario({enabled:true},async({invoke,calls})=>{
 const res=await invoke('POST','/api/device/serial-test/report',{body:{command_id:'00000000-0000-4000-8000-000000000000',result:'UNLOCKED'}});
 assert.equal(res.statusCode,400);assert.equal(calls.length,0);
}));
test('device report completion is scoped to authenticated device',()=>scenario({enabled:true},async({invoke,calls})=>{
 const id='00000000-0000-4000-8000-000000000000';
 const res=await invoke('POST','/api/device/serial-test/report',{body:{command_id:id,result:'SERIAL_PRINTED'}});
 assert.equal(res.statusCode,200);assert.equal(res.body.code,'COMPLETED');
 assert.deepEqual(calls[0],{rpc:'ikey_serial_test_complete',args:{p_device_id:'ABCDEFGH',p_command_id:id}});
}));
test('unclaimed completion rejected',()=>scenario({enabled:true,rpcResult:false},async({invoke})=>{
 const res=await invoke('POST','/api/device/serial-test/report',{body:{command_id:'00000000-0000-4000-8000-000000000000',result:'SERIAL_PRINTED'}});
 assert.equal(res.statusCode,409);assert.equal(res.body.code,'NOT_CLAIMED');
}));
