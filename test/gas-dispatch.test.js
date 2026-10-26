'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const USER='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const GUEST='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PROJECT='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const SECRET='gen3-test-key-'+('x'.repeat(48));
const HEADERS={
 Gen3_Users:['user_id','password_hash','display_name','global_role','account_status','failed_login_attempts','locked_until','created_at','updated_at','username'],
 Auth_Tokens:['token_id','user_id','token_hash','purpose','created_at','expires_at','used_at'],
 Auth_Sessions:['session_id','user_id','session_token_hash','created_at','expires_at','last_seen_at','revoked_at','revoked_reason'],
 Auth_Audit_Logs:['audit_id','user_id','event_type','result','auth_method','ip_address','user_agent','details','created_at'],
 Projects:['project_id','project_name','description','created_by_user_id','authorization_method','scheduled_authorization','status','created_at','updated_at','notification_theme','notification_sound_pack','notification_volume'],
 Project_Access:['entry_id','project_id','entry_type','user_id','role','status','invite_hash','join_policy','created_at','updated_at','reviewed_by']
};
function runtime(){
 const sheets=Object.fromEntries(Object.entries(HEADERS).map(([name,headers])=>[name,[...([headers])]]));
 for(const [id,name] of [[USER,'Admin'],[GUEST,'Guest']]){
  const person={user_id:id,display_name:name,global_role:'user',account_status:'active',username:name.toLowerCase()};
  sheets.Gen3_Users.push(HEADERS.Gen3_Users.map(key=>person[key]||''));
 }
 let serial=0;
 const fakeSheet=name=>{
  const cells=sheets[name];
  if(!cells)return null;
  return {
   getLastRow:()=>cells.length,
   getRange:(row,col,height=1,width=1)=>({
    getValues:()=>Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>cells[row-1+i]?.[col-1+j]??'')),
    setValues:values=>{
     assert.equal(values.length,height);
     values.forEach((line,i)=>{
      assert.equal(line.length,width);
      while(cells.length<row+i)cells.push([]);
      line.forEach((value,j)=>{cells[row-1+i][col-1+j]=value;});
     });
    }
   }),
   appendRow:line=>cells.push([...line]),
   deleteRow:index=>cells.splice(index-1,1)
  };
 };
 const context=vm.createContext({
  SpreadsheetApp:{openById:()=>({getSheetByName:fakeSheet})},
  PropertiesService:{getScriptProperties:()=>({getProperty:key=>({GEN3_SPREADSHEET_ID:'mock-spreadsheet',GEN3_API_KEY:SECRET})[key]||''})},
  ContentService:{MimeType:{JSON:'application/json'},createTextOutput:contents=>({getContent:()=>contents,setMimeType(){return this;}})},
  Utilities:{getUuid:()=> '00000000-0000-4000-8000-'+String(++serial).padStart(12,'0')},
  LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},
  Logger:{log:()=>{}}
 });
 for(const file of ['Code.gs','project-data.gs']){
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../gen3-auth',file),'utf8'),context,{filename:file});
 }
 const invoke=(action,payload={},api_key=SECRET)=>{
  const response=vm.runInContext('doPost',context)({postData:{contents:JSON.stringify({api_key,action,payload})}});
  return JSON.parse(response.getContent());
 };
 return {invoke,sheets};
}
function expectOk(value){assert.equal(value.ok,true,JSON.stringify(value));return value.result;}
test('real Apps Script dispatch works with mock Sheets service',()=>{
 const {invoke,sheets}=runtime();
 assert.equal(invoke('health',{}).result.storage,true);
 assert.equal(invoke('health',{},'wrong').error,'UNAUTHORIZED');
 const ready=expectOk(invoke('db.health'));
 assert.equal(ready.version,'ikey-projects-v1');
 assert.equal(ready.access_schema,'project-access-v1');
 const timestamp='2026-10-26T00:00:00.000Z';
 const project={
  project_id:PROJECT,project_name:'Shared classroom',description:'',
  created_by_user_id:USER,authorization_method:'application',
  scheduled_authorization:'false',status:'active',created_at:timestamp,updated_at:timestamp,
  notification_theme:'midnight',notification_sound_pack:'pulse',notification_volume:'50'
 };
 assert.equal(expectOk(invoke('db.insert',{table:'Projects',primary_key:'project_id',data:project})).inserted,true);
 assert.equal(expectOk(invoke('projectAccessMine',{actor_user_id:USER})).projects[0].project_role,'admin');
 assert.equal(invoke('projectAccessConfigure',{actor_user_id:GUEST,project_id:PROJECT,join_policy:'direct',invite_hash:'a'.repeat(64)}).ok,false);
 assert.equal(expectOk(invoke('projectAccessConfigure',{actor_user_id:USER,project_id:PROJECT,join_policy:'approval',invite_hash:'a'.repeat(64)})).configured,true);
 assert.equal(expectOk(invoke('projectAccessJoin',{actor_user_id:GUEST,invite_hash:'a'.repeat(64)})).status,'pending');
 assert.equal(expectOk(invoke('projectAccessGet',{actor_user_id:GUEST,project_id:PROJECT})),null);
 const members=expectOk(invoke('projectAccessList',{actor_user_id:USER,project_id:PROJECT})).members;
 assert.equal(members[0].role,'admin');
 const waiting=members.find(m=>m.status==='pending');
 assert.ok(waiting);
 assert.equal(expectOk(invoke('projectAccessReview',{actor_user_id:USER,project_id:PROJECT,entry_id:waiting.entry_id,decision:'approve'})).status,'active');
 assert.equal(expectOk(invoke('projectAccessGet',{actor_user_id:GUEST,project_id:PROJECT})).project_role,'member');
 assert.equal(expectOk(invoke('projectAccessConfigure',{actor_user_id:USER,project_id:PROJECT,join_policy:'direct',invite_hash:'b'.repeat(64)})).configured,true);
 assert.equal(expectOk(invoke('projectAccessJoin',{actor_user_id:GUEST,invite_hash:'a'.repeat(64)})).joined,false);
 assert.equal(expectOk(invoke('db.update',{table:'Projects',where:{project_id:PROJECT,created_by_user_id:USER,status:'active'},data:{status:'deleted',updated_at:'2026-10-26T00:10:00.000Z'}})).updated,true);
 assert.equal(expectOk(invoke('projectAccessGet',{actor_user_id:GUEST,project_id:PROJECT})),null);
 const auditEvents=sheets.Auth_Audit_Logs.map(row=>row[HEADERS.Auth_Audit_Logs.indexOf('event_type')]);
 assert.ok(auditEvents.includes('project_invite_rotated'));
 assert.ok(auditEvents.includes('project_join_approve'));
 assert.ok(auditEvents.includes('project_soft_delete'));
});
