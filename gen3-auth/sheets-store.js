"use strict";
// Dedicated Apps Script writer. Never reuse the unauthenticated legacy API.
function createSheetsStore() {
 const url=process.env.GEN3_APPS_SCRIPT_URL;
 const key=process.env.GEN3_APPS_SCRIPT_KEY;
 if(!url || !/^https:\/\/script\.google\.com\//.test(url) || !key || key.length<32)
   throw Error("GEN3_STORAGE_NOT_CONFIGURED");
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
   // Generic data operations: allowlist lives in Render and GAS; no browser access.
   dbCall:async(action,payload)=>{
     if(!['db.health','db.schema','db.select','db.insert','db.update','db.delete'].includes(action))throw Error('GEN3_DB_ACTION_NOT_ALLOWED');
     return call(action,payload);
   },
   // Trusted server-to-Apps-Script project actions; unsupported actions fail closed.
   projectCall:async(action,payload)=>{
     if(!["projectDraftSave","projectRequestsMine","projectRequestSubmit","projectReviewHistoryMine","projectCreate","projectListMine"].includes(action))throw Error("GEN3_PROJECT_ACTION_NOT_ALLOWED");
     return call(action,payload);
   }
 };
}
module.exports={createSheetsStore};
