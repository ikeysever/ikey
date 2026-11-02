'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const {passwordHash}=require('../gen3-auth/core'),mount=require('../device-auth');
const SECRET='test-device-auth-secret-with-more-than-32-bytes',ID='Y8R69EXB',PASSWORD='device-password-123';
async function setup(t,opts={}){
 process.env.IKEY_DEVICE_TOKEN_SECRET=opts.secret===undefined?SECRET:opts.secret;
 const app=express();app.use(express.json());
 const device=opts.device===undefined?{device_id:ID,password_hash:passwordHash(PASSWORD),status:'pre_registered'}:opts.device,calls=[];
 mount(app,{async deviceAuthFindById(id){calls.push(id);if(opts.storageError)throw Error('STORAGE_OFFLINE');return device&&device.device_id===id?device:null;}});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 t.after(()=>new Promise((ok,no)=>server.close(e=>e?no(e):ok())));
 const base='http://127.0.0.1:'+server.address().port;
 async function request(path,init={}){const r=await fetch(base+path,{...init,headers:{...(init.body===undefined?{}:{'Content-Type':'application/json'}),...(init.headers||{})},body:init.body===undefined?undefined:JSON.stringify(init.body)});return {status:r.status,headers:r.headers,body:await r.json()};}
 return {request,calls,device};
}
test('valid credentials issue a 15-minute bearer token and verify identity',async t=>{
 const c=await setup(t),a=await c.request('/api/device/auth',{method:'POST',body:{device_id:ID,password:PASSWORD}});
 assert.equal(a.status,200);assert.equal(a.body.expires_in,900);assert.equal(a.body.token_type,'Bearer');assert.equal(a.body.password_hash,undefined);assert.equal(a.headers.get('cache-control'),'no-store');
 const me=await c.request('/api/device/me',{headers:{Authorization:'Bearer '+a.body.access_token}});
 assert.equal(me.status,200);assert.deepEqual(me.body,{success:true,device_id:ID,authenticated:true});
});
test('unknown device and wrong password both fail closed',async t=>{
 const c=await setup(t),a=await c.request('/api/device/auth',{method:'POST',body:{device_id:'ABCDEFGH',password:PASSWORD}}),b=await c.request('/api/device/auth',{method:'POST',body:{device_id:ID,password:'incorrect-password'}});
 assert.equal(a.status,401);assert.equal(b.status,401);assert.equal(a.body.code,'INVALID_CREDENTIALS');assert.equal(b.body.code,'INVALID_CREDENTIALS');
});
test('inactive device loses access after token issuance',async t=>{
 const c=await setup(t),a=await c.request('/api/device/auth',{method:'POST',body:{device_id:ID,password:PASSWORD}});
 assert.equal(a.status,200);c.device.status='disabled';
 const me=await c.request('/api/device/me',{headers:{Authorization:'Bearer '+a.body.access_token}});assert.equal(me.status,401);
});
test('malformed credentials are rejected before storage access',async t=>{
 const c=await setup(t),a=await c.request('/api/device/auth',{method:'POST',body:{device_id:'bad-id',password:'short'}});
 assert.equal(a.status,400);assert.equal(c.calls.length,0);
});
test('missing token secret and unavailable storage fail closed',async t=>{
 const a=await setup(t,{secret:''}),r1=await a.request('/api/device/auth',{method:'POST',body:{device_id:ID,password:PASSWORD}});
 assert.equal(r1.status,503);assert.equal(r1.body.code,'DEVICE_AUTH_NOT_CONFIGURED');
 const b=await setup(t,{storageError:true}),r2=await b.request('/api/device/auth',{method:'POST',body:{device_id:ID,password:PASSWORD}});
 assert.equal(r2.status,503);assert.equal(r2.body.code,'DEVICE_AUTH_UNAVAILABLE');
});
test('tampered and absent bearer tokens are rejected',async t=>{
 const c=await setup(t),a=await c.request('/api/device/auth',{method:'POST',body:{device_id:ID,password:PASSWORD}});
 const tok=a.body.access_token,changed=tok.slice(0,-1)+(tok.endsWith('A')?'B':'A');
 assert.equal((await c.request('/api/device/me',{headers:{Authorization:'Bearer '+changed}})).status,401);
 assert.equal((await c.request('/api/device/me')).status,401);
});
test('sixth authentication attempt per IP and device is rate limited',async t=>{
 const c=await setup(t),out=[];
 for(let i=0;i<6;i++)out.push(await c.request('/api/device/auth',{method:'POST',body:{device_id:ID,password:'incorrect-password'}}));
 assert.equal(out.slice(0,5).every(x=>x.status===401),true);assert.equal(out[5].status,429);assert.equal(out[5].body.code,'RATE_LIMITED');
});
test('GAS device actions use isolated staging storage and locked unique creation',()=>{
 const fs=require('node:fs'),path=require('node:path'),s=fs.readFileSync(path.join(__dirname,'../gen3-auth/Code.gs'),'utf8');
 assert.match(s,/IKEY_DEVICE_AUTH_STAGING_SPREADSHEET_ID/);assert.match(s,/DeviceAuth_Devices/);
 assert.match(s,/function deviceAuthCreateAtomic_/);assert.match(s,/LockService\.getScriptLock\(\)/);
 for(const a of ['deviceAuthFindById','deviceAuthCreateAtomic','deviceAuthListPreRegistered','deviceAuthGetById'])assert.match(s,new RegExp('case "'+a+'"'));
 assert.match(s,/STAGING_SPREADSHEET_ID_MISMATCH/);
});
