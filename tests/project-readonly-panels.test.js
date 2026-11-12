'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../public/project-readonly-panels.js'),'utf8');
function node(tag='div'){
 return {tag,textContent:'',children:[],attrs:{},append(...xs){this.children.push(...xs);},setAttribute(k,v){this.attrs[k]=v;},remove(){this.removed=true;},querySelector(){return null;}};
}
test('verified project event renders only read-only details with textContent',()=>{
 const panes=Object.fromEntries(['basic','auth','notify','advanced'].map(n=>[n,node()]));
 const listeners={};
 const document={
  addEventListener(name,fn){listeners[name]=fn;},
  querySelector(selector){return panes[selector.match(/data-pc-pane="([^"]+)"/)?.[1]]||null;},
  createElement:node
 };
 vm.runInNewContext(source,{document},{timeout:1000});
 const project={project_id:'11111111-1111-4111-8111-111111111111',project_name:'<img src=x onerror=alert(1)>',description:'Demo',status:'active',authorization_method:'application',scheduled_authorization:false,notification_theme:'midnight',notification_sound_pack:'pulse',notification_volume:50};
 listeners['ikey:project-loaded']({detail:{project}});
 assert.equal(panes.basic.children.length,1);
 const list=panes.basic.children[0].children[1];
 assert.equal(list.children[1].textContent,project.project_name);
 assert.equal(list.children[5].textContent,'啟用中');
 assert.equal(panes.auth.children[0].children[1].children[3].textContent,'未啟用');
 assert.equal(panes.advanced.children.length,1);
 assert.equal(panes.notify.children[0].children[1].children[1].textContent,'午夜科技');
 assert.equal(panes.notify.children[0].children[1].children[5].textContent,'50%');
});
test('unverified event does not populate project panels',()=>{
 const panes=Object.fromEntries(['basic','auth','notify','advanced'].map(n=>[n,node()]));
 const listeners={};
 const document={addEventListener(n,fn){listeners[n]=fn;},querySelector(s){return panes[s.match(/data-pc-pane="([^"]+)"/)?.[1]]||null;},createElement:node};
 vm.runInNewContext(source,{document},{timeout:1000});
 listeners['ikey:project-loaded']({detail:{project:{project_id:null}}});
 assert.equal(panes.basic.children.length,0);
});
