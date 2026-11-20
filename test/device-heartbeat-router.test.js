'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const mount=require('../lib/device-heartbeat-router');
function harness({rows={},user='u1',device='Y8R69EXB'}={}){
 const app=express();app.use(express.json());
 const calls=[];
 const store={dbCall:async(action,payload)=>{
  calls.push({action,payload});
  if(action==='db.select')return {rows:rows[payload.table]||[]};
  if(action==='db.insert')return {inserted:true,record:payload.data};
  if(action==='db.update')return {count:1,rows:[payload.data]};
  throw Error('unexpected action');
 }};
 mount(app,{store,requireDevice:(req,res,next)=>{req.verifiedDevice={device_id:device};next()},requireProjectUser:(req,res,next)=>{req.projectUser={user_id:user};next()}});
 return {app,calls};
}
async function serve(app,method,path,body){
 const server=app.listen(0,'127.0.0.1');
 try{
  await new Promise(resolve=>server.once('listening',resolve));
  const r=await fetch('http://127.0.0.1:'+server.address().port+path,{method,headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:r.status,data:await r.json()};
 }finally{await new Promise(resolve=>server.close(resolve))}
}
test('heartbeat inserts authenticated device only, without physical unlock',async()=>{
 const h=harness();
 const r=await serve(h.app,'POST','/api/device/heartbeat',{});
 assert.equal(r.status,200);assert.equal(r.data.physical_unlock_enabled,false);
 assert.equal(h.calls.find(c=>c.action==='db.insert').payload.data.device_id,'Y8R69EXB');
});
test('heartbeat rejects payload',async()=>{
 const h=harness();
 const r=await serve(h.app,'POST','/api/device/heartbeat',{action:'unlock'});
 assert.equal(r.status,400);assert.equal(h.calls.length,0);
});
test('heartbeat updates existing row',async()=>{
 const h=harness({rows:{Device_Heartbeats:[{device_id:'Y8R69EXB',last_seen_at:new Date().toISOString()}]}});
 const r=await serve(h.app,'POST','/api/device/heartbeat',{});
 assert.equal(r.status,200);assert.ok(h.calls.some(c=>c.action==='db.update'));
});
test('live status rejects nonmember before reading heartbeat',async()=>{
 const h=harness({rows:{Projects:[{project_id:'p',status:'active',created_by_user_id:'someone-else'}]}});
 const r=await serve(h.app,'GET','/api/projects/p/devices/Y8R69EXB/live');
 assert.equal(r.status,403);assert.ok(!h.calls.some(c=>c.payload.table==='Device_Heartbeats'));
});
test('live status reports fresh heartbeat for project owner',async()=>{
 const h=harness({rows:{Projects:[{project_id:'p',status:'active',created_by_user_id:'u1'}],Project_Devices:[{project_id:'p',device_id:'Y8R69EXB'}],Device_Heartbeats:[{device_id:'Y8R69EXB',last_seen_at:new Date().toISOString()}]}});
 const r=await serve(h.app,'GET','/api/projects/p/devices/Y8R69EXB/live');
 assert.equal(r.status,200);assert.equal(r.data.online,true);assert.equal(r.data.physical_unlock_enabled,false);
});
