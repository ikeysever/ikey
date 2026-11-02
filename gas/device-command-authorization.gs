/** Staging command authorization. Missing schema fails closed. */
function ikeyCmdAuthRows_(name,keys){
 const id=PropertiesService.getScriptProperties().getProperty('GEN3_SPREADSHEET_ID');
 if(!id)throw Error('COMMAND_AUTH_STORAGE_UNAVAILABLE');
 const sh=SpreadsheetApp.openById(id).getSheetByName(name);
 if(!sh||sh.getLastRow()<1)throw Error('COMMAND_AUTH_STORAGE_UNAVAILABLE');
 const cols=sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0];
 if(!keys.every(k=>cols.includes(k)))throw Error('COMMAND_AUTH_SCHEMA_MISMATCH');
 const values=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,cols.length).getValues():[];
 return values.map(row=>Object.fromEntries(cols.map((k,i)=>[k,String(row[i])])));
}
function ikeyVerifyCommandActorContext_(p){
 return !!p&&typeof p.actor_user_id==='string'&&ikeyCmdUuid_(p.actor_user_id);
}
function ikeyVerifyDeviceActor_(_action,p){
 if(!ikeyVerifyCommandActorContext_(p))return false;
 const project=ikeyCmdAuthRows_('Projects',['project_id','status','created_by_user_id'])
  .find(r=>r.project_id===p.project_id&&r.status==='active');
 if(!project)return false;
 if(project.created_by_user_id===p.actor_user_id)return true;
 return ikeyCmdAuthRows_('Project_Access',['project_id','user_id','role','status'])
  .some(r=>r.project_id===p.project_id&&r.user_id===p.actor_user_id&&
    ['owner','admin'].includes(r.role)&&r.status==='active');
}
function ikeyVerifyCommandDeviceContext_(p){
 return !!p&&ikeyCmdAuthRows_('Devices',['device_id','status'])
  .some(r=>r.device_id===p.device_id&&r.status==='pre_registered');
}
