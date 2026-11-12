'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../public/projects.js'),'utf8');
const ownerProject={project_id:'11111111-1111-4111-8111-111111111111',project_name:'Private project',created_at:'2026-11-01',updated_at:'2026-11-01',status:'active'};
function harness(authenticated){
 const elements=new Map(),requests=[];
 function node(id){if(!elements.has(id))elements.set(id,{id,value:'',hidden:false,textContent:'',children:[],style:{},classList:{toggle(){},add(){},remove(){}},setAttribute(){},addEventListener(){},append(...v){this.children.push(...v);},replaceChildren(){this.children=[];},querySelector(){return {value:'all'};},querySelectorAll(){return []},parentElement:{querySelectorAll(){return []},append(){}}});return elements.get(id);}
 const document={getElementById:node,querySelector(){return null},createElement(){return node('generated-'+elements.size)},head:{append(){}}};
 const sessionStorage={getItem(){return JSON.stringify([ownerProject]);},removeItem(){}};
 const location={assign(){},replace(){},href:''};
 let resolveAuth;const auth=new Promise(resolve=>{resolveAuth=resolve;});
 const fetch=async(url)=>{requests.push(url);if(url==='/api/auth/me')return auth;return {ok:true,json:async()=>({success:true,projects:[]})};};
 const context={document,window:{iKeyProjectCache:{read(){return [ownerProject]},write(){},clear(){}}},sessionStorage,location,fetch,URLSearchParams,encodeURIComponent};
 vm.runInNewContext(source,context,{timeout:1000});
 return {node,requests,resolveAuth,authenticated};
}
test('cached project names are not rendered before authentication',async()=>{
 const h=harness(true);
 assert.equal(h.node('projects-results').children.some(n=>n.textContent==='Private project'),false);
 assert.equal(h.node('projects-count').textContent,'(載入中…)');
 h.resolveAuth({ok:true,json:async()=>({authenticated:true})});
 await new Promise(resolve=>setImmediate(resolve));
 assert.ok(h.requests.includes('/api/projects'));
});
test('unauthenticated session cannot reveal stale project cache',async()=>{
 const h=harness(false);
 h.resolveAuth({ok:true,json:async()=>({authenticated:false})});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(h.requests.includes('/api/projects'),false);
 assert.equal(h.node('projects-count').textContent,'(載入中…)');
});

test('authenticated account does not display prior account cached projects',async()=>{
 const h=harness(true);
 h.resolveAuth({ok:true,json:async()=>({authenticated:true})});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(h.node('projects-count').textContent,'(0)');
 assert.equal(h.node('projects-results').children.some(n=>n.textContent==='Private project'),false);
});
test('project list does not use browser cache as source of truth',()=>{
 assert.equal(source.includes('iKeyProjectCache?.read()'),false);
 assert.equal(source.includes('iKeyProjectCache?.write(projects)'),false);
});
