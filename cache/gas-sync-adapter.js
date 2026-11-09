'use strict';
// Proposed staging GAS protocol; NOT supported by deployed db.select.
const fail=code=>Object.assign(new Error(code),{code});
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const token=v=>typeof v==='string'&&v.length>0&&v.length<=512;
function createGasSyncAdapter({request,namespace='announcements',pageSize=100,maxPages=1000}={}){
 if(typeof request!=='function')throw new TypeError('request required');
 if(!/^[a-z][a-z0-9_-]*$/.test(namespace))throw new TypeError('namespace invalid');
 if(!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>100)throw new RangeError('pageSize invalid');
 if(!Number.isSafeInteger(maxPages)||maxPages<1||maxPages>10000)throw new RangeError('maxPages invalid');
 async function collect({action,cursor=null,signal}){
  const all=[],seenTokens=new Set();let pageToken=null,revision=null,nextCursor=null;
  for(let i=0;i<maxPages;i++){
   const r=await request({action,namespace,cursor,pageToken,revision,limit:pageSize,signal});
   if(!obj(r)||r.complete!==true||!Array.isArray(r.rows)||r.rows.length>pageSize||!token(r.revision))throw fail('SYNC_PAGE_UNVERIFIED');
   if(revision===null)revision=r.revision;
   if(revision!==r.revision)throw fail('SYNC_REVISION_CHANGED');
   if(action==='changes.page'){
    if(!token(r.nextCursor))throw fail('SYNC_CURSOR_INVALID');
    if(nextCursor!==null&&nextCursor!==r.nextCursor)throw fail('SYNC_CURSOR_CHANGED');
    nextCursor=r.nextCursor;
   }
   all.push(...r.rows);
   const next=r.nextPageToken;
   if(next===null)return {rows:all,revision,nextCursor};
   if(!token(next)||seenTokens.has(next)||next===pageToken)throw fail('SYNC_PAGE_TOKEN_INVALID');
   seenTokens.add(next);pageToken=next;
  }
  throw fail('SYNC_PAGE_LIMIT');
 }
 return async function sync({cursor=null,snapshot=new Map(),signal}={}){
  if(!(snapshot instanceof Map))throw new TypeError('snapshot required');
  const initial=cursor===null;
  if(!initial&&!token(cursor))throw fail('SYNC_CURSOR_INVALID');
  const result=await collect({action:initial?'snapshot.page':'changes.page',cursor,signal});
  const changes=[],seen=new Map(),version=Date.now();
  for(const row of result.rows){
   if(!obj(row)||!token(row.id)||(initial&&seen.has(row.id))||!Number.isSafeInteger(row.version)||row.version<0||typeof row.deleted!=='boolean')throw fail('SYNC_ROW_INVALID');
   
   if(!row.deleted&&!obj(row.value))throw fail('SYNC_ROW_INVALID');
   if(!initial&&seen.has(row.id)&&seen.get(row.id)>=row.version)throw fail('SYNC_ROW_ORDER_INVALID');
   seen.set(row.id,row.version);
   const next={key:`${namespace}:${row.id}`,version:row.version,deleted:row.deleted,...(row.deleted?{}:{value:structuredClone(row.value)})};
   if(initial)changes.push(next);else {const index=changes.findIndex(x=>x.key===next.key);if(index<0)changes.push(next);else changes[index]=next;}
  }
  if(initial)for(const key of snapshot.keys())if(key.startsWith(`${namespace}:`)&&!seen.has(key.slice(namespace.length+1))){
   const previous=snapshot.get(key);
   changes.push({key,version:Math.max(version,previous?.version||0),deleted:true});
  }
  const nextCursor=initial?result.revision:result.nextCursor;
  if(!token(nextCursor)||(!initial&&nextCursor===cursor&&changes.length>0))throw fail('SYNC_CURSOR_INVALID');
  return {changes,cursor:nextCursor,verified:true};
 };
}
module.exports={createGasSyncAdapter};
