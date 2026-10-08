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
