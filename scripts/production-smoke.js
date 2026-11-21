'use strict';
const assert=require('node:assert/strict');
const base='https://ikey.onrender.com';
async function check(path,{method='GET',body}={}){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetch(base+path,{method,signal:controller.signal,headers:{'Accept':'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json();
  return {status:response.status,data};
 }finally{clearTimeout(timer)}
}
(async()=>{
 const health=await check('/api/health');
 assert.equal(health.status,200,'health must be HTTP 200');
 assert.equal(health.data.ok,true,'health must return ok');
 console.log('PASS GET /api/health');
 const ready=await check('/api/ready');
 assert.ok([200,503].includes(ready.status),'readiness response must be 200 or 503');
 assert.equal(typeof ready.data.ready,'boolean','readiness must be explicit');
 if(!ready.data.ready)throw Error('Production storage readiness is false');
 console.log('PASS GET /api/ready');
 const heartbeat=await check('/api/device/heartbeat',{method:'POST',body:{}});
 assert.ok([401,403].includes(heartbeat.status),'anonymous heartbeat must be denied');
 console.log('PASS POST /api/device/heartbeat anonymous denied');
 const unlock=await check('/api/projects/SMOKE_NONEXISTENT/devices/Y8R69EXB/unlock',{method:'POST',body:{}});
 assert.ok([401,403].includes(unlock.status),'anonymous unlock must be denied');
 console.log('PASS POST /api/projects/.../unlock anonymous denied');
 console.log('Production non-actuating smoke checks passed; no unlock command created.');
})().catch(e=>{console.error('SMOKE_FAIL',e.message);process.exitCode=1});
