'use strict';
class CentralCache {
  constructor({sync,intervalMs=10000,now=()=>Date.now(),logger=()=>{}}={}){
    if(typeof sync!=='function')throw new TypeError('sync adapter required');
    if(!Number.isSafeInteger(intervalMs)||intervalMs<1000)throw new RangeError('invalid interval');
    Object.assign(this,{sync,intervalMs,now,logger,records:new Map(),cursor:null,state:'BOOTSTRAPPING',lastSuccessAt:null,lastErrorAt:null,lastErrorCode:null,generation:0,running:false,timer:null,stopped:false});
  }
  status(){return Object.freeze({state:this.state,generation:this.generation,lastSuccessAt:this.lastSuccessAt,lastErrorAt:this.lastErrorAt,lastErrorCode:this.lastErrorCode,recordCount:this.records.size,stale:this.state!=='HEALTHY'});}
  read(key){const item=this.records.get(key);return item?{value:structuredClone(item.value),version:item.version,stale:this.state!=='HEALTHY',lastSuccessAt:this.lastSuccessAt}:null;}
  async tick(){
    if(this.running||this.stopped)return false;
    this.running=true;this.state=this.state==='DEGRADED_READONLY'?'RECOVERING':this.state==='BOOTSTRAPPING'?'BOOTSTRAPPING':'SYNCING';
    try{
      const result=await this.sync({cursor:this.cursor,snapshot:new Map(this.records)});
      if(!result||!Array.isArray(result.changes)||result.verified!==true||!Object.prototype.hasOwnProperty.call(result,'cursor'))throw Object.assign(Error('unverified'),{code:'SYNC_UNVERIFIED'});
      const next=new Map(this.records);
      for(const c of result.changes){
        if(!c||typeof c.key!=='string'||!c.key||!Number.isSafeInteger(c.version)||c.version<0||typeof c.deleted!=='boolean')throw Object.assign(Error('invalid change'),{code:'INVALID_CHANGE'});
        const old=next.get(c.key);
        if(old&&c.version<old.version)throw Object.assign(Error('version regression'),{code:'VERSION_REGRESSION'});
        if(c.deleted)next.delete(c.key);
        else {if(!Object.prototype.hasOwnProperty.call(c,'value'))throw Object.assign(Error('missing value'),{code:'INVALID_CHANGE'});next.set(c.key,{value:structuredClone(c.value),version:c.version});}
      }
      this.records=next;this.cursor=result.cursor;this.generation++;this.lastSuccessAt=new Date(this.now()).toISOString();this.lastErrorCode=null;this.state='HEALTHY';return true;
    }catch(error){this.lastErrorAt=new Date(this.now()).toISOString();this.lastErrorCode=typeof error?.code==='string'?error.code:'SYNC_FAILED';this.state='DEGRADED_READONLY';this.logger({event:'cache_sync_failed',code:this.lastErrorCode});return false;}
    finally{this.running=false;}
  }
  start(){if(this.timer||this.stopped)return;const loop=async()=>{await this.tick();if(!this.stopped)this.timer=setTimeout(loop,this.intervalMs);};void loop();}
  stop(){this.stopped=true;if(this.timer)clearTimeout(this.timer);this.timer=null;}
}
module.exports={CentralCache};
