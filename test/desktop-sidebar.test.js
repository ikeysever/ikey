'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'../public',name),'utf8');

test('desktop hamburger is visible and sidebar can collapse',()=>{
 const css=read('home.css');
 const desktop=css.slice(css.indexOf('/* Desktop sidebar stays visible'));
 assert.match(desktop,/\.menu-toggle\s*\{\s*display:flex!important/);
 assert.match(desktop,/body\.desktop-sidebar-collapsed \.app/);
 assert.match(desktop,/body\.desktop-sidebar-collapsed \.side/);
 assert.doesNotMatch(desktop,/\.menu-toggle, \.sidebar-backdrop \{ display:none!important/);
});
test('all three pages have working toggle and fresh assets',()=>{
 for(const file of ['home.html','projects.html','project.html']){
  const html=read(file);
  assert.match(html,/id="menu-toggle"/);
  assert.match(html,/id="sidebar"/);
  assert.match(html,/home\.css\?v=20261026-[a-z0-9-]+/);
 }
 for(const file of ['home.html','projects.html'])assert.match(read(file),/home\.js\?v=20261026-desktop-sidebar-hotfix/);
 assert.match(read('project.html'),/project-sidebar\.js\?v=20261026-desktop-sidebar-hotfix/);
});
test('both navigation controllers toggle desktop collapsed class',()=>{
 for(const file of ['home.js','project-sidebar.js']){
  const js=read(file);
  assert.match(js,/desktop-sidebar-collapsed/);
  assert.match(js,/aria-expanded/);
  new Function(js);
 }
});
