'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createGasSyncAdapter}=require('./gas-sync-adapter');
const {CentralCache}=require('./central-cache');
const row=(id,version,deleted=false)=>({id,version,deleted,...(deleted?{}:{value:{title:id}})});
const page=(rows,revision,nextPageToken=null,nextCursor='c2')=>({rows,revision,complete:true,nextPageToken,nextCursor});
function pages(...responses){let i=0;return async()=>responses[i++];}
test('complete multi-page snapshot',async()=>{
 const cache=new CentralCache({sync:createGasSyncAdapter({request:pages(page([row('a',1)],'c1','p2'),page([row('b',2)],'c1'))})});
 assert.equal(await cache.tick(),true);assert.equal(cache.read('announcements:a').value.title,'a');assert.equal(cache.read('announcements:b').version,2);assert.equal(cache.cursor,'c1');
});
test('incremental tombstone',async()=>{
 const calls=[];const sync=createGasSyncAdapter({request:async req=>{calls.push(req);return req.action==='snapshot.page'?page([row('a',1)],'c1'):page([row('a',2,true)],'r2',null,'c2')}});
 const cache=new CentralCache({sync});await cache.tick();await cache.tick();assert.equal(cache.read('announcements:a'),null);assert.equal(cache.cursor,'c2');assert.equal(calls[1].cursor,'c1');
});
test('revision change rejects atomic batch',async()=>{
 const cache=new CentralCache({sync:createGasSyncAdapter({request:pages(page([row('a',1)],'c1','p2'),page([row('b',2)],'c2'))})});
 assert.equal(await cache.tick(),false);assert.equal(cache.status().recordCount,0);
});
test('incomplete page fails closed',async()=>{
 const cache=new CentralCache({sync:createGasSyncAdapter({request:async()=>({...page([row('a',1)],'c1'),complete:false})})});
 assert.equal(await cache.tick(),false);assert.equal(cache.status().recordCount,0);
});
test('repeated page token fails closed',async()=>{
 const cache=new CentralCache({sync:createGasSyncAdapter({request:pages(page([row('a',1)],'c1','p2'),page([row('b',2)],'c1','p2'))})});
 assert.equal(await cache.tick(),false);
});
test('duplicate row across pages fails closed',async()=>{
 const cache=new CentralCache({sync:createGasSyncAdapter({request:pages(page([row('a',1)],'c1','p2'),page([row('a',2)],'c1'))})});
 assert.equal(await cache.tick(),false);
});
test('page overflow fails closed',async()=>{
 const cache=new CentralCache({sync:createGasSyncAdapter({pageSize:1,request:async()=>page([row('a',1),row('b',1)],'c1')})});
 assert.equal(await cache.tick(),false);
});
test('page limit fails closed',async()=>{
 const cache=new CentralCache({sync:createGasSyncAdapter({maxPages:1,request:async()=>page([row('a',1)],'c1','p2')})});
 assert.equal(await cache.tick(),false);
});
test('invalid change cursor keeps stale cache',async()=>{
 const sync=createGasSyncAdapter({request:async req=>req.action==='snapshot.page'?page([row('a',1)],'c1'):page([row('b',2)],'r2',null,'')});
 const cache=new CentralCache({sync});await cache.tick();assert.equal(await cache.tick(),false);assert.equal(cache.read('announcements:a').stale,true);
});
test('invalid adapter config',()=>assert.throws(()=>createGasSyncAdapter({request:async()=>{},pageSize:101}),RangeError));
