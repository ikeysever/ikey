'use strict';
const {CentralCache}=require('./central-cache');
// Read-only public display records only. Not a GAS incremental change feed.
// Caller must prove completeness: never pass a db.select page with limit 100 as a full snapshot.
function createSnapshotAdapter({load,namespace='announcements',maxRecords=10000}={}){
  if(typeof load!=='function')throw new TypeError('load required');
  if(!/^[a-z][a-z0-9_-]*$/.test(namespace))throw new TypeError('invalid namespace');
  let sequence=0;
  return async function sync({snapshot,signal}={}){
    const batch=await load({signal});
    const rows=batch?.rows;
    if(batch?.complete!==true||!Array.isArray(rows)||rows.length>maxRecords)throw Object.assign(Error('snapshot unverified'),{code:'SNAPSHOT_UNVERIFIED'});
    const seen=new Set(),changes=[],generation=sequence+1;
    for(const row of rows){
      if(!row||typeof row.id!=='string'||!row.id||seen.has(row.id)||!row.value||typeof row.value!=='object'||Array.isArray(row.value))throw Object.assign(Error('invalid row'),{code:'SNAPSHOT_UNVERIFIED'});
      seen.add(row.id);changes.push({key:`${namespace}:${row.id}`,value:structuredClone(row.value),version:generation,deleted:false});
    }
    if(snapshot instanceof Map)for(const key of snapshot.keys())if(key.startsWith(`${namespace}:`)&&!seen.has(key.slice(namespace.length+1)))changes.push({key,version:generation,deleted:true});
    sequence=generation;return {changes,cursor:generation,verified:true};
  };
}
function singleFlight(load){
  if(typeof load!=='function')throw new TypeError('load required');
  let pending=null;
  return (...args)=>{
    if(pending)return pending;
    const request=Promise.resolve().then(()=>load(...args));pending=request;
    void request.finally(()=>{if(pending===request)pending=null;}).catch(()=>{});
    return request;
  };
}
function createAnnouncementCache({load,intervalMs=10000,logger}={}){
  const cache=new CentralCache({sync:createSnapshotAdapter({load:singleFlight(load)}),intervalMs,logger});
  return Object.freeze({cache,start:()=>cache.start(),stop:()=>cache.stop(),status:()=>cache.status(),read:id=>cache.read(`announcements:${id}`)});
}
module.exports={createSnapshotAdapter,singleFlight,createAnnouncementCache};
