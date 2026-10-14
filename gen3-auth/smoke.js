"use strict";
const {createSheetsStore}=require("./sheets-store");
async function main(){
 const store=createSheetsStore();
 const user=await store.findByLogin("ikey_smoke_nonexistent_"+Date.now());
 if(user!==null)throw Error("UNEXPECTED_TEST_USER");
 const health=await store.health();
 if(health?.version!=="gen3-username-v3"||health.storage!==true)throw Error("GEN3_USERNAME_STORAGE_NOT_READY");
 process.stdout.write("PASS: Gen3 username-only Apps Script schema (read only)\n");
}
main().catch(err=>{
 const category=err.message==="GEN3_STORAGE_NOT_CONFIGURED"?"MISSING_OR_INVALID_ENV":
   err.name==="AbortError"?"REQUEST_TIMEOUT":"UPSTREAM_REQUEST_FAILED";
 process.stderr.write("FAIL: "+category+"\n");process.exitCode=1;
});
