'use strict';
const PROJECT_CREATE_FIELDS=Object.freeze(['project_name','description','authorization_method','scheduled_authorization','notification_theme','notification_sound_pack','notification_volume']);
function unsupportedProjectCreateFields(body){
 if(!body||typeof body!=='object'||Array.isArray(body))return null;
 const allowed=new Set(PROJECT_CREATE_FIELDS);
 return Object.keys(body).filter(key=>!allowed.has(key));
}
module.exports={PROJECT_CREATE_FIELDS,unsupportedProjectCreateFields};
