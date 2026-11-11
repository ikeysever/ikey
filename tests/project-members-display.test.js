'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const script=fs.readFileSync(path.join(__dirname,'../public/project-members.js'),'utf8');
const projectId='11111111-1111-4111-8111-111111111111';
const ownerId='22222222-2222-4222-8222-222222222222';
const adminId='33333333-3333-4333-8333-333333333333';
function element(){
 return {textContent:'',children:[],replaceChildren(){this.children=[];},append(...children){this.children.push(...children);},addEventListener(name,fn){this[name]=fn;}};
}
function harness(payload){
 const pane=element(),status=element(),list=element(),button=element();
 const nodes={'pc-member-status':status,'pc-member-list':list};
 const listeners={};
 const document={
  querySelector(selector){return selector==='[data-pc-pane="members"]'?pane:selector==='[data-pc-open="members"]'?button:null;},
  getElementById(id){return nodes[id];},
  addEventListener(name,fn){listeners[name]=fn;},
  createElement(){return element();}
 };
 const fetch=async()=>({ok:true,json:async()=>payload});
 vm.runInNewContext(script,{document,fetch,URLSearchParams,location:{search:'?id='+projectId},encodeURIComponent},{timeout:1000});
 listeners['ikey:project-loaded']({detail:{project:{project_id:projectId}}});
 return {button,status,list};
}
test('renders authorized non-owner members instead of filtering them out',async()=>{
 const h=harness({success:true,membership_inventory_complete:true,members:[
  {role:'owner',source:'project_creator',user_id:ownerId},
  {role:'admin',source:'invitation',user_id:adminId}
 ]});
 await h.button.click();
 assert.equal(h.list.children.length,2);
 assert.match(h.list.children[1].children[0].textContent,/管理員/);
 assert.match(h.status.textContent,/2 位/);
});
test('incomplete inventory remains explicitly labeled, invalid entries ignored',async()=>{
 const h=harness({success:true,membership_inventory_complete:false,members:[
  {role:'member',user_id:adminId},{role:'admin',user_id:'not-a-uuid'}
 ]});
 await h.button.click();
 assert.equal(h.list.children.length,1);
 assert.match(h.status.textContent,/尚未確認完整名冊/);
});
