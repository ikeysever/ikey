'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createLineScheduleFlow,PERMANENT_END}=require('../lib/line-schedule-flow');
const lineId='U'+'a'.repeat(32);
function fixture(){
 const project={project_id:'project-1',project_name:'保留',created_by_user_id:'u',status:'active'};
 const binding={binding_id:'b',user_id:'u',line_user_id:lineId,status:'bound',schedule_version:0,schedule_state:{},favorite_project_ids:[]};
 const tables={Projects:[project,{...project,project_id:'deleted',status:'deleted',project_name:'123'}],Project_Access:[],Project_Devices:[{project_id:'project-1',device_id:'ABCDEFGH'}],Project_Access_Requests:[],LINE_Bindings:[binding]};
 const store={async dbCall(action,p){const rows=tables[p.table];const matches=rows.filter(r=>Object.entries(p.where||{}).every(([k,v])=>r[k]===v));if(action==='db.select')return {rows:structuredClone(matches),limited:false};if(action==='db.update'){for(const r of matches)Object.assign(r,structuredClone(p.data));return {count:matches.length};}if(action==='db.insert'){if(rows.some(r=>r[p.primary_key]===p.data[p.primary_key]))throw Error('DUPLICATE');rows.push(structuredClone(p.data));return {record:p.data};}throw Error(action)}};
 let service=createLineScheduleFlow(store);
 async function send(action,arg){const event=action==='text'?{type:'message',source:{userId:lineId}}:{type:'postback',source:{userId:lineId},postback:{data:['ikey_schedule',binding.schedule_version,action,arg||''].join(':')}};return service.handle({binding:structuredClone(binding),userId:'u',event,command:action==='text'?arg:''});}
 return {binding,tables,send,store,restart(){service=createLineScheduleFlow(store)}};
}
test('complete permanent application, persisted favorites, restart and duplicate submit',async()=>{
 const f=fixture();let result=await f.send('text','排程申請');assert(!JSON.stringify(result).includes('123'));
 await f.send('manage');await f.send('favorite','project-1');assert.deepEqual(f.binding.favorite_project_ids,['project-1']);
 await f.send('project','project-1');await f.send('device','ABCDEFGH');
 await f.send('text','永久');assert.equal(f.binding.schedule_state.step,'time_confirm');
 await f.send('time_ok');await f.send('text','器材維護');f.restart();
 result=await f.send('submit');assert(JSON.stringify(result).includes('申請已送出'));assert.equal(f.tables.Project_Access_Requests.length,1);assert.equal(f.tables.Project_Access_Requests[0].end_at,PERMANENT_END);
 await f.send('submit');assert.equal(f.tables.Project_Access_Requests.length,1);
 result=await f.send('requests');assert(JSON.stringify(result).includes('待審核'));
});
test('invalid time retains selection and removed projects cannot submit',async()=>{
 const f=fixture();await f.send('text','排程申請');await f.send('project','project-1');await f.send('device','ABCDEFGH');await f.send('text','20260230 8:00-10:00');assert.equal(f.binding.schedule_state.step,'time');assert.equal(f.binding.schedule_state.device_id,'ABCDEFGH');
 await f.send('text','永久');await f.send('time_ok');await f.send('text','維護');f.tables.Projects[0].status='deleted';await assert.rejects(f.send('submit'));assert.equal(f.tables.Project_Access_Requests.length,0);
});
test('old postbacks and six digit verification codes do not change draft',async()=>{
 const f=fixture();await f.send('text','排程申請');const before=structuredClone(f.binding);assert.equal(await f.send('text','123456'),null);assert.deepEqual(f.binding,before);
});
test('LINE menu routes entry, postback and text into the same durable flow',async()=>{
 const {createLineMenuService}=require('../lib/line-menu-service');const f=fixture();f.tables.Gen3_Users=[{user_id:'u',account_status:'active'}];f.tables.LINE_Audit_Logs=[];
 let reply;const menu=createLineMenuService(f.store,{LINE_MESSAGING_CHANNEL_SECRET:'test',LINE_MESSAGING_ACCESS_TOKEN:'test'},async(url,options)=>{reply=JSON.parse(options.body);return {ok:true}});
 const event={source:{type:'user',userId:lineId},replyToken:'test',type:'message',message:{type:'text',text:'排程申請'}};
 assert.equal((await menu.handle(event)).status,'handled');assert.equal(reply.messages[0].type,'flex');assert.equal(f.binding.schedule_state.step,'projects');
 const data=reply.messages[0].contents.footer.contents.find(b=>b.action.data.includes(':project:')).action.data;
 assert.equal((await menu.handle({...event,type:'postback',postback:{data}})).status,'handled');assert.equal(f.binding.schedule_state.step,'devices');
});
