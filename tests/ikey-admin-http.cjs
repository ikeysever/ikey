"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { issueSession, COOKIE_NAME } = require("../lib/ibox/admin-session");
const adminRoutes = require("../lib/ibox/admin-auth-routes");

test("admin HTTP endpoint rejects anonymous, forged and accepts signed ikey", async () => {
  const original = process.env.IKEY_SESSION_SECRET;
  const secret = "test-secret-that-is-more-than-thirty-two-characters";
  process.env.IKEY_SESSION_SECRET = secret;
  const app = express();
  app.use("/api/login", adminRoutes);
  const server = app.listen(0);
  try {
    await new Promise(resolve => server.once("listening", resolve));
    const url = "http://127.0.0.1:" + server.address().port + "/api/login/admin/summary";
    const anonymous = await fetch(url);
    assert.equal(anonymous.status, 403);
    const forged = await fetch(url, { headers: { cookie: COOKIE_NAME + "=invalid" } });
    assert.equal(forged.status, 403);
    const valid = await fetch(url, {
      headers: { cookie: COOKIE_NAME + "=" + issueSession("ikey", secret) },
    });
    assert.equal(valid.status, 200);
    const body = await valid.json();
    assert.equal(body.account, "ikey");
    assert.equal(body.globalRole, "superadmin");
  } finally {
    await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
    if (original === undefined) delete process.env.IKEY_SESSION_SECRET;
    else process.env.IKEY_SESSION_SECRET = original;
  }
});
