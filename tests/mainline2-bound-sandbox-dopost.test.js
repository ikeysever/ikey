'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('staging/gas/ikey-bound-sandbox-dopost.candidate.gs','utf8');
function setup() {
 const calls=[];
 const ctx={
  ContentService:{
   MimeType:{JSON:'application/json'},
   createTextOutput(text){return {text,setMimeType(mime){this.mime=mime;return this}}}
  },
  ikeySandboxCommandHttpCandidate_(request){calls.push(request);return {ok:true,result:{status:'pending'}}}
 };
 vm.createContext(ctx);vm.runInContext(source,ctx);
 return {post:ctx.doPost,calls};
}
test('isolated Bound Sandbox doPost passes parsed request only to sandbox command adapter',()=>{
 const {post,calls}=setup();
 const request={api_key:'test',action:'deviceCommandGet',payload:{project_id:'test'}};
 const response=post({postData:{contents:JSON.stringify(request)}});
 assert.equal(response.mime,'application/json');
 assert.deepEqual(JSON.parse(response.text),{ok:true,result:{status:'pending'}});
 assert.deepEqual(JSON.parse(JSON.stringify(calls)),[request]);
});
test('malformed and missing request bodies fail closed without invoking sandbox adapter',()=>{
 const {post,calls}=setup();
 for(const event of [null,{}, {postData:{contents:'{'}}]){
  assert.deepEqual(JSON.parse(post(event).text),{ok:false,error:'INVALID_REQUEST'});
 }
 assert.deepEqual(calls,[]);
});
test('entrypoint has no legacy dispatch or production GAS route',()=>{
 assert.doesNotMatch(source,/legacyDispatch|GEN3_API_KEY|ikeyDbDispatch_/);
});
