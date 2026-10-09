"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  COOKIE_NAME, getServerRole, issueSession, verifySession, sessionFromRequest,
} = require("../lib/ibox/admin-session");
const secret = "a-very-long-test-only-secret-with-32-plus-characters";
const now = 1791450000000;

test("only ikey has the global superadmin role", () => {
  assert.equal(getServerRole("ikey"), "superadmin");
  assert.equal(getServerRole("IKEY"), null);
  assert.equal(getServerRole("student"), null);
});

test("server-issued session verifies as ikey superadmin", () => {
  const token = issueSession("ikey", secret, now);
  assert.deepEqual(verifySession(token, secret, now + 1000), {
    userId: "ikey", globalRole: "superadmin",
  });
  assert.deepEqual(sessionFromRequest({
    headers: { cookie: "other=x; " + COOKIE_NAME + "=" + token },
  }, secret, now + 1000), { userId: "ikey", globalRole: "superadmin" });
});

test("rejects expired, altered and incorrectly signed tokens", () => {
  const token = issueSession("ikey", secret, now);
  assert.equal(verifySession(token, secret, now + 8 * 60 * 60 * 1000), null);
  assert.equal(verifySession(token + "x", secret, now), null);
  assert.equal(verifySession(token, secret + "other", now), null);
});

test("no secret means no elevated session", () => {
  assert.equal(issueSession("ikey", ""), null);
  assert.equal(issueSession("student", secret), null);
  assert.equal(verifySession("invalid", secret), null);
});
