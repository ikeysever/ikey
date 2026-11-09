'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('admin HTML is protected before static file serving',()=>{
 const server=read('server.js');
 const guard=server.indexOf('const protectedAdminPages = new Set(');
 const staticAt=server.indexOf("app.use(express.static(");
 assert.ok(guard>=0&&staticAt>guard);
 for(const route of ['/super-admin.html','/admin-accounts.html','/admin-accounts-preview.html'])
   assert.ok(server.includes("'"+route+"'"));
 assert.ok(server.includes("authStore.resolveSession(hashToken(raw))"));
 assert.ok(server.includes("resolved.user.global_role!=='super_admin'"));
 assert.ok(server.includes("res.status(403)"));
 assert.ok(server.includes("res.status(503)"));
});
test('all super-admin navigation entries are hidden before verification',()=>{
 for(const file of ['home.html','projects.html','account.html','device-settings.html','super-admin.html']){
   const html=read('public/'+file);
   assert.match(html,/admin-nav-guard\.js/);
   assert.match(html,/<a[^>]*hidden[^>]*href="\/super-admin\.html"/);
 }
 const guard=read('public/admin-nav-guard.js');
 assert.match(guard,/fetch\('\/api\/auth\/me'/);
 assert.match(guard,/session\.user\?\.global_role!=='super_admin'/);
 assert.match(guard,/link\.hidden=true/);
});
test('existing sensitive API role checks are preserved',()=>{
 const server=read('server.js');
 for(const route of ["/api/admin/accounts","/api/admin/accounts/action","/api/devices"])
   assert.ok(server.includes(route));
 assert.ok(server.includes("req.projectUser.global_role!=='super_admin'"));
 const announcements=read('gen3-auth/announcement-router.js');
 assert.ok(announcements.includes("global_role !== 'super_admin'"));
});
