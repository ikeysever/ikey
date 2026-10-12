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
  process.stdout.write("PASS: Render/Node -> Apps Script -> Gen3_Users (read only)\n");
}
main().catch(err=>{
  const category=err.message==="GEN3_STORAGE_NOT_CONFIGURED"
    ? "MISSING_OR_INVALID_ENV"
    : err.name==="AbortError" ? "REQUEST_TIMEOUT" : "UPSTREAM_REQUEST_FAILED";
  process.stderr.write("FAIL: "+category+"\n");
  process.exitCode=1;
});
