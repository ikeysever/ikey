'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {unsupportedProjectCreateFields,PROJECT_CREATE_FIELDS,validateFeatureModules,FEATURE_MODULE_IDS}=require('../lib/project-create-contract');
test('exact current persistence contract accepts only verified fields',()=>{
 const payload={project_name:'實驗室',description:'測試',authorization_method:'application',scheduled_authorization:false,notification_theme:'midnight',notification_sound_pack:'pulse',notification_volume:50,feature_modules:['reservations']};
 assert.deepEqual(unsupportedProjectCreateFields(payload),[]);
 assert.deepEqual(Object.keys(payload).sort(),[...PROJECT_CREATE_FIELDS].sort());
});
test('unknown fields are rejected and supported feature modules are validated',()=>{
 assert.deepEqual(unsupportedProjectCreateFields({project_name:'x',feature_modules:['reservations'],project_features:['devices']}),['project_features']);
});
test('feature modules enforce allowlist, uniqueness and array type',()=>{
 assert.equal(validateFeatureModules(['reservations','key_return']),true);
 assert.equal(validateFeatureModules(['reservations','reservations']),false);
 assert.equal(validateFeatureModules(['unknown']),false);
 assert.equal(validateFeatureModules('reservations'),false);
 assert.equal(validateFeatureModules([...FEATURE_MODULE_IDS,'unknown']),false);
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

test('feature selections require verified GAS schema before database insert',()=>{
 const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
 const route=server.slice(server.indexOf("app.post('/api/projects'"),server.indexOf("// Unlock readiness"));
 assert.ok(route.includes("db.schema"));
 assert.ok(route.includes("FEATURE_MODULE_STORAGE_NOT_READY"));
 assert.ok(route.includes("feature_modules:JSON.stringify(featureModules)"));
 assert.ok(route.indexOf("db.schema")<route.indexOf("db.insert"));
});
