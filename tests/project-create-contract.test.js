'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {unsupportedProjectCreateFields,PROJECT_CREATE_FIELDS}=require('../lib/project-create-contract');
test('exact current persistence contract accepts only verified fields',()=>{
 const payload={project_name:'實驗室',description:'測試',authorization_method:'application',scheduled_authorization:false,notification_theme:'midnight',notification_sound_pack:'pulse',notification_volume:50};
 assert.deepEqual(unsupportedProjectCreateFields(payload),[]);
 assert.deepEqual(Object.keys(payload).sort(),[...PROJECT_CREATE_FIELDS].sort());
});
test('unknown and unpersisted feature modules are rejected',()=>{
 assert.deepEqual(unsupportedProjectCreateFields({project_name:'x',feature_modules:['reservations'],project_features:['devices']}),['feature_modules','project_features']);
});
test('invalid payload shape is rejected',()=>{
 for(const value of [null,[],3,'text',undefined])assert.equal(unsupportedProjectCreateFields(value),null);
});
test('API refuses unsupported fields before any project insert',()=>{
 const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
 const route=server.slice(server.indexOf("app.post('/api/projects'"),server.indexOf("// Unlock readiness"));
 assert.ok(route.includes("unsupportedProjectCreateFields(req.body)"));
 assert.ok(route.includes("code:'UNSUPPORTED_PROJECT_FIELDS'"));
 assert.ok(route.indexOf("if(unsupported.length)")<route.indexOf("db.insert"));
});
