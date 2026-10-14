"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
const script = fs.readFileSync(path.join(root, "public/gen3-project-hub.js"), "utf8");
const css = fs.readFileSync(path.join(root, "public/gen3-project-hub.css"), "utf8");

test("Gen3 project hub has an accessible landing page and both routes", () => {
  assert.match(html, /id="ikeyPage-project-center-home"/);
  assert.match(html, /id="ikeyHubTitle">iKey 專案中心/);
  assert.match(html, /data-page="project-center-home"/);
  for (const page of ["project-apply", "my-projects"]) {
    assert.match(html, new RegExp('id="ikeyPage-' + page + '"'));
    assert.match(html, new RegExp('data-ikey-hub-go="' + page + '"'));
  }
  assert.match(html, /gen3-project-hub\.css/);
  assert.match(html, /gen3-project-hub\.js/);
});

test("Project application has three accessible tabs and non-submitting preview controls", () => {
  for (const label of ["建立專案", "加入專案", "申請紀錄"]) assert.ok(html.includes(label));
  for (const panel of ["Create", "Join", "Requests"]) {
    assert.match(html, new RegExp('id="ikeyHubPanel' + panel + '"'));
    assert.match(html, new RegExp('aria-controls="ikeyHubPanel' + panel + '"'));
  }
  assert.match(html, /id="ikeyHubJoinCode"[^>]*disabled/);
  assert.match(html, /開始建立專案 · 待功能串接<\/button>/);
  assert.match(html, /送出加入申請 · 待功能串接<\/button>/);
});

test("My projects requires selection and offers six confirmed management tabs", () => {
  assert.match(html, /id="ikeyHubProjectSelect"/);
  assert.match(html, /value="preview">示範專案（僅供介面預覽，非真實資料）/);
  assert.match(html, /id="ikeyHubWorkspace" hidden/);
  for (const [panel,label] of [
    ["Overview","專案總覽"],["Ibox","iBox 管理"],["Members","成員管理"],
    ["Settings","專案設定"],["Reviews","設定審核"],["History","操作歷程"]
  ]) {
    assert.match(html, new RegExp('id="ikeyHubPanel' + panel + '"'));
    assert.ok(html.includes(label));
  }
  assert.match(script, /select\.value === "preview"/);
  assert.match(script, /workspace\.hidden = !preview/);
});

test("Hub is frontend-only, supports keyboard tabs and responsive layout", () => {
  assert.doesNotMatch(script, /fetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|innerHTML/);
  assert.match(script, /ArrowRight/);
  assert.match(script, /ArrowLeft/);
  assert.match(script, /aria-selected/);
  assert.match(css, /@media\(max-width:720px\)/);
  assert.match(css, /prefers-reduced-motion/);
});
