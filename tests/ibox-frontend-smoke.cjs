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
  assert.match(html, /data-page="terminal" hidden/);
  assert.match(html, /data-page="connections" hidden/);
  assert.match(html, /id="connectionMonitorPage"/);
  assert.match(operations, /\/api\/login\/admin\/summary/);
  assert.match(operations, /\/api\/login\/admin\/connections/);
  assert.match(auth, /router\.get\("\/admin\/connections", requireSuperadmin/);
});
