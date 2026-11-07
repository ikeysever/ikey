'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
const start=server.indexOf("app.patch('/api/projects/:projectId/other-settings'");
const end=server.indexOf("app.delete('/api/projects/:projectId'",start);
assert.ok(start>=0&&end>start,'settings route must be present');
const route=server.slice(start,end);
const id='123e4567-e89b-42d3-a456-426614174000';
const owner='owner-1';
const base={project_id:id,created_by_user_id:owner,status:'active',authorization_method:'application',scheduled_authorization:'false'};
function setup({user=owner,origin=true,rows=[base],failUpdate=false,afterUpdate=null}={}){
 let handler,updates=0,reads=0;
 let records=rows.map(x=>({...x}));
 const dbCall=async(action,args)=>{
  if(action==='db.select'){reads++;return {rows:records.filter(x=>Object.entries(args.where).every(([k,v])=>x[k]===v))};}
  if(action==='db.update'){
   updates++;
   if(failUpdate)throw Error('mock storage failure');
   records=records.map(x=>Object.entries(args.where).every(([k,v])=>x[k]===v)?{...x,...args.data}:x);
   if(afterUpdate)records=afterUpdate(records);
   return {updated:true};
  }
  throw Error('unexpected DB action');
 };
 vm.runInNewContext(route,{app:{patch:(_url,_middleware,fn)=>{handler=fn;}},requireProjectUser:()=>{},sameProjectOrigin:()=>origin,authStore:{dbCall},console,Date,URL});
 const req={params:{projectId:id},projectUser:{user_id:user},body:{status:'inactive',authorization_method:'self_registration',scheduled_authorization:true}};
 const res={statusCode:200,headers:{},set(k,v){this.headers[k]=v;return this;},status(code){this.statusCode=code;return this;},json(data){this.body=data;return this;}};
 return {handler,req,res,stats:()=>({updates,reads})};
}
test('valid owner can update and verify persisted settings',async()=>{
 const t=setup();await t.handler(t.req,t.res);
 assert.equal(t.res.statusCode,200);assert.equal(t.res.body.success,true);
 assert.equal(t.res.body.project.status,'inactive');
 assert.equal(t.res.body.project.scheduled_authorization,true);
 assert.equal(t.stats().updates,1);assert.equal(t.stats().reads,2);
});
test('non-owner is rejected without update',async()=>{
 const t=setup({user:'someone-else'});await t.handler(t.req,t.res);
 assert.equal(t.res.statusCode,403);assert.equal(t.stats().updates,0);
});
test('cross-origin request is rejected before DB calls',async()=>{
 const t=setup({origin:false});await t.handler(t.req,t.res);
 assert.equal(t.res.statusCode,403);assert.equal(t.stats().reads,0);
});
test('invalid payloads are rejected without writing',async()=>{
 for(const change of [{status:'deleted'},{scheduled_authorization:'true'},{unexpected:'value'},{authorization_method:'owner'}]){
  const t=setup();Object.assign(t.req.body,change);await t.handler(t.req,t.res);
  assert.equal(t.res.statusCode,400);assert.equal(t.stats().updates,0);
 }
});
test('deleted project is not editable',async()=>{
 const t=setup({rows:[{...base,status:'deleted'}]});await t.handler(t.req,t.res);
 assert.equal(t.res.statusCode,404);assert.equal(t.stats().updates,0);
});
test('storage error fails closed',async()=>{
 const t=setup({failUpdate:true});await t.handler(t.req,t.res);
 assert.equal(t.res.statusCode,503);assert.equal(t.res.body.success,false);
});
test('write that cannot be verified does not claim success',async()=>{
 const t=setup({afterUpdate:records=>records.map(x=>({...x,status:'active'}))});
 await t.handler(t.req,t.res);assert.equal(t.res.statusCode,503);assert.equal(t.res.body.success,false);
});
test('frontend uses scoped PATCH and waits for confirmed response',()=>{
 const js=fs.readFileSync(path.join(__dirname,'../public/project-other-settings.js'),'utf8');
 assert.match(js,/method:'PATCH'/);
 assert.match(js,/\/other-settings/);
 assert.match(js,/data\.success!==true/);
 assert.match(js,/p\.scheduled_authorization!==payload\.scheduled_authorization/);
 new Function(js);
});
