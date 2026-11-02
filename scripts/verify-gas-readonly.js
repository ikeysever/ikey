'use strict';
// iKey 3.1: read-only Render -> deployed GAS connectivity check.
// No HTTP listener, no device command, no writes, no physical unlock flags.
// Run in an authorized Render shell with GEN3_APPS_SCRIPT_URL / GEN3_APPS_SCRIPT_KEY.
const {createSheetsStore}=require('../gen3-auth/sheets-store');
async function main(){
  const started=Date.now();
  try{
    const store=createSheetsStore();
    const result=await store.health();
    if(!result||result.storage!==true)throw Error('GAS_HEALTH_UNEXPECTED');
    process.stdout.write(JSON.stringify({
      check:'render_to_gas_read_only',ok:true,
      storage:true,version:typeof result.version==='string'?result.version:'unknown',
      elapsed_ms:Date.now()-started
    })+'\n');
  }catch(err){
    // Do not log error messages: upstream responses could contain sensitive text.
    process.stderr.write(JSON.stringify({
      check:'render_to_gas_read_only',ok:false,
      error_class:err?.name==='AbortError'?'TIMEOUT':'HEALTH_CHECK_FAILED',
      elapsed_ms:Date.now()-started
    })+'\n');
    process.exitCode=1;
  }
}
if(require.main===module)main();
module.exports={main};
