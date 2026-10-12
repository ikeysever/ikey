"use strict";
const assert = require("node:assert/strict");
const {test} = require("node:test");
const auth = require("./core");
test("normalize email and reject invalid input",()=>{
  assert.equal(auth.normalizeEmail(" A@EXAMPLE.COM "),"a@example.com");
  assert.throws(()=>auth.normalizeEmail("invalid"));
});
test("password hashed with salt and verified",()=>{
  const a=auth.passwordHash("a-long-password"),b=auth.passwordHash("a-long-password");
  assert.notEqual(a,b);
  assert.equal(auth.passwordVerify("a-long-password",a),true);
  assert.equal(auth.passwordVerify("wrong-password",a),false);
  assert.throws(()=>auth.passwordHash("short"));
});
test("account status blocks Google and password",()=>{
  assert.equal(auth.active({account_status:"disabled"}),false);
  assert.equal(auth.active({account_status:"pending_deletion"}),false);
  assert.equal(auth.active({account_status:"temporarily_locked",locked_until:"2099-01-01T00:00:00Z"}),false);
  assert.equal(auth.active({account_status:"temporarily_locked",locked_until:"2020-01-01T00:00:00Z"}),true);
});
test("session is hashed and expires in 7 days",()=>{
  const s=auth.newSession("user-1",0);
  assert.notEqual(s.raw,s.record.session_token_hash);
  assert.equal(Date.parse(s.record.expires_at),auth.SESSION_MS);
});
