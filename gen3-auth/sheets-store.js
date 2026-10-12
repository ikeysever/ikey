"use strict";
// Dedicated Apps Script writer. Never reuse the unauthenticated legacy API.
function createSheetsStore() {
 const url=process.env.GEN3_APPS_SCRIPT_URL;
 const key=process.env.GEN3_APPS_SCRIPT_KEY;
 if(!url || !/^https:\/\/script\.google\.com\//.test(url) || !key || key.length<32)
   throw Error("GEN3_STORAGE_NOT_CONFIGURED");
 async function call(action,payload={}) {
   const controller=new AbortController();
   const timer=setTimeout(()=>controller.abort(),15000);
   try {
     const response=await fetch(url,{method:"POST",redirect:"follow",signal:controller.signal,
       headers:{"Content-Type":"text/plain;charset=utf-8"},
       body:JSON.stringify({api_key:key,action,payload})});
     if(!response.ok)throw Error("GEN3_STORAGE_HTTP_ERROR");
     const data=await response.json();
     if(!data.ok)throw Error("GEN3_STORAGE_"+String(data.error||"FAILED"));
     return data.result;
   }finally{clearTimeout(timer)}
 }
 return {
   registerAtomic:async user=>call("registerAtomic",{user}),
   findByEmail:async email=>call("findByEmail",{email}),
   findById:async user_id=>call("findById",{user_id}),
   recordLoginFailureAtomic:async user_id=>call("recordLoginFailureAtomic",{user_id}),
   recordLoginSuccessAtomic:async user_id=>call("recordLoginSuccessAtomic",{user_id}),
   createSession:async session=>call("createSession",{session}),
   findSessionByHash:async hash=>call("findSessionByHash",{hash}),
   touchSession:async(session_id,expires_at,last_seen_at)=>call("touchSession",{session_id,expires_at,last_seen_at}),
   revokeSession:async(session_id,reason)=>call("revokeSession",{session_id,reason}),
   audit:async event=>call("audit",{event})
 };
}
module.exports={createSheetsStore};
