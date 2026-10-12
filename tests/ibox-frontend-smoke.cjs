"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "public/animation.js"), "utf8");

test("the product identity remains iKey", () => {
  assert.match(html, /<title>iKey\b/);
  assert.match(html, /id="loginForm"/);
  assert.match(html, /id="homePage"/);
});

test("retired welcome animation is not requested", () => {
  assert.doesNotMatch(html, /welcome\.js|animationRoot|assets\/welcome/);
  assert.doesNotMatch(app, /iKeyWelcome|playWelcomeAnimation|animationRoot/);
});

test("local script and stylesheet assets exist", () => {
  const refs = [...html.matchAll(/(?:src|href)="(\.\/[^"]+)"/g)].map(m => m[1]);
  for (const ref of refs) {
    const relative = ref.slice(2).split(/[?#]/)[0];
    assert.ok(fs.existsSync(path.join(root, "public", relative)), `missing asset: ${ref}`);
  }
});

test("project center is connected and clearly identified as preview", () => {
  const projectUi = fs.readFileSync(path.join(root, "public/project-center.js"), "utf8");
  assert.match(html, /data-page="projects"/);
  assert.match(html, /id="projectCenterPage"/);
  assert.match(html, /id="ikeyProjectCards"/);
  assert.match(html, /id="ikeyProjectDetail"/);
  assert.match(html, /project-center\.js/);
  assert.match(html, /尚未建立實際專案/);
  assert.match(app, /function showProjectCenter\(/);
  assert.match(app, /projectCenterPage\.hidden = true/);
  assert.match(projectUi, /工具櫃管理/);
  assert.match(projectUi, /化學實驗室/);
  assert.doesNotMatch(projectUi, /fetch\(|XMLHttpRequest|WebSocket/);
});

test("operations overview is read-only and wired to existing endpoints", () => {
  const overview = fs.readFileSync(path.join(root, "public/operations-overview.js"), "utf8");
  assert.match(html, /data-page="overview"/);
  assert.match(html, /id="ikeyOverviewPage"/);
  assert.match(html, /id="ikeyOverviewStats"/);
  assert.match(html, /operations-overview\.js/);
  assert.match(app, /function showOperationsOverview\(/);
  assert.match(overview, /Promise\.allSettled/);
  assert.match(overview, /\/api\/database\//);
  assert.doesNotMatch(overview, /method:\s*["'](?:POST|PUT|PATCH|DELETE)/);
  assert.doesNotMatch(overview, /\/api\/device\/heartbeat/);
});

test("admin console uses server-side authorization rather than client role", () => {
  const consoleScript = fs.readFileSync(path.join(root, "public/admin-console.js"), "utf8");
  const adminRoutes = fs.readFileSync(path.join(root, "lib/ibox/admin-auth-routes.js"), "utf8");
  assert.match(html, /id="ikeyAdminPage"/);
  assert.match(html, /data-page="admin"/);
  assert.match(html, /admin-console\.js/);
  assert.match(app, /function showAdminConsole\(/);
  assert.match(consoleScript, /\/api\/login\/admin\/summary/);
  assert.match(adminRoutes, /sessionFromRequest/);
  assert.match(adminRoutes, /status\(403\)/);
  assert.doesNotMatch(consoleScript, /localStorage|sessionStorage/);
});

test("narrow screens use an accessible collapsed sidebar drawer", () => {
  const css = fs.readFileSync(path.join(root, "public/style.css"), "utf8");
  const drawer = css.slice(css.lastIndexOf("/* Responsive sidebar drawer"));
  assert.match(html, /id="sidebarMenuButton"/);
  assert.match(html, /id="sidebarBackdrop"/);
  assert.match(html, /id="ikeySidebar"/);
  assert.match(drawer, /@media \(max-width: 700px\)/);
  assert.match(drawer, /translateX\(-105%\)/);
  assert.match(drawer, /\.sidebar\.is-open/);
  assert.match(app, /setSidebarOpen\(false\)/);
  assert.match(app, /event\.key === "Escape"/);
});

test("placeholder slot navigation removed and admin operations are guarded", () => {
  const operations = fs.readFileSync(path.join(root, "public/admin-operations.js"), "utf8");
  const auth = fs.readFileSync(path.join(root, "lib/ibox/admin-auth-routes.js"), "utf8");
  assert.doesNotMatch(html, /data-page="slot-status"/);
  assert.match(html, /id="ikeyTerminalNavGroup" hidden/);
  assert.match(html, /data-page="terminal"/);
  assert.doesNotMatch(html, /data-page="connections" hidden/);
  assert.match(html, /id="ikeySuperadminNavGroup" hidden/);
  assert.match(html, /data-page="project-apply"/);
  assert.match(html, /data-page="my-projects"/);
  assert.doesNotMatch(html, /id="scheduleToggle"/);
  assert.match(html, /id="ikeyAdminNavGroup" hidden/);
  assert.match(html, /id="ikeyTerminalMonitorTab"/);
  assert.match(html, /id="ikeyTerminalCommandTab"/);
  assert.match(html, /id="ikeyTerminalCommandInput"[^>]*disabled/);
  assert.match(html, /id="connectionMonitorPage"/);
  assert.match(operations, /\/api\/login\/admin\/summary/);
  assert.match(operations, /\/api\/login\/admin\/connections/);
  assert.match(auth, /router\.get\("\/admin\/connections", requireSuperadmin/);
});

test("chemical storage cabinet uses its own emerald theme and six status palettes exist", () => {
  const projects = fs.readFileSync(path.join(root, "public/project-center.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "public/project-center.css"), "utf8");
  assert.match(projects, /title: "化學實驗室儲存櫃"/);
  assert.match(projects, /theme: "laboratory"/);
  assert.match(projects, /detail\.dataset\.projectTheme/);
  assert.match(projects, /button\.dataset\.projectTheme/);
  for (const theme of ["midnight", "arctic", "laboratory", "copper", "violet", "graphite"]) {
    assert.ok(css.includes('[data-ikey-theme="' + theme + '"]'));
  }
  assert.match(css, /\.ikey-project-card\[data-project-theme="laboratory"\]/);
  assert.match(css, /\.ikey-project-detail\[data-project-theme="laboratory"\]/);
});

test("primary navigation groups are consistent accessible collapsible buttons", () => {
  const script = fs.readFileSync(path.join(root, "public/sidebar-pages.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "public/style.css"), "utf8");
  for (const id of ["project-center", "admin-console", "terminal", "superadmin"]) {
    assert.match(html, new RegExp('data-sidebar-toggle="' + id + '"'));
    assert.match(html, new RegExp('aria-controls="ikey-nav-' + id + '"'));
    assert.match(html, new RegExp('id="ikey-nav-' + id + '" inert'));
  }
  assert.match(script, /setAttribute\("aria-expanded", String\(open\)\)/);
  assert.match(script, /children\.inert = !open/);
  assert.match(css, /\.ikey-nav-children\[hidden\]/);
  assert.match(html, /id="ikeyAdminNavGroup" hidden/);
  assert.match(html, /id="ikeySuperadminNavGroup" hidden/);
});


test("approved multi-scene welcome links exact subtitles and validates homepage readiness", () => {
  const welcome = fs.readFileSync(path.join(root, "public/welcome-padlock.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "public/style.css"), "utf8");
  assert.match(html, /src="\.\/welcome-padlock\.js"/);
  assert.match(app, /iKeyPadlockWelcome\.create\(\(\) => fetchDeviceStatus\(true\)\)/);
  assert.match(welcome, /const copy=p\(time,7\.55,\.6\),sub=p\(time,8\.15,\.6\)/);
  assert.match(welcome, /自動多場景智慧鎖/);
  assert.doesNotMatch(welcome, /智慧鑰匙管理系統|智慧鑰匙倉儲管理系統/);
  assert.match(welcome, /!ready \|\| !finished/);
  assert.match(welcome, /重新載入/);
  assert.ok(fs.existsSync(path.join(root, "public/welcome-assets/welcome.wav")));
  assert.ok(fs.existsSync(path.join(root, "public/welcome-assets/project-title-subset.ttf")));
  assert.match(css, /\/welcome-assets\/project-title-subset\.ttf/);
});

test("collapsible sidebar uses filled right/down triangles before group titles", () => {
  const css = fs.readFileSync(path.join(root, "public/style.css"), "utf8");
  for (const label of ["專案中心", "管理員控制台", "系統終端機", "超級管理員控制台"]) {
    assert.match(html, new RegExp('ikey-nav-triangle" aria-hidden="true">▶</span><span>' + label));
  }
  assert.match(css, /content:"▼"/);
  assert.match(css, /aria-expanded="true"/);
});

test("sidebar accordion animates and desktop hamburger can collapse the whole sidebar", () => {
  const css = fs.readFileSync(path.join(root, "public/style.css"), "utf8");
  const script = fs.readFileSync(path.join(root, "public/sidebar-pages.js"), "utf8");
  assert.match(css, /max-height: 0/);
  assert.match(css, /max-height: 480px/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /sidebar-collapsed \.sidebar/);
  assert.match(css, /sidebar-collapsed \.main-area/);
  assert.match(css, /min-width: 701px/);
  assert.match(app, /classList\.toggle\("sidebar-collapsed", !shouldOpen\)/);
  assert.match(app, /setSidebarOpen\(!narrowSidebar\.matches\)/);
  assert.doesNotMatch(script, /menuButton\.click\(\)/);
  assert.match(html, /id="sidebarMenuButton"/);
});

test("next generation iKey branding uses the lock and key logo", () => {
  assert.match(html, /assets\/brand\/ikey-nextgen\.svg/);
  assert.match(html, /<link rel="icon" type="image\/svg\+xml"/);
  assert.match(html, /iKey 自動多場景智慧鎖/);
  assert.doesNotMatch(html, /智慧鑰匙管理系統|智慧校園管理系統/);
});

test("mobile sidebar closes on navigation; desktop keeps its previous state", () => {
  const navScript = fs.readFileSync(path.join(root, "public/sidebar-pages.js"), "utf8");
  assert.match(app, /if \(narrowSidebar\.matches\) setSidebarOpen\(false\)/);
  assert.doesNotMatch(app, /const page = item\.dataset\.page;\s*setSidebarOpen\(false\)/);
  assert.doesNotMatch(navScript, /menuButton\.click\(\)/);
});

test("refresh restores only server-verified login session and does not save passwords", () => {
  assert.match(app, /fetch\("\/api\/login\/session"/);
  assert.match(app, /credentials:\s*"same-origin"/);
  assert.match(app, /cache:\s*"no-store"/);
  assert.match(app, /if\(!authenticated\|\|loginAttempted\)continue/);
  assert.match(app, /fetch\("\/api\/auth\/me"/);
  assert.match(app, /restoreLoginSession\(\)/);
  assert.doesNotMatch(app, /localStorage\.setItem\([^\n]*password/);
});
test("logo reference contains horizontal key, padlock and circular technology ring", () => {
  const svg = fs.readFileSync(path.join(root, "public/assets/brand/ikey-nextgen.svg"), "utf8");
  assert.match(svg, /viewBox="0 0 400 400"/);
  assert.match(svg, /<circle cx="200" cy="199" r="157"/);
  assert.match(svg, /<rect x="196" y="145"/);
  assert.match(svg, /<circle cx="120" cy="279"/);
});

test("main login provides Gen3 account entrypoints without exposing backend sources",()=>{
  const server=fs.readFileSync(path.join(root,"server.js"),"utf8");
  const css=fs.readFileSync(path.join(root,"public/style.css"),"utf8");
  const statusScript=fs.readFileSync(path.join(root,"public/gen3-entry.js"),"utf8");
  assert.match(html, /href="\/gen3\/forgot-password\.html"/);
  assert.match(html, /href="\/gen3\/register\.html"/);
  assert.match(html, /id="gen3LoginForm"/);
  assert.match(html, /href="\/\?legacy=1"/);
  assert.match(server, /gen3Store\.health\(\)/);
  assert.match(html, /gen3-entry\.js/);
  assert.doesNotMatch(html, /忘記密碼？（準備中）|建立帳號（準備中）/);
  assert.match(css, /\.login-help a/);
  assert.match(statusScript, /\/api\/auth\/status/);
  assert.doesNotMatch(statusScript, /googleLoginLink|googleReady/);
  assert.match(server, /gen3Pages=new Set/);
  assert.match(server, /app\.get\("\/api\/auth\/status"/);
  assert.doesNotMatch(server, /express\.static\(path\.join\(__dirname,"gen3-auth"/);
  for(const page of ["login.html","register.html","forgot-password.html","verify-email.html","reset-password.html","account.html"]){
    assert.ok(fs.existsSync(path.join(root,"gen3-auth",page)),page);
  }
});

test("Gen3 primary login uses server verified sessions, existing welcome, and main homepage",()=>{
  const entry=fs.readFileSync(path.join(root,"public/gen3-entry.js"),"utf8");
  const gen3Login=fs.readFileSync(path.join(root,"gen3-auth/login.html"),"utf8");
  assert.match(html,/id="gen3LoginPanel"/);
  assert.match(html,/id="legacyLoginPanel"[^>]*hidden/);
  assert.match(html,/id="loginForm"/);
  assert.match(entry,/fetch\("\/api\/auth\/login"/);
  assert.match(entry,/window\.iKeyGen3Enter\(\)/);
  assert.match(app,/window\.iKeyGen3Enter=async/);
  assert.match(app,/verifiedGen3\(\)/);
  assert.match(app,/showAuthenticatedHome\("gen3",true\)/);
  assert.match(app,/showDashboard\(\)/);
  assert.match(app,/iKeyPadlockWelcome\.create/);
  assert.match(app,/activeLoginKind==="gen3"\?"\/api\/auth\/logout":"\/api\/login\/logout"/);
  assert.match(gen3Login,/location\.assign\("\/\?welcome=1"\)/);
  assert.doesNotMatch(entry,/fetch\("\/api\/login"/);
});

test("primary login matches the approved standalone design and recovery returns home",()=>{
  const css=fs.readFileSync(path.join(root,"public/style.css"),"utf8");
  const status=fs.readFileSync(path.join(root,"public/gen3-entry.js"),"utf8");
  const pages=["login.html","forgot-password.html","register.html","account.html","verify-email.html","reset-password.html"];
  assert.match(html,/id="gen3LoginPanel"/);
  assert.match(html,/class="ikey-login-subtitle">自動多場景智慧鎖<\/p>/);
  assert.match(html,/class="ikey-login-links"/);
  assert.match(html,/class="ikey-admin-entry" href="\/\?legacy=1"/);
  assert.match(html,/id="legacyLoginPanel"[^>]*hidden/);
  assert.match(css,/#loginPage #gen3LoginPanel \.form-group input/);
  assert.match(css,/background: #68a9ff/);
  assert.match(css,/background: #0b1220/);
  assert.match(status,/fetch\("\/api\/auth\/status"/);
  assert.doesNotMatch(html,/第三代/);
  assert.doesNotMatch(status,/第三代/);
  for(const page of pages){
    const content=fs.readFileSync(path.join(root,"gen3-auth",page),"utf8");
    assert.doesNotMatch(content,/第三代/,page);
    if(page!=="login.html")assert.match(content,/href="\/"/,page);
  }
  const recovery=fs.readFileSync(path.join(root,"gen3-auth/forgot-password.html"),"utf8");
  assert.match(recovery,/href="\/">← 返回登入頁/);
  assert.match(recovery,/ikeydaangaogong@gmail\.com/);
  assert.match(recovery,/href="mailto:ikeydaangaogong@gmail\.com\?subject=/);
  assert.match(recovery,/如需重設密碼，請聯繫 iKey 管理團隊/);
  assert.doesNotMatch(recovery,/<form|寄送重設連結|\/api\/auth\/forgot-password/);
});

test("Gen3 readiness reports safe diagnostic categories without leaking credentials",()=>{
 const server=fs.readFileSync(path.join(root,"server.js"),"utf8");
 const register=fs.readFileSync(path.join(root,"gen3-auth/register.html"),"utf8");
 assert.match(server,/appsScriptUrlConfigured:gen3UrlValid/);
 assert.match(server,/appsScriptKeyConfigured:gen3KeyValid/);
 assert.match(server,/reason:r.reason/);
 assert.match(server,/APPS_SCRIPT_VERSION_MISMATCH/);
 assert.match(server,/APPS_SCRIPT_AUTH_FAILED/);
 assert.match(server,/APPS_SCRIPT_SCHEMA_MISMATCH/);
 assert.match(server,/MAILAPP_NOT_READY/);
 assert.match(register,/診斷：/);
 assert.match(register,/APPS_SCRIPT_NON_JSON_RESPONSE/);
 assert.doesNotMatch(server,/console\.log\(process\.env\)/);
});

test("Gen3 error categorization distinguishes stale Apps Script deployment and network failures",()=>{
 const server=fs.readFileSync(path.join(root,"server.js"),"utf8");
 assert.match(server,/GEN3_STORAGE_UNKNOWN_ACTION/);
 assert.match(server,/APPS_SCRIPT_OUTDATED_ACTION/);
 assert.match(server,/APPS_SCRIPT_FETCH_FAILED/);
 assert.match(server,/APPS_SCRIPT_DNS_FAILURE/);
 assert.match(server,/GEN3_STORAGE_\[A-Z0-9_\]/);
});

test("Gen3 health errors safely distinguish permission, spreadsheet and MailApp failures",()=>{
 const vm=require("node:vm");
 const server=fs.readFileSync(path.join(root,"server.js"),"utf8");
 const from=server.indexOf("function gen3FailureCategory(err){");
 const to=server.indexOf("async function checkGen3()",from);
 assert.ok(from>=0&&to>from);
 const categorize=vm.runInNewContext("("+server.slice(from,to).trim()+")");
 assert.equal(categorize(new Error("GEN3_STORAGE_Exception: You do not have permission to call SpreadsheetApp.openById on private-id")),"APPS_SCRIPT_PERMISSION_DENIED");
 assert.equal(categorize(new Error("GEN3_STORAGE_Exception: Service Spreadsheets failed while accessing document with id private-id")),"APPS_SCRIPT_SPREADSHEET_ACCESS_FAILED");
 assert.equal(categorize(new Error("GEN3_STORAGE_Exception: MailApp.getRemainingDailyQuota is not authorized")),"APPS_SCRIPT_MAILAPP_ACCESS_FAILED");
 assert.equal(categorize(new Error("GEN3_STORAGE_Exception: Unexpected internal error")),"APPS_SCRIPT_EXECUTION_ERROR");
 assert.equal(categorize(new Error("GEN3_STORAGE_UNKNOWN_ACTION")),"APPS_SCRIPT_OUTDATED_ACTION");
 assert.equal(categorize(new Error("GEN3_STORAGE_UNAUTHORIZED")),"APPS_SCRIPT_AUTH_FAILED");
});

test("Google OAuth code, routes, UI and public status are absent",()=>{
 const files=["server.js","gen3-auth/routes.js","gen3-auth/sheets-store.js","gen3-auth/core.js",
  "gen3-auth/apps-script/Code.gs","gen3-auth/login.html","gen3-auth/register.html",
  "gen3-auth/account.html","public/index.html","public/gen3-entry.js"];
 assert.equal(fs.existsSync(path.join(root,"gen3-auth/google.js")),false);
 for(const name of files){
  const content=fs.readFileSync(path.join(root,name),"utf8");
  assert.doesNotMatch(content,/GOOGLE_OAUTH_CLIENT_|\/api\/auth\/google|\/google\/(?:start|link|callback)|registerGoogleAtomic|findByGoogleSub|linkGoogleAtomic|googleLoginLink|google_linked:/i,name);
 }
 const routes=fs.readFileSync(path.join(root,"gen3-auth/routes.js"),"utf8");
 assert.match(routes,/router\.post\("\/register"/);
 assert.match(routes,/router\.post\("\/login"/);
 assert.match(routes,/router\.post\("\/forgot-password"/);
});

test("homepage merges account details without a separate account sidebar page",()=>{
  const css=fs.readFileSync(path.join(root,"public/style.css"),"utf8");
  const profile=fs.readFileSync(path.join(root,"public/home-account.js"),"utf8");
  const legacyAccount=fs.readFileSync(path.join(root,"gen3-auth/account.html"),"utf8");
  assert.match(html,/id="ikeyHomeAccount"/);
  for(const id of ["ikeyHomeUsername","ikeyHomeDisplayName","ikeyHomeEmail","ikeyHomeStatus",
    "ikeyHomeRole","ikeyHomeAccountProfile","ikeyHomeAccountRefresh","ikeyHomeAccountLegacy"]){
    assert.match(html,new RegExp('id="'+id+'"'));
  }
  assert.doesNotMatch(html,/Google 帳號綁定|已停用（第三版不提供）/);
  assert.match(html,/id="ikeyHomeLegacyUsername"/);
  assert.match(html,/id="ikeyHomeLegacyRole"/);
  assert.match(profile,/fetch\("\/api\/login\/session"/);
  assert.match(html,/id="dashboardPage"/);
  assert.doesNotMatch(html,/data-page="my-account"|id="ikeyPage-my-account"/);
  assert.match(html,/src="\.\/home-account\.js"/);
  assert.match(profile,/fetch\("\/api\/auth\/me"/);
  assert.match(profile,/credentials:"same-origin",cache:"no-store"/);
  assert.match(profile,/\.textContent =/);
  assert.doesNotMatch(profile,/innerHTML|localStorage|sessionStorage/);
  assert.match(app,/iKeyHomeAccount\.load\(kind\)/);
  assert.match(app,/iKeyHomeAccount\.load\("legacy"\)/);
  assert.match(app,/iKeyHomeAccount\.clear\(\)/);
  assert.doesNotMatch(app,/location\.assign\("\/gen3\/account\.html"\)/);
  assert.match(legacyAccount,/location\.replace\("\/"\)/);
  assert.match(css,/\.ikey-account-grid/);
});
