'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const admin=fs.readFileSync('public/super-admin.html','utf8');
const home=fs.readFileSync('public/home.js','utf8');
const accounts=fs.readFileSync('public/admin-accounts.html','utf8');
const server=fs.readFileSync('server.js','utf8');

test('admin preload starts only after verified session event and role check',()=>{
 assert.match(home,/await fetch\('\/api\/auth\/me'/);
 assert.match(home,/if\(!r\.ok\|\|!data\.authenticated\)/);
 assert.match(home,/dispatchEvent\(new CustomEvent\('ikey:session-verified'/);
 assert.match(admin,/if\(event\.detail\?\.role==='super_admin'\)loadDevices\(\)/);
 assert.match(admin,/if\(event\.detail\?\.role==='super_admin'\)load\(\)/);
});
test('account preloading deduplicates pending requests and permits retry after failure',()=>{
 assert.match(admin,/if\(loadingPromise\)return loadingPromise/);
 assert.match(admin,/if\(loaded&&!force\)return/);
 assert.match(admin,/accounts=data\.accounts;limited=!!data\.limited;loaded=true/);
 assert.match(admin,/finally\{loadingPromise=null\}/);
});
test('full account-management entry remains intact',()=>{
 assert.match(admin,/href="\/admin-accounts\.html"/);
 assert.match(accounts,/adminAccountSetStatus/);
 assert.match(accounts,/adminAccountRevokeSessions/);
 assert.match(accounts,/adminAccountResetPassword/);
});
test('backend enforces super admin on account directory',()=>{
 assert.match(server,/app\.get\('\/api\/admin\/accounts',requireProjectUser/);
 assert.match(server,/if\(req\.projectUser\.global_role!=='super_admin'\)return res\.status\(403\)/);
});
test('unimplemented admin cards remain disabled',()=>{
 for(const label of ['資料管理','系統狀態','操作紀錄','系統設定']){
  const i=admin.indexOf(label);assert.ok(i>0,label);
  assert.match(admin.slice(i-100,i),/disabled/);
 }
});
