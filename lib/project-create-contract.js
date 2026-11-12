'use strict';
const PROJECT_CREATE_FIELDS=Object.freeze(['project_name','description','authorization_method','scheduled_authorization','notification_theme','notification_sound_pack','notification_volume','feature_modules']);
function unsupportedProjectCreateFields(body){
 if(!body||typeof body!=='object'||Array.isArray(body))return null;
 const allowed=new Set(PROJECT_CREATE_FIELDS);
 return Object.keys(body).filter(key=>!allowed.has(key));
}
const FEATURE_MODULE_IDS=Object.freeze(['key_checkout','key_return','reservations','device_management','notifications','audit_log']);
function validateFeatureModules(value){
 return Array.isArray(value)&&value.length<=FEATURE_MODULE_IDS.length&&new Set(value).size===value.length&&value.every(id=>typeof id==='string'&&FEATURE_MODULE_IDS.includes(id));
}
module.exports={PROJECT_CREATE_FIELDS,FEATURE_MODULE_IDS,validateFeatureModules,unsupportedProjectCreateFields};
