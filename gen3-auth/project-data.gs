/**
 * iKey P1 Projects and access storage. All calls originate from the keyed
 * Render backend. Project permissions are checked again within this GAS layer.
 * Project_Access keeps one invite configuration and member application rows
 * per project. There are no raw unlock or device controls here.
 */
const PROJECT_UUID=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
function projectRecord(id){return rows("Projects").find(r=>r.value.project_id===id);}
function accessOwner(id,actor){
 const p=projectRecord(id);
 if(!p||p.value.created_by_user_id!==actor||p.value.status==="deleted")throw Error("PROJECT_FORBIDDEN");
 return p;
}
function accessActiveUser(actor){
 if(!actor||!rows(TABS.users).some(r=>r.value.user_id===actor&&r.value.account_status==="active"))throw Error("ACTOR_NOT_ACTIVE");
}
function accessAudit(actor,event,projectId){
 append(TABS.audit,{audit_id:Utilities.getUuid(),user_id:actor,event_type:event,result:"success",auth_method:"session",ip_address:"",user_agent:"",details:projectId,created_at:new Date().toISOString()});
}
function accessRows(){return rows(TABS.access)}
function accessProjectConfig(id){return accessRows().find(r=>r.value.project_id===id&&r.value.entry_type==="config")}
function accessMember(id,actor){return accessRows().find(r=>r.value.project_id===id&&r.value.entry_type==="member"&&r.value.user_id===actor)}
function publicProject(p,role){
 const copy={...p};
 delete copy.invite_hash;
 copy.project_role=role;
 return copy;
}
function executeProjectData(action,p){
 // Generic Projects API is intentionally narrower than dbCall's action list.
 if(action==="db.health")return {ready:Boolean(sheet("Projects")),version:"ikey-projects-v1"};
 if(action==="db.schema")return {Projects:HEADERS.Projects};
 const name=String(p.table||"");
 if(name!=="Projects")throw Error("DB_TABLE_NOT_ALLOWED");
 sheet("Projects");
 if(action==="db.select"){
  const where=p.where||{};
  if(!where||typeof where!=="object"||Array.isArray(where)||
    !Object.keys(where).length||Object.keys(where).some(k=>!["project_id","created_by_user_id","status"].includes(k)))throw Error("DB_WHERE_FORBIDDEN");
  if(!where.created_by_user_id&&!where.project_id)throw Error("DB_WHERE_REQUIRED");
  const n=Number(p.limit||100);
  if(!Number.isInteger(n)||n<1||n>100)throw Error("DB_LIMIT_INVALID");
  return {rows:rows(name).map(r=>r.value).filter(r=>Object.keys(where).every(k=>r[k]===String(where[k]))).slice(0,n)};
 }
 if(action==="db.insert")return locked(()=>{
  const v=p.data||{};
  if(p.primary_key!=="project_id"||!PROJECT_UUID.test(String(v.project_id||""))||
   !PROJECT_UUID.test(String(v.created_by_user_id||""))||
   !String(v.project_name||"").trim()||String(v.project_name).length>80||
   !["application","self_registration"].includes(v.authorization_method)||
   !["active"].includes(v.status)||
   !["true","false"].includes(String(v.scheduled_authorization))||
   !["midnight","polar","emerald","copper","violet","graphite"].includes(v.notification_theme)||
   !["pulse","crystal","air","wood","future","click"].includes(v.notification_sound_pack)||
   !/^(100|[1-9]?\\d)$/.test(String(v.notification_volume))||
   String(v.description||"").length>1000||
   !v.created_at||!v.updated_at||
   Object.keys(v).some(k=>!HEADERS.Projects.includes(k)))throw Error("INVALID_PROJECT");
  if(rows(name).some(r=>r.value.project_id===v.project_id))throw Error("DUPLICATE_PROJECT");
  append(name,v);return {inserted:true,record:{...v}};
 });
 if(action==="db.update")return locked(()=>{
  const where=p.where||{},data=p.data||{};
  if(!PROJECT_UUID.test(String(where.project_id||""))||
   !PROJECT_UUID.test(String(where.created_by_user_id||""))||
   Object.keys(where).some(k=>!["project_id","created_by_user_id","status"].includes(k))||
   !Object.keys(data).length||Object.keys(data).some(k=>!["project_name","description","notification_theme","notification_sound_pack","notification_volume","updated_at","status"].includes(k)))throw Error("DB_UPDATE_FORBIDDEN");
  if("status"in data&&data.status!=="deleted")throw Error("INVALID_STATUS_CHANGE");
  if("project_name"in data&&(!String(data.project_name).trim()||String(data.project_name).length>80))throw Error("INVALID_PROJECT_NAME");
  if("description"in data&&String(data.description).length>1000)throw Error("INVALID_PROJECT_DESCRIPTION");
  if("notification_theme"in data&&!["midnight","polar","emerald","copper","violet","graphite"].includes(data.notification_theme))throw Error("INVALID_THEME");
  if("notification_sound_pack"in data&&!["pulse","crystal","air","wood","future","click"].includes(data.notification_sound_pack))throw Error("INVALID_SOUND_PACK");
  if("notification_volume"in data&&!/^(100|[1-9]?\\d)$/.test(String(data.notification_volume)))throw Error("INVALID_VOLUME");
  const r=rows(name).find(r=>r.value.project_id===where.project_id&&r.value.created_by_user_id===where.created_by_user_id&&
   (!where.status||r.value.status===where.status)&&r.value.status!=="deleted");
  if(!r)return {updated:false,updated_count:0};
  const next={...r.value,...data};overwrite(name,r.index,next);
  if(next.status==="deleted")accessAudit(where.created_by_user_id,"project_soft_delete",where.project_id);
  return {updated:true,updated_count:1};
 });
 throw Error("DB_ACTION_NOT_ALLOWED");
}
function executeProjectAccess(action,p){
 const actor=String(p.actor_user_id||"");
 if(!PROJECT_UUID.test(actor))throw Error("ACTOR_INVALID");
 accessActiveUser(actor);
 if(action==="projectAccessConfigure")return locked(()=>{
  const id=String(p.project_id||""),policy=String(p.join_policy||""),hash=String(p.invite_hash||"");
  if(!PROJECT_UUID.test(id)||!["direct","approval"].includes(policy)||!/^[a-f0-9]{64}$/.test(hash))throw Error("INVITE_INVALID");
  accessOwner(id,actor);
  const now=new Date().toISOString(),v={entry_id:"config-"+id,project_id:id,entry_type:"config",user_id:"",role:"",status:"active",invite_hash:hash,join_policy:policy,created_at:now,updated_at:now,reviewed_by:""};
  const old=accessProjectConfig(id);
  if(old){v.created_at=old.value.created_at;overwrite(TABS.access,old.index,v)}else append(TABS.access,v);
  accessAudit(actor,"project_invite_rotated",id);
  return {configured:true,project_id:id,join_policy:policy};
 });
 if(action==="projectAccessJoin")return locked(()=>{
  const hash=String(p.invite_hash||"");
  if(!/^[a-f0-9]{64}$/.test(hash))throw Error("INVALID_INVITE_CODE");
  const cfg=accessRows().find(r=>r.value.entry_type==="config"&&r.value.status==="active"&&r.value.invite_hash===hash);
  if(!cfg)return {joined:false,reason:"INVALID_INVITE_CODE"};
  const project=projectRecord(cfg.value.project_id)?.value;
  if(!project||project.status!=="active")return {joined:false,reason:"INVITE_INACTIVE"};
  if(project.created_by_user_id===actor)return {joined:false,reason:"ALREADY_OWNER",project_id:project.project_id};
  const existing=accessMember(project.project_id,actor);
  if(existing&&existing.value.status==="active")return {joined:true,project_id:project.project_id,project_name:project.project_name,status:"active",already_member:true};
  if(existing&&existing.value.status==="pending")return {joined:true,project_id:project.project_id,project_name:project.project_name,status:"pending",already_member:true};
  const now=new Date().toISOString(),status=cfg.value.join_policy==="direct"?"active":"pending";
  const v={entry_id:existing?existing.value.entry_id:Utilities.getUuid(),project_id:project.project_id,entry_type:"member",user_id:actor,role:"member",status,invite_hash:"",join_policy:"",created_at:existing?existing.value.created_at:now,updated_at:now,reviewed_by:""};
  if(existing)overwrite(TABS.access,existing.index,v);else append(TABS.access,v);
  accessAudit(actor,status==="active"?"project_join_direct":"project_join_requested",project.project_id);
  return {joined:true,project_id:project.project_id,project_name:project.project_name,status};
 });
 if(action==="projectAccessMine")return (()=>{
  const owned=rows("Projects").filter(r=>r.value.created_by_user_id===actor&&r.value.status!=="deleted").map(r=>publicProject(r.value,"admin"));
  const joined=accessRows().filter(r=>r.value.entry_type==="member"&&r.value.user_id===actor&&r.value.status==="active").map(r=>{
   const project=projectRecord(r.value.project_id)?.value;
   return project&&project.status!=="deleted"?publicProject(project,r.value.role||"member"):null;
  }).filter(Boolean);
  return {projects:[...owned,...joined.filter(p=>!owned.some(o=>o.project_id===p.project_id))]};
 })();
 if(action==="projectAccessGet")return (()=>{
  const id=String(p.project_id||"");
  if(!PROJECT_UUID.test(id))throw Error("PROJECT_ID_INVALID");
  const project=projectRecord(id)?.value;
  if(!project||project.status==="deleted")return null;
  if(project.created_by_user_id===actor)return publicProject(project,"admin");
  const member=accessMember(id,actor);
  return member&&member.value.status==="active"?publicProject(project,member.value.role||"member"):null;
 })();
 if(action==="projectAccessList")return (()=>{
  const id=String(p.project_id||"");
  accessOwner(id,actor);
  const users=new Map(rows(TABS.users).map(r=>[r.value.user_id,r.value.display_name]));
  const members=accessRows().filter(r=>r.value.project_id===id&&r.value.entry_type==="member").map(r=>({
   entry_id:r.value.entry_id,user_id:r.value.user_id,display_name:users.get(r.value.user_id)||"已停用的帳號",
   role:r.value.role,status:r.value.status,created_at:r.value.created_at,updated_at:r.value.updated_at
  }));
  return {join_policy:accessProjectConfig(id)?.value.join_policy||"",members};
 })();
 if(action==="projectAccessReview")return locked(()=>{
  const id=String(p.project_id||""),entryId=String(p.entry_id||""),decision=String(p.decision||"");
  if(!PROJECT_UUID.test(id)||!PROJECT_UUID.test(entryId)||!["approve","reject"].includes(decision))throw Error("INVALID_REVIEW");
  accessOwner(id,actor);
  const record=accessRows().find(r=>r.value.project_id===id&&r.value.entry_type==="member"&&r.value.entry_id===entryId);
  if(!record||record.value.status!=="pending")return {reviewed:false,reason:"NO_PENDING_REQUEST"};
  record.value.status=decision==="approve"?"active":"rejected";
  record.value.updated_at=new Date().toISOString();record.value.reviewed_by=actor;
  overwrite(TABS.access,record.index,record.value);
  accessAudit(actor,"project_join_"+decision,id);
  return {reviewed:true,entry_id:entryId,status:record.value.status};
 });
 throw Error("PROJECT_ACCESS_ACTION_NOT_ALLOWED");
}
