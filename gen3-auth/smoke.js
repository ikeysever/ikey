"use strict";
// Read-only Gen3 Apps Script connectivity check. Run in an environment
// where GEN3_APPS_SCRIPT_URL and GEN3_APPS_SCRIPT_KEY are already configured.
// Never print credentials or raw upstream responses.
const {createSheetsStore}=require("./sheets-store");

async function main() {
  const store=createSheetsStore();
  const email="ikey-gen3-smoke-"+Date.now()+"@example.invalid";
  const user=await store.findByEmail(email);
  if(user!==null) throw Error("UNEXPECTED_TEST_USER");
  const health=await store.health();
  if(health?.version!=="gen3-mailapp-v2"||health.storage!==true||health.mail_ready!==true)
    throw Error("GEN3_MAILAPP_NOT_READY");
  process.stdout.write("PASS: Apps Script Gen3 schema, MailApp authorization and quota (read only)\\n");
}
main().catch(err=>{
  const category=err.message==="GEN3_STORAGE_NOT_CONFIGURED"
    ? "MISSING_OR_INVALID_ENV"
    : err.name==="AbortError" ? "REQUEST_TIMEOUT" : "UPSTREAM_REQUEST_FAILED";
  process.stderr.write("FAIL: "+category+"\n");
  process.exitCode=1;
});
