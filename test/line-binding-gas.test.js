'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto');
const {createLineBindingTransport}=require('../lib/line-binding-transport');
const domain=require('../lib/line-binding-domain');
function context(){
 const secret='t'.repeat(32),props={IKEY_LINE_BINDING_ENABLED:'true',IKEY_LINE_TRUST_SECRET:secret,GEN3_SPREADSHEET_ID:'test'};
 const tabs=new Map();
 for(const [name,headers] of [['LINE_Bindings',domain.B],['LINE_Audit_Logs',domain.A]]){
  const data=[headers.slice()];tabs.set(name,{data,getLastRow:()=>data.length,getLastColumn:()=>data[0].length,getRange:(row,col,n,m)=>({getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>data[row+i-1]?.[col+j-1]??'')),setValues:values=>{for(let i=0;i<n;i++){data[row+i-1]??=[];for(let j=0;j<m;j++)data[row+i-1][col+j-1]=values[i][j];}}})});
 }
 const user={user_id:'u1',account_status:'active',password_hash:'test-hash',global_role:'user'};
 let locks=0;
 const c=vm.createContext({PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]})},Utilities:{Charset:{UTF_8:'utf8'},computeHmacSha256Signature:(body,key)=>Array.from(crypto.createHmac('sha256',key).update(body).digest())},SpreadsheetApp:{openById:()=>({getSheetByName:n=>tabs.get(n)}),flush(){}},locked:fn=>{locks++;return fn();},execute:(action,p)=>action==='resolveSession'?p.hash==='session'?{user,session:{expires_at:new Date(Date.now()+100000).toISOString(),revoked_at:''}}:null:user});
 vm.runInContext(fs.readFileSync('gas/line-binding-domain.gs','utf8')+'\n'+fs.readFileSync('gas/line-binding-v2.gs','utf8'),c);
 const call=async(_action,e)=>c.ikeyLineV2Dispatch_(e),transport=createLineBindingTransport(call,secret);
 return {c,tabs,props,transport,secret,locks:()=>locks};
}
test('actual GAS adapter validates signed transport and persists exact appended schemas',async()=>{
 const f=context();assert.equal((await f.transport.invoke('health')).version,'line-binding-v2');
 const digest='a'.repeat(64),r=await f.transport.invoke('create',{sessionHash:'session',sourceHash:'ip',codeDigest:digest,operationId:'create-1'});assert.equal(r.status,'pending');
 assert.equal(f.tabs.get('LINE_Bindings').data[1][domain.B.indexOf('code_digest')],digest);
 const result=await f.transport.invoke('consume',{operationId:'consume-1',eventId:'event',lineUserId:'U'+'1'.repeat(32),subjectHash:'b'.repeat(64),codeDigest:digest});assert.equal(result.status,'bound');assert.equal((await f.transport.invoke('status',{sessionHash:'session'})).binding_status,'bound');assert.equal(f.locks(),4);
});
test('GAS rejects wrong signature, expired assertion, feature off, missing schema',async()=>{
 const f=context();const bad=createLineBindingTransport(async(_a,e)=>f.c.ikeyLineV2Dispatch_({...e,body:'{}x'}),f.secret);await assert.rejects(bad.invoke('health'),/ASSERTION/);
 const stale=createLineBindingTransport(async(_a,e)=>f.c.ikeyLineV2Dispatch_({...e,timestamp:'1000000000000'}),f.secret);await assert.rejects(stale.invoke('health'),/ASSERTION/);
 f.props.IKEY_LINE_BINDING_ENABLED='false';await assert.rejects(f.transport.invoke('health'),/DISABLED/);f.props.IKEY_LINE_BINDING_ENABLED='true';f.tabs.get('LINE_Bindings').data[0].pop();await assert.rejects(f.transport.invoke('health'),/SCHEMA/);
});
