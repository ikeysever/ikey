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
test("account status blocks password authentication",()=>{
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

test("reject malformed and oversized stored password hashes",()=>{
  assert.equal(auth.passwordVerify("a-long-password","scrypt:v1:bad:bad"),false);
  assert.equal(auth.passwordVerify("a-long-password","not-a-hash"),false);
  assert.equal(auth.passwordVerify(null,auth.passwordHash("a-long-password")),false);
});
test("expired lock can recover but disabled accounts cannot",()=>{
  assert.equal(auth.active({account_status:"temporarily_locked",locked_until:"2020-01-01T00:00:00Z"}),true);
  assert.equal(auth.active({account_status:"disabled",locked_until:"2020-01-01T00:00:00Z"}),false);
});
test("session tokens are random and only their hashes are stored",()=>{
  const a=auth.newSession("u",0),b=auth.newSession("u",0);
  assert.notEqual(a.raw,b.raw);
  assert.equal(a.record.session_token_hash,auth.hashToken(a.raw));
  assert.equal(a.record.revoked_at,"");
});
