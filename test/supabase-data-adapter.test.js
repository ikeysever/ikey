'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createSupabaseDataAdapter}=require('../lib/supabase-data-adapter');
const options={url:'https://example.supabase.co',key:'test-secret'};
test('rejects missing credentials',()=>assert.throws(()=>createSupabaseDataAdapter({url:'',key:''}),/NOT_CONFIGURED/));
test('rejects unknown tables and unsupported writes before network',async()=>{
 const store=createSupabaseDataAdapter({...options,fetchImpl:()=>{throw Error('NETWORK_CALLED')}});
 await assert.rejects(store.dbCall('db.select',{table:'Users'}),/TABLE_DENIED/);
 await assert.rejects(store.dbCall('db.update',{table:'Projects'}),/NOT_IMPLEMENTED/);
 await assert.rejects(store.dbCall('db.select',{table:'Projects',where:{'id=gt.0':'x'}}),/INVALID_FILTER/);
});
test('select uses encoded exact-match filters and secret server headers',async()=>{
 let called;
 const store=createSupabaseDataAdapter({...options,fetchImpl:async(url,init)=>{
  called={url,init};return {ok:true,json:async()=>[{project_id:'p1'}]};
 }});
 const result=await store.dbCall('db.select',{table:'Projects',where:{created_by_user_id:'u1'},limit:5});
 assert.equal(result.rows[0].project_id,'p1');
 assert.match(called.url,/created_by_user_id=eq.u1/);
 assert.equal(called.init.headers.apikey,'test-secret');
});
test('insert requires exact primary key and verifies returned row',async()=>{
 const store=createSupabaseDataAdapter({...options,fetchImpl:async()=>({ok:true,json:async()=>[{project_id:'p1'}]})});
 await assert.rejects(store.dbCall('db.insert',{table:'Projects',primary_key:'bad',data:{project_id:'p1'}}),/INVALID_INSERT/);
 const result=await store.dbCall('db.insert',{table:'Projects',primary_key:'project_id',data:{project_id:'p1'}});
 assert.equal(result.inserted,true);
});

test('401 error categorization never leaks server-provided details',async()=>{
 const secret='PRIVATE-SECRET-DO-NOT-LOG';
 const store=createSupabaseDataAdapter({...options,key:secret,fetchImpl:async()=>({
   ok:false,status:401,json:async()=>({code:'invalid_api_key',message:'Sensitive '+secret})
 })});
 await assert.rejects(store.dbCall('db.select',{table:'Projects'}),err=>{
   assert.equal(err.message,'SUPABASE_STORAGE_HTTP_401_INVALID_API_KEY');
   assert.ok(!err.message.includes(secret));
   return true;
 });
});
test('unrecognized error payload is not reflected into logs',async()=>{
 const store=createSupabaseDataAdapter({...options,fetchImpl:async()=>({
   ok:false,status:401,json:async()=>({code:'LEAK_ME',message:'sensitive'})
 })});
 await assert.rejects(store.dbCall('db.select',{table:'Projects'}),/SUPABASE_STORAGE_HTTP_401_UNCLASSIFIED/);
});
test('malformed error response fails closed without leaking payload',async()=>{
 const store=createSupabaseDataAdapter({...options,fetchImpl:async()=>({
   ok:false,status:403,json:async()=>{throw Error('SECRET_PAYLOAD')}
 })});
 await assert.rejects(store.dbCall('db.select',{table:'Projects'}),err=>err.message==='SUPABASE_STORAGE_HTTP_403_UNCLASSIFIED');
});
