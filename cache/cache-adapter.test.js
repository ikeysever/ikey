'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createSnapshotAdapter,singleFlight,createAnnouncementCache}=require('./cache-adapter');
const {CentralCache}=require('./central-cache');
test('snapshot reconciles deletion',async()=>{
 let rows=[{id:'a',value:{title:'A'}},{id:'b',value:{title:'B'}}];
 const cache=new CentralCache({sync:createSnapshotAdapter({load:async()=>({rows,complete:true})})});
 assert.equal(await cache.tick(),true);
 rows=[{id:'b',value:{title:'B2'}}];assert.equal(await cache.tick(),true);
 assert.equal(cache.read('announcements:a'),null);
 assert.equal(cache.read('announcements:b').value.title,'B2');
});
test('unverified or duplicate snapshot never publishes partial result',async()=>{
 let rows=[{id:'a',value:{title:'A'}}];
 const cache=new CentralCache({sync:createSnapshotAdapter({load:async()=>({rows,complete:true})})});
 await cache.tick();rows=[{id:'b',value:{}},{id:'b',value:{}}];
 assert.equal(await cache.tick(),false);assert.equal(cache.read('announcements:a').value.title,'A');
});
test('single-flight coalesces concurrent reads',async()=>{
 let count=0,release;const load=singleFlight(()=>{count++;return new Promise(r=>release=r)});
 const a=load(),b=load();await Promise.resolve();assert.equal(count,1);
 release('ok');assert.equal(await a,'ok');assert.equal(await b,'ok');
 const c=load();await Promise.resolve();release('again');await c;assert.equal(count,2);
});
test('opt-in cache does not contact upstream until started',()=>{
 let calls=0;const service=createAnnouncementCache({load:async()=>{calls++;return {rows:[],complete:true}}});
 assert.equal(service.status().state,'BOOTSTRAPPING');assert.equal(calls,0);service.stop();
});
test('failed upstream keeps previous snapshot and marks it stale',async()=>{
 let fail=false;
 const service=createAnnouncementCache({load:async()=>{if(fail)throw Error('offline');return {rows:[{id:'x',value:{title:'X'}}],complete:true}}});
 await service.cache.tick();fail=true;await service.cache.tick();
 assert.equal(service.status().state,'DEGRADED_READONLY');assert.equal(service.read('x').stale,true);
});
