'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createLineMenuService}=require('../lib/line-menu-service');
const LINE='U'+'a'.repeat(32);
function fixture({bound=true,active=true,device='ABCDEFGH',member=false}={}){
 const dbCalls=[],sent=[];
 const store={dbCall:async(action,args)=>{
  dbCalls.push({action,args});
  if(action==='db.insert')return {count:1};
  const rows={
   LINE_Bindings:bound?[{binding_id:'binding-1',line_user_id:LINE,status:'bound',user_id:'owner'}]:[],
   Gen3_Users:[{user_id:'owner',account_status:active?'active':'disabled',global_role:'user'}],
   Projects:[{project_id:'project-1',created_by_user_id:member?'someone-else':'owner',status:'active',project_name:'Test project'}],
   Project_Access:member?[{project_id:'project-1',user_id:'owner',role:'member',status:'approved',entry_type:'member'}]:[],
   Project_Devices:[{project_id:'project-1',device_id:device,status:'active'}],
   Devices:[{device_id:device,status:'pre_registered'}],
   Project_Access_Requests:[]
  };
  return {rows:rows[args.table]||[],limited:false};
 }};
 const fetcher=async(url,opts)=>{sent.push({url,body:JSON.parse(opts.body)});return {ok:true,status:200}};
 const service=createLineMenuService(store,{LINE_MESSAGING_CHANNEL_SECRET:'test',LINE_MESSAGING_ACCESS_TOKEN:'test'},fetcher);
 const event=(message)=>({type:'message',source:{type:'user',userId:LINE},replyToken:'test-reply-token',message:{type:'text',text:message}});
 return {service,event,sent,dbCalls};
}
test('LINE direct open validates authorization but never sends a physical unlock',async()=>{
 const f=fixture();
 const result=await f.service.handle(f.event('打開 ABCDEFGH'));
 assert.equal(result.status,'handled');
 assert.equal(f.sent.length,2);
 const output=f.sent.at(-1).body.messages[0].text;
 assert.match(output,/實體指令服務尚未啟用/);
 assert.ok(f.dbCalls.every(x=>x.action==='db.select'||(x.action==='db.insert'&&x.args.table==='LINE_Audit_Logs')));
});
test('LINE direct open rejects invalid device identifier without unlock',async()=>{
 const f=fixture();
 const result=await f.service.handle(f.event('打開 bad-id'));
 assert.equal(result.status,'handled');
 assert.match(f.sent.at(-1).body.messages[0].text,/格式不正確/);
 assert.ok(!f.dbCalls.some(x=>x.args.table==='Device_Test_Commands'));
});
test('LINE direct open denies nonmember without unlock',async()=>{
 const f=fixture({member:true});
 const result=await f.service.handle(f.event('打開 ABCDEFGH'));
 assert.equal(result.status,'handled');
 assert.match(f.sent.at(-1).body.messages[0].text,/沒有有效開鎖權限/);
});
test('LINE direct open denies unknown device',async()=>{
 const f=fixture();
 const result=await f.service.handle(f.event('打開 ABCDEFGJ'));
 assert.equal(result.status,'handled');
 assert.match(f.sent.at(-1).body.messages[0].text,/找不到可用裝置/);
});
test('LINE redelivery does not create a second action',async()=>{
 const f=fixture();
 const event=f.event('打開 ABCDEFGH');event.deliveryContext={isRedelivery:true};
 assert.equal((await f.service.handle(event)).status,'ignored');
 assert.equal(f.sent.length,0);assert.equal(f.dbCalls.length,0);
});
test('LINE unbound account cannot use unlock',async()=>{
 const f=fixture({bound:false});
 const result=await f.service.handle(f.event('開鎖'));
 assert.equal(result.status,'handled');
 assert.match(f.sent[0].body.messages[0].text,/請先完成 LINE 帳號綁定/);
});
