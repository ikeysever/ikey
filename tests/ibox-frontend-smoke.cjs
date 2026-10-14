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
  assert.doesNotMatch(html, /id="connectionMonitorPage"|ikeyConnectionDevices|connectionText|connectionDot/);
  assert.match(operations, /\/api\/login\/admin\/summary/);
  assert.doesNotMatch(operations, /\/api\/login\/admin\/connections|updateConnections/);
  assert.doesNotMatch(auth, /router\.get\("\/admin\/connections"/);
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


test("approved multi-scene welcome is independent of device monitoring", () => {
  const welcome = fs.readFileSync(path.join(root, "public/welcome-padlock.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "public/style.css"), "utf8");
  assert.match(html, /src="\.\/welcome-padlock\.js"/);
  assert.match(app, /iKeyPadlockWelcome\.create\(\)/);
  assert.doesNotMatch(app, /fetchDeviceStatus|startDevicePolling|\/api\/device\/status/);
  assert.doesNotMatch(welcome, /prepareHome|loadTimeout|retry\.addEventListener/);
  assert.match(welcome, /const copy=p\(time,7\.55,\.6\),sub=p\(time,8\.15,\.6\)/);
  assert.match(welcome, /自動多場景智慧鎖/);
  assert.doesNotMatch(welcome, /智慧鑰匙管理系統|智慧鑰匙倉儲管理系統/);
  assert.match(welcome, /!finished/);
  assert.doesNotMatch(welcome, /首頁載入逾時|首頁載入失敗|重新載入/);
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

test("main login exposes username-only Gen3 account without legacy recovery pages",()=>{
 const server=fs.readFileSync(path.join(root,"server.js"),"utf8");
 const statusScript=fs.readFileSync(path.join(root,"public/gen3-entry.js"),"utf8");
 assert.match(html,/href="\/gen3\/register\.html"/);
 assert.match(html,/id="gen3LoginForm"/);
 assert.match(html,/href="\/\?legacy=1"/);
 assert.match(server,/gen3Store\.health\(\)/);
 assert.match(statusScript,/\/api\/auth\/status/);
 assert.doesNotMatch(html,/帳號或電子郵件|忘記密碼\.html|ikeyV3Email/);
 assert.match(server,/gen3Pages=new Set/);
 for(const page of ["login.html","register.html","account.html"])assert.ok(fs.existsSync(path.join(root,"gen3-auth",page)));
 for(const page of ["forgot-password.html","verify-email.html","reset-password.html"])assert.equal(fs.existsSync(path.join(root,"gen3-auth",page)),false);
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

test("primary login and registration use username only",()=>{
 const css=fs.readFileSync(path.join(root,"public/style.css"),"utf8");
 const status=fs.readFileSync(path.join(root,"public/gen3-entry.js"),"utf8");
 assert.match(html,/id="gen3LoginPanel"/);
 assert.match(html,/class="ikey-login-subtitle">自動多場景智慧鎖<\/p>/);
 assert.match(html,/id="legacyLoginPanel"[^>]*hidden/);
 assert.match(css,/#loginPage #gen3LoginPanel \.form-group input/);
 assert.match(status,/fetch\("\/api\/auth\/status"/);
 for(const page of ["login.html","register.html","account.html"]){
  const content=fs.readFileSync(path.join(root,"gen3-auth",page),"utf8");
  assert.doesNotMatch(content,/電子郵件|驗證信|忘記密碼\.html/);
 }
});

test("Gen3 readiness gates registration on username-only Apps Script version",()=>{
 const server=fs.readFileSync(path.join(root,"server.js"),"utf8");
 const register=fs.readFileSync(path.join(root,"gen3-auth/register.html"),"utf8");
 assert.match(server,/appsScriptUrlConfigured:gen3UrlValid/);
 assert.match(server,/appsScriptKeyConfigured:gen3KeyValid/);
 assert.match(server,/registration:r.registration/);
 assert.match(server,/APPS_SCRIPT_VERSION_MISMATCH/);
 assert.match(server,/APPS_SCRIPT_UPGRADE_REQUIRED/);
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

test("Gen3 health errors distinguish permission and spreadsheet failures",()=>{
 const vm=require("node:vm");
 const server=fs.readFileSync(path.join(root,"server.js"),"utf8");
 const from=server.indexOf("function gen3FailureCategory(err){");
 const to=server.indexOf("async function checkGen3()",from);
 assert.ok(from>=0&&to>from);
 const categorize=vm.runInNewContext("("+server.slice(from,to).trim()+")");
 assert.equal(categorize(new Error("GEN3_STORAGE_Exception: You do not have permission to call SpreadsheetApp.openById on private-id")),"APPS_SCRIPT_PERMISSION_DENIED");
 assert.equal(categorize(new Error("GEN3_STORAGE_Exception: Service Spreadsheets failed while accessing document with id private-id")),"APPS_SCRIPT_SPREADSHEET_ACCESS_FAILED");
 assert.equal(categorize(new Error("GEN3_STORAGE_UNKNOWN_ACTION")),"APPS_SCRIPT_OUTDATED_ACTION");
 assert.equal(categorize(new Error("GEN3_STORAGE_UNAUTHORIZED")),"APPS_SCRIPT_AUTH_FAILED");
});

test("external login and mail registration endpoints are absent",()=>{
 const paths=["server.js","gen3-auth/routes.js","gen3-auth/sheets-store.js","gen3-auth/core.js",
  "gen3-auth/apps-script/Code.gs","gen3-auth/login.html","gen3-auth/register.html",
  "gen3-auth/account.html","public/index.html","public/gen3-entry.js"];
 for(const name of paths){
  const content=fs.readFileSync(path.join(root,name),"utf8");
  assert.doesNotMatch(content,/GOOGLE_OAUTH_CLIENT_|\/api\/auth\/google|\/google\/(?:start|link|callback)|registerGoogleAtomic|findByGoogleSub|linkGoogleAtomic|googleLoginLink|google_linked:/i,name);
 }
 const routes=fs.readFileSync(path.join(root,"gen3-auth/routes.js"),"utf8");
 assert.match(routes,/router\.post\("\/register"/);
 assert.match(routes,/router\.post\("\/login"/);
 assert.doesNotMatch(routes,/router\.post\("\/(?:forgot-password|reset-password|verify-email|resend-verification)"/);
});

test("Gen3 homepage is fully rebuilt and keeps other app sections intact",()=>{
  const home=fs.readFileSync(path.join(root,"public/home-dashboard.js"),"utf8");
  const styles=fs.readFileSync(path.join(root,"public/style.css"),"utf8");
  assert.match(html,/id="dashboardPage" class="content-page ikey-v3-home"/);
  assert.match(html,/id="ikeyV3HeroTitle"/);
  assert.match(html,/自動多場景智慧鎖/);
  for(const name of ["iKey Web","LINE","iBox · ESP32"]){
    assert.ok(html.includes(name),name);
  }
  for(const id of ["ikeyV3Greeting","ikeyV3Account","ikeyV3AccountRefresh",
    "ikeyV3Gen3Fields","ikeyV3AdminFields","ikeyV3Username",
    "ikeyV3AdminUsername"]){
    assert.match(html,new RegExp('id="'+id+'"'));
  }
  // Device monitor belongs to a future project-specific view, not the homepage.
  assert.doesNotMatch(html,/ikeyV3Devices|裝置連線監測|查看裝置狀態|id="espRobotStatus"|id="lvglTerminalStatus"|id="connectedDeviceCount"/);
  assert.doesNotMatch(styles,/ikey-v3-device-list|ikey-v3-device-item|ikey-v3-devices-note|ikeyV3Devices/);
  assert.doesNotMatch(app,/updateDeviceStatus\(|getElementById\("espRobotStatus"\)/);
  assert.doesNotMatch(app,/fetchDeviceStatus|startDevicePolling|\/api\/device\/status/);
  assert.match(html,/src="\.\/home-dashboard\.js"/);
  assert.doesNotMatch(html,/home-account\.js|ikeyHomeAccount|Google 帳號綁定|已停用（第三版不提供）/);
  assert.match(html,/id="projectCenterPage"/);
  assert.match(html,/id="ikeyAdminPage"/);
  assert.match(html,/id="terminalPage"/);
  assert.match(html,/id="loginPage"/);
  assert.match(home,/fetch\(endpoint, \{credentials:"same-origin",cache:"no-store"\}\)/);
  assert.match(home,/\/api\/auth\/me/);
  assert.match(home,/\/api\/login\/session/);
  assert.doesNotMatch(home,/innerHTML|localStorage|sessionStorage/);
  assert.match(app,/iKeyHomeDashboard\.load\(kind\)/);
  assert.match(app,/iKeyHomeDashboard\.load\("legacy"\)/);
  assert.match(app,/iKeyHomeDashboard\.clear\(\)/);
  assert.match(styles,/#dashboardPage\.ikey-v3-home/);
  assert.doesNotMatch(styles,/\.ikey-home-account/);
  // The old global connection indicator is gone; monitoring will be per project.
  assert.doesNotMatch(html,/connection-status|connectionDot|connectionText/);
  assert.doesNotMatch(styles,/\.connection-status|\.connection-dot/);
});

test("retired global heartbeat API is not mounted and its registry is deleted",()=>{
  const server=fs.readFileSync(path.join(root,"server.js"),"utf8");
  const admin=fs.readFileSync(path.join(root,"lib/ibox/admin-auth-routes.js"),"utf8");
  const operations=fs.readFileSync(path.join(root,"public/admin-operations.js"),"utf8");
  const line=fs.readFileSync(path.join(root,"routes/line.js"),"utf8");
  assert.equal(fs.existsSync(path.join(root,"routes/device.js")),false);
  assert.doesNotMatch(line,/require\("\.\/device"\)|esp-robot|lvgl-terminal|getStatusSnapshot/);
  assert.match(line,/createSystemStatusFlex\(databaseHealth\)/);
  assert.doesNotMatch(server,/deviceRoutes|["']\/api\/device["']/);
  assert.doesNotMatch(admin,/getStatusSnapshot|\/admin\/connections/);
  assert.doesNotMatch(operations,/\/admin\/connections|updateConnections|connectionMonitorPage/);
  assert.match(server,/\/api\/health/);
  assert.match(server,/\/api\/database/);
  assert.match(server,/\/api\/line/);
});
