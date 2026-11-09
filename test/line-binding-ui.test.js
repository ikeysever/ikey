'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function ui(responses){
 const timers=new Map(),events={},listeners={};let sequence=0;const elements=new Map();
 const el=id=>{if(!elements.has(id))elements.set(id,{textContent:'',value:'',hidden:false,disabled:false,addEventListener:(name,fn)=>{listeners[id+':'+name]=fn;},focus(){},querySelector(){return el('submit');}});return elements.get(id);};
 const doc={hidden:false,getElementById:el,addEventListener:(name,fn)=>{events[name]=fn;}};
 const context=vm.createContext({document:doc,window:{addEventListener:(name,fn)=>{events[name]=fn;}},Date,Math,String,Error,JSON,AbortSignal,setTimeout:fn=>{const id=++sequence;timers.set(id,fn);return id;},setInterval:fn=>{const id=++sequence;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),clearInterval:id=>timers.delete(id),fetch:async()=>({ok:true,status:200,json:async()=>responses.shift()})});
 vm.runInContext(fs.readFileSync('public/account-line.js','utf8'),context);
 return {el,timers,events,doc,listeners,flush:()=>new Promise(r=>setImmediate(r))};
}
const status=(extra={})=>({binding_status:'unbound',challenge_status:'pending',csrf_token:'token',expires_at:new Date(Date.now()+300000).toISOString(),server_time:new Date().toISOString(),...extra});
test('polling stops after binding, visibility hide, page exit and logout',async()=>{
 for(const end of ['bound','hidden','pagehide','logout']){
  const u=ui([status(),status({binding_status:'bound'})]);await u.flush();assert.equal(u.timers.size,2);
  if(end==='bound')await u.listeners['line-refresh-button:click']();
  if(end==='hidden'){u.doc.hidden=true;u.events.visibilitychange();}
  if(end==='pagehide')u.events.pagehide();
  if(end==='logout')u.listeners['logout:click']();
  assert.equal(u.timers.size,0);
 }
});
test('unknown result blocks mutations and cannot show confirmed success',async()=>{
 const u=ui([status({binding_status:'bound',challenge_status:'unknown'})]);await u.flush();assert.equal(u.timers.size,0);assert.equal(u.el('line-bind-button').disabled,true);assert.equal(u.el('line-unbind-button').disabled,true);assert.match(u.el('line-binding-message').textContent,/核對/);
});
test('expired status stops polling and clears code',async()=>{const u=ui([status({challenge_status:'expired'})]);await u.flush();assert.equal(u.timers.size,0);assert.equal(u.el('line-code').textContent,'');});
