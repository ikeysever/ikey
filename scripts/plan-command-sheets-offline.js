'use strict';
/** Offline-only schema planner. Never connects to Google Sheets. */
const EXISTING=Object.freeze(['Users','Gen3_Users','Auth_Tokens','Auth_Sessions','Auth_Audit_Logs','Projects','Project_Access','Devices']);
const NEW=Object.freeze({
 Project_Devices:['binding_id','project_id','device_id','display_name','lock_mode','heartbeat_interval_minutes','auto_firmware_update','bound_by','bound_at','updated_at'],
 DeviceCommands:['command_id','project_id','device_id','actor_user_id','action','idempotency_key','fingerprint','status','created_at','deadline_at','claimed_at','finished_at','claim_token_hash','feedback_observed','result'],
 DeviceCommandEvents:['event_id','command_id','device_id','event_type','occurred_at','details'],
 DeviceCommandNonces:['nonce','expires_at']
});
function planCommandSheets(existingNames){
 if(!Array.isArray(existingNames)||existingNames.some(x=>typeof x!=='string')||new Set(existingNames).size!==existingNames.length)throw Error('INVALID_EXISTING_SHEETS');
 if(EXISTING.some(name=>!existingNames.includes(name)))throw Error('BASELINE_SHEETS_MISSING');
 const duplicates=Object.keys(NEW).filter(name=>existingNames.includes(name));
 if(duplicates.length)throw Error('COMMAND_SHEET_NAME_CONFLICT:'+duplicates.join(','));
 return Object.entries(NEW).map(([name,headers])=>({name,headers:[...headers],rows:[ [...headers] ]}));
}
module.exports={EXISTING,NEW,planCommandSheets};
