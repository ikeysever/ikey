/** iKey P1 device actor authorization for keyed Gen3 GAS calls.
 * Must be deployed in the SAME Apps Script project as project-data.gs,
 * gas-device-actions.gs and the authenticated doPost dispatcher.
 * Security boundary: only call after GEN3_API_KEY verification in doPost.
 * Do not expose this function through generic db.* dispatch.
 */
function ikeyVerifyDeviceActor_(action,p){
 const actor=String(p&&p.actor_user_id||'');
 if(!/^[0-9a-f-]{36}$/i.test(actor))return false;
 const user=findRow(TABS.users,'user_id',actor);
 if(!user||user.value.account_status!=='active')return false;
 if(action==='factoryDeviceRegister'){
  const ids=String(PropertiesService.getScriptProperties().getProperty('IKEY_SUPER_ADMIN_USER_IDS')||'').split(',').map(x=>x.trim());
  return ids.includes(actor);
 }
 if(!['factoryDeviceCredentialGet','factoryDeviceBind','factoryDeviceList','factoryDeviceUpdate'].includes(action))return false;
 const projectId=String(p.project_id||'');
 if(!/^[0-9a-f-]{36}$/i.test(projectId))return false;
 const project=executeProjectAccess('projectAccessGet',{actor_user_id:actor,project_id:projectId});
 return Boolean(project&&project.project_role==='admin');
}
