"use strict";
// Dedicated Apps Script writer. Never reuse the unauthenticated legacy API.
function createSheetsStore() {
 const url=process.env.GEN3_APPS_SCRIPT_URL;
 const key=process.env.GEN3_APPS_SCRIPT_KEY;
 if(!url || !/^https:\/\/script\.google\.com\//.test(url) || !key || key.length<32)
   throw Error("GEN3_STORAGE_NOT_CONFIGURED");
 // Isolated command-only transport. Never falls back to the GEN3 storage URL.
 function sandboxCommandTarget() {
   const raw=process.env.IKEY_SANDBOX_COMMAND_GAS_URL;
   const secret=process.env.IKEY_SANDBOX_COMMAND_GAS_KEY;
   const deployment=process.env.IKEY_SANDBOX_COMMAND_GAS_DEPLOYMENT_ID;
   const trust=process.env.IKEY_SANDBOX_COMMAND_TRUST_SECRET;
   if(!raw||!secret||!deployment||!trust||
      Buffer.byteLength(secret,'utf8')<32||Buffer.byteLength(trust,'utf8')<32)
     throw Error('SANDBOX_COMMAND_NOT_CONFIGURED');
   if(secret===key||trust===process.env.IKEY_COMMAND_TRUST_SECRET)
     throw Error('SANDBOX_COMMAND_SECRET_NOT_ISOLATED');
   if(!/^[A-Za-z0-9_-]{20,}$/.test(deployment))
     throw Error('SANDBOX_COMMAND_DEPLOYMENT_INVALID');
   let parsed;
   try { parsed=new URL(raw); } catch {throw Error('SANDBOX_COMMAND_URL_INVALID');}
   if(parsed.protocol!=='https:'||parsed.hostname!=='script.google.com'||
      parsed.port||parsed.username||parsed.password||parsed.search||parsed.hash||
      parsed.pathname!=='/macros/s/'+deployment+'/exec'||
      parsed.href===new URL(url).href)
     throw Error('SANDBOX_COMMAND_TARGET_REJECTED');
   return {url:parsed.href,key:secret,trust};
 }
 async function sandboxCommandCall(action,payload) {
   const target=sandboxCommandTarget();
   const controller=new AbortController();
   const timer=setTimeout(()=>controller.abort(),15000);
   try {
     // Apps Script may redirect its JSON response to googleusercontent.com.
     // Follow only that exact HTTPS host, never send credentials in a redirect.
     let response=await fetch(target.url,{
       method:'POST',redirect:'manual',signal:controller.signal,
       headers:{'Content-Type':'text/plain;charset=utf-8'},
       body:JSON.stringify({api_key:target.key,action,payload})
     });
     if([301,302,303,307,308].includes(response.status)){
       const location=response.headers.get('location');
       let destination;
       try {destination=new URL(location);}catch{throw Error('SANDBOX_COMMAND_REDIRECT_REJECTED');}
       if(destination.protocol!=='https:'||
          destination.hostname!=='script.googleusercontent.com'||
          destination.port||destination.username||destination.password)
         throw Error('SANDBOX_COMMAND_REDIRECT_REJECTED');
       response=await fetch(destination.href,{method:'GET',redirect:'manual',signal:controller.signal});
     }
     if(!response.ok||[301,302,303,307,308].includes(response.status))
       throw Error('SANDBOX_COMMAND_HTTP_ERROR');
     const data=await response.json();
     if(!data||data.ok!==true)throw Error('SANDBOX_COMMAND_REJECTED');
     return data.result;
   } finally {clearTimeout(timer);}
 }
 async function call(action,payload={}) {
   const controller=new AbortController();
   const started=Date.now();
   const timer=setTimeout(()=>controller.abort(),15000);
   try {
     const response=await fetch(url,{method:"POST",redirect:"follow",signal:controller.signal,
       headers:{"Content-Type":"text/plain;charset=utf-8"},
       body:JSON.stringify({api_key:key,action,payload})});
     if(!response.ok)throw Error("GEN3_STORAGE_HTTP_ERROR");
     const data=await response.json();
     if(!data.ok)throw Error("GEN3_STORAGE_"+String(data.error||"FAILED"));
     return data.result;
   }catch(err){console.warn("Gen3 storage action failed",action,"ms",Date.now()-started,"error",err.name||"unknown");throw err;
   }finally{clearTimeout(timer);console.info("Gen3 storage action ms",action,Date.now()-started)}
 }
 return {
   health:async()=>call("health"),
   registerAtomic:async user=>call("registerAtomic",{user}),
   throttleAtomic:async(key,limit,window_ms)=>call("throttleAtomic",{key,limit,window_ms}),
   findByLogin:async identifier=>call("findByLogin",{identifier}),
   loginLookupAtomic:async(identifier,key,limit,window_ms)=>call("loginLookupAtomic",{identifier,key,limit,window_ms}),
   findById:async user_id=>call("findById",{user_id}),
   recordLoginFailureAtomic:async user_id=>call("recordLoginFailureAtomic",{user_id}),
   recordLoginSuccessAtomic:async user_id=>call("recordLoginSuccessAtomic",{user_id}),
   createSession:async session=>call("createSession",{session}),
   completeLoginAtomic:async(user_id,session)=>call("completeLoginAtomic",{user_id,session}),
   findSessionByHash:async hash=>call("findSessionByHash",{hash}),
   resolveSession:async hash=>call("resolveSession",{hash}),
   revokeSessionByHash:async hash=>call("revokeSessionByHash",{hash}),
   touchSession:async(session_id,expires_at,last_seen_at)=>call("touchSession",{session_id,expires_at,last_seen_at}),
   revokeSession:async(session_id,reason)=>call("revokeSession",{session_id,reason}),
   audit:async event=>call("audit",{event}),
   deviceAuthFindById:async device_id=>{
     if(typeof device_id!=='string'||!/^[A-HJ-NP-Z2-9]{8}$/.test(device_id))throw Error('INVALID_DEVICE_ID');
     return call('deviceAuthFindById',{device_id});
   },
   deviceAuthCreateAtomic:async device=>{
     const keys=['created_at','created_by_user_id','device_id','password_hash','status','updated_at'];
     if(!device||typeof device!=='object'||Array.isArray(device)||Object.keys(device).length!==keys.length||
        !keys.every(k=>Object.prototype.hasOwnProperty.call(device,k))||
        !/^[A-HJ-NP-Z2-9]{8}$/.test(device.device_id||'')||device.status!=='pre_registered'||
        !/^scrypt:v1:[A-Za-z0-9_-]{22}:[A-Za-z0-9_-]{86}$/.test(device.password_hash||'')||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(device.created_by_user_id||''))
       throw Error('INVALID_DEVICE_RECORD');
     return call('deviceAuthCreateAtomic',{device});
   },
   deviceAuthListPreRegistered:async limit=>{
     const n=limit===undefined?100:limit;if(!Number.isInteger(n)||n<1||n>100)throw Error('INVALID_DEVICE_LIMIT');
     return call('deviceAuthListPreRegistered',{limit:n});
   },
   deviceAuthGetById:async device_id=>{
     if(typeof device_id!=='string'||!/^[A-HJ-NP-Z2-9]{8}$/.test(device_id))throw Error('INVALID_DEVICE_ID');
     return call('deviceAuthGetById',{device_id});
   },
   // Generic data operations: allowlist lives in Render and GAS; no browser access.
   dbCall:async(action,payload)=>{
     if(!['db.health','db.schema','db.select','db.insert','db.update','db.delete'].includes(action))throw Error('GEN3_DB_ACTION_NOT_ALLOWED');
     return call(action,payload);
   },
   // Safe test transport: deliberately restricted to non-actuating command lookup.
   // It never enables the physical unlock routes or accepts create/claim/report.
   // GAS must still validate the signature, nonce, actor and project binding.
   commandProbe:async(payload)=>{
     if(process.env.IKEY_COMMAND_PROBE_ENABLED!=='true')
       throw Error('COMMAND_PROBE_DISABLED');
     if(!payload||typeof payload!=='object'||Array.isArray(payload))
       throw Error('INVALID_COMMAND_PROBE_OBJECT');
     const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
     if(!uuid.test(payload.project_id))throw Error('INVALID_COMMAND_PROBE_PROJECT');
     if(!/^[A-HJ-NP-Z2-9]{8}$/.test(payload.device_id))throw Error('INVALID_COMMAND_PROBE_DEVICE');
     if(!uuid.test(payload.actor_user_id))throw Error('INVALID_COMMAND_PROBE_ACTOR');
     if(!uuid.test(payload.command_id))throw Error('INVALID_COMMAND_PROBE_COMMAND');
     if(Object.keys(payload).length!==4||
       !['actor_user_id','command_id','device_id','project_id'].every(k=>Object.prototype.hasOwnProperty.call(payload,k)))
       throw Error('INVALID_COMMAND_PROBE_FIELDS');
     if(process.env.IKEY_PHYSICAL_UNLOCK_ENABLED==='true')throw Error('SANDBOX_COMMAND_PHYSICAL_UNLOCK_FORBIDDEN');
     if(process.env.IKEY_SANDBOX_COMMAND_TEST_ENABLED!=='true')throw Error('SANDBOX_COMMAND_DISABLED');
     const target=sandboxCommandTarget();
     const {signCommandAssertion}=require('../lib/command-trust-assertion');
     const assertion=signCommandAssertion({
       secret:target.trust,
       action:'deviceCommandGet',project_id:payload.project_id,
       device_id:payload.device_id,actor_user_id:payload.actor_user_id,payload
     });
     return sandboxCommandCall('deviceCommandGet',{...payload,command_assertion:assertion});
   },
   // Dedicated command transport. Requires GAS dispatcher, schema and trusted
   // identity context to be separately verified before enabling HTTP routes.
   commandCall:async(action,payload)=>{
     const allowed=['deviceCommandCreateAtomic','deviceCommandClaimAtomic',
       'deviceCommandReportAtomic','deviceCommandGet'];
     if(!allowed.includes(action))throw Error('GEN3_COMMAND_ACTION_NOT_ALLOWED');
     // This staging transport cannot enable physical unlock or production routes.
     if(process.env.IKEY_PHYSICAL_UNLOCK_ENABLED==='true')
       throw Error('SANDBOX_COMMAND_PHYSICAL_UNLOCK_FORBIDDEN');
     if(process.env.IKEY_SANDBOX_COMMAND_TEST_ENABLED!=='true')
       throw Error('SANDBOX_COMMAND_DISABLED');
     const target=sandboxCommandTarget();
     const {signCommandAssertion}=require('../lib/command-trust-assertion');
     const assertion=signCommandAssertion({
       secret:target.trust,
       action,project_id:payload?.project_id,device_id:payload?.device_id,
       actor_user_id:payload?.actor_user_id,payload
     });
     return sandboxCommandCall(action,{...payload,command_assertion:assertion});
   },
   // Trusted server-to-Apps-Script project actions; unsupported actions fail closed.
   projectCall:async(action,payload)=>{
     if(!["projectDraftSave","projectRequestsMine","projectRequestSubmit","projectReviewHistoryMine","projectCreate","projectListMine"].includes(action))throw Error("GEN3_PROJECT_ACTION_NOT_ALLOWED");
     return call(action,payload);
   }
 };
}
module.exports={createSheetsStore};
