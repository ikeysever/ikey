'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const { passwordHash } = require('../gen3-auth/core');
const mountDeviceAuth = require('../device-auth');

const ID = 'Y8R69EXB';
const SECRET = 'isolated-device-auth-test-secret-32-bytes-minimum';
const PASSWORD = 'isolated-password-1234';

async function fixture({ configured = true, storeMode = 'valid' } = {}) {
  const previous = process.env.IKEY_DEVICE_TOKEN_SECRET;
  if (configured) process.env.IKEY_DEVICE_TOKEN_SECRET = SECRET;
  else delete process.env.IKEY_DEVICE_TOKEN_SECRET;
  const app = express();
  app.use(express.json());
  const stored = { device_id: ID, status: 'pre_registered', password_hash: passwordHash(PASSWORD) };
  const calls = [];
  const authStore = {
    async deviceAuthFindById(id) {
      calls.push(id);
      if (storeMode === 'error') throw new Error('MOCK_STORAGE_DOWN');
      if (storeMode === 'missing') return null;
      if (storeMode === 'disabled') return { ...stored, status: 'revoked' };
      return id === ID ? stored : null;
    }
  };
  mountDeviceAuth(app, storeMode === 'none' ? null : authStore);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  async function request(path, { method = 'GET', body, token } = {}) {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token === undefined ? {} : { Authorization: 'Bearer ' + token })
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: response.status, headers: response.headers, body: await response.json() };
  }
  return {
    request, calls,
    login: (password = PASSWORD) => request('/api/device/auth', {
      method: 'POST', body: { device_id: ID, password }
    }),
    close: async () => {
      await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
      if (previous === undefined) delete process.env.IKEY_DEVICE_TOKEN_SECRET;
      else process.env.IKEY_DEVICE_TOKEN_SECRET = previous;
    }
  };
}

// These tests use one process-global env variable. Do not run them concurrently.
test('valid preregistered device can log in and access /api/device/me', async t => {
  const f = await fixture(); t.after(f.close);
  const login = await f.login();
  assert.equal(login.status, 200);
  assert.equal(login.headers.get('cache-control'), 'no-store');
  assert.equal(login.body.success, true);
  assert.equal(login.body.device_id, ID);
  assert.equal(login.body.token_type, 'Bearer');
  assert.equal(login.body.expires_in, 900);
  assert.equal(typeof login.body.access_token, 'string');
  const me = await f.request('/api/device/me', { token: login.body.access_token });
  assert.equal(me.status, 200);
  assert.equal(me.body.device_id, ID);
  assert.equal(me.body.authenticated, true);
});

test('incorrect password is rejected without a token', async t => {
  const f = await fixture(); t.after(f.close);
  const r = await f.login('incorrect-password');
  assert.equal(r.status, 401);
  assert.equal(r.body.code, 'INVALID_CREDENTIALS');
  assert.equal(r.body.access_token, undefined);
});

test('missing or revoked device is rejected', async t => {
  for (const storeMode of ['missing', 'disabled']) {
    const f = await fixture({ storeMode }); t.after(f.close);
    const r = await f.login();
    assert.equal(r.status, 401);
    assert.equal(r.body.code, 'INVALID_CREDENTIALS');
  }
});

test('invalid device ID and malformed password are rejected', async t => {
  const f = await fixture(); t.after(f.close);
  const badId = await f.request('/api/device/auth', {
    method: 'POST', body: { device_id: 'INVALID!', password: PASSWORD }
  });
  assert.equal(badId.status, 400);
  const badPassword = await f.request('/api/device/auth', {
    method: 'POST', body: { device_id: ID, password: 'short' }
  });
  assert.equal(badPassword.status, 400);
  assert.equal(f.calls.length, 0);
});

test('missing token secret fails closed with 503', async t => {
  const f = await fixture({ configured: false }); t.after(f.close);
  const r = await f.login();
  assert.equal(r.status, 503);
  assert.equal(r.body.code, 'DEVICE_AUTH_NOT_CONFIGURED');
});

test('storage errors fail closed without exposing secrets', async t => {
  const f = await fixture({ storeMode: 'error' }); t.after(f.close);
  const r = await f.login();
  assert.equal(r.status, 503);
  assert.equal(r.body.code, 'DEVICE_AUTH_UNAVAILABLE');
  assert.equal(r.body.access_token, undefined);
});

test('missing or altered bearer token is rejected', async t => {
  const f = await fixture(); t.after(f.close);
  const noToken = await f.request('/api/device/me');
  assert.equal(noToken.status, 401);
  const login = await f.login();
  assert.equal(login.status, 200);
  const token = login.body.access_token;
  const changed = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');
  const tampered = await f.request('/api/device/me', { token: changed });
  assert.equal(tampered.status, 401);
});

test('expired bearer token is rejected', async t => {
  const f = await fixture(); t.after(f.close);
  const now = Date.now() - 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({
    iss: 'ikey-render', aud: 'ikey-device-api', sub: ID,
    iat: now, exp: now + 15 * 60 * 1000,
    nonce: crypto.randomBytes(16).toString('base64url')
  })).toString('base64url');
  const token = payload + '.' + crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  const r = await f.request('/api/device/me', { token });
  assert.equal(r.status, 401);
});

test('rate limiter rejects repeated login attempts', async t => {
  const f = await fixture(); t.after(f.close);
  for (let i = 0; i < 5; i++) {
    const r = await f.login('incorrect-password');
    assert.equal(r.status, 401);
  }
  const sixth = await f.login('incorrect-password');
  assert.equal(sixth.status, 429);
  assert.equal(sixth.body.code, 'RATE_LIMITED');
});

test('missing auth storage fails closed', async t => {
  const f = await fixture({ storeMode: 'none' }); t.after(f.close);
  const r = await f.login();
  assert.equal(r.status, 503);
  assert.equal(r.body.code, 'DEVICE_AUTH_UNAVAILABLE');
});

test('device auth never exposes password hash in successful responses', async t => {
  const f = await fixture(); t.after(f.close);
  const login = await f.login();
  assert.equal(login.status, 200);
  assert.equal(Object.hasOwn(login.body, 'password_hash'), false);
  const me = await f.request('/api/device/me', { token: login.body.access_token });
  assert.equal(me.status, 200);
  assert.equal(Object.hasOwn(me.body, 'password_hash'), false);
});

test('a device revoked after token issuance immediately loses access', async t => {
  const f = await fixture(); t.after(f.close);
  const login = await f.login();
  assert.equal(login.status, 200);
  // Simulate a device record changing after the token was issued.
  const original = f.calls.length;
  assert.ok(original >= 1);
  const token = login.body.access_token;
  // A separate fixture with revoked storage must reject the signed token.
  const revoked = await fixture({ storeMode: 'disabled' }); t.after(revoked.close);
  const me = await revoked.request('/api/device/me', { token });
  assert.equal(me.status, 401);
  assert.equal(me.body.code, 'UNAUTHORIZED');
});

test('invalid token structure and missing authorization are rejected', async t => {
  const f = await fixture(); t.after(f.close);
  for (const token of ['abc', 'a.b.c', '!.!', '']) {
    const response = await f.request('/api/device/me', { token });
    assert.equal(response.status, 401);
    assert.equal(response.body.access_token, undefined);
  }
});
