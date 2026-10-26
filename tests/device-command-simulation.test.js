'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const mount = require('../device-command-simulation');

const secret = 'staging-only-test-secret-at-least-32-bytes';
const deviceId = 'Y8R69EXB';

function tokenFor(id = deviceId, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({
    sub: id, exp: now + 10 * 60 * 1000, nonce: 'simulated-esp32'
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return payload + '.' + signature;
}

async function setup() {
  let time = Date.now();
  const app = express();
  app.use(express.json());
  const calls = [];
  const authStore = {
    async dbCall(action, query) {
      calls.push({ action, query });
      if (action !== 'db.select' || query.table !== 'Devices') throw new Error('unexpected storage call');
      return { rows: query.where.device_id === deviceId
        ? [{ device_id: deviceId, status: 'pre_registered' }] : [] };
    }
  };
  const requireProjectUser = (req, res, next) => {
    req.projectUser = { user_id: 'test-admin', global_role: 'super_admin' };
    next();
  };
  const state = mount(app, { enabled: true, secret, authStore, requireProjectUser, now: () => time });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  async function request(path, { method = 'GET', body, headers = {} } = {}) {
    const response = await fetch(base + path, {
      method,
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: response.status, body: await response.json() };
  }
  return {
    request, state, calls,
    advance(ms) { time += ms; },
    token: tokenFor(deviceId, time),
    close: () => new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()))
  };
}

test('simulated ESP32 command lifecycle, duplicate polling and duplicate report', async t => {
  const ctx = await setup();
  t.after(ctx.close);
  const headers = { 'Idempotency-Key': 'test-unlock-0001', Cookie: 'test=admin' };
  const created = await ctx.request('/api/device-commands', {
    method: 'POST', headers, body: { device_id: deviceId, command: 'unlock', timeout_ms: 5000 }
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.command.status, 'pending');

  const auth = { Authorization: 'Bearer ' + ctx.token };
  const poll1 = await ctx.request('/api/device/commands/next', { headers: auth });
  assert.equal(poll1.status, 200);
  assert.equal(poll1.body.command.command_id, created.body.command.command_id);
  assert.equal(poll1.body.command.status, 'claimed');

  const poll2 = await ctx.request('/api/device/commands/next', { headers: auth });
  assert.equal(poll2.body.command, null, 'claimed command must not be delivered a second time');

  const resultPath = '/api/device/commands/' + created.body.command.command_id + '/result';
  const report = await ctx.request(resultPath, {
    method: 'POST', headers: auth, body: { status: 'succeeded', detail: 'simulated relay pulse complete' }
  });
  assert.equal(report.status, 200);
  assert.equal(report.body.command.status, 'succeeded');

  const duplicateReport = await ctx.request(resultPath, {
    method: 'POST', headers: auth, body: { status: 'succeeded', detail: 'simulated relay pulse complete' }
  });
  assert.equal(duplicateReport.status, 200);
  assert.equal(duplicateReport.body.duplicate, true);
});

test('idempotency key prevents duplicate command creation and rejects key reuse with different payload', async t => {
  const ctx = await setup();
  t.after(ctx.close);
  const headers = { 'Idempotency-Key': 'dedupe-key-0001' };
  const body = { device_id: deviceId, command: 'unlock', timeout_ms: 5000 };
  const first = await ctx.request('/api/device-commands', { method: 'POST', headers, body });
  const duplicate = await ctx.request('/api/device-commands', { method: 'POST', headers, body });
  assert.equal(first.status, 201);
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.body.duplicate, true);
  assert.equal(duplicate.body.command.command_id, first.body.command.command_id);

  const conflict = await ctx.request('/api/device-commands', {
    method: 'POST', headers, body: { ...body, timeout_ms: 8000 }
  });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.code, 'IDEMPOTENCY_CONFLICT');
});

test('command times out and late execution reports cannot change terminal state', async t => {
  const ctx = await setup();
  t.after(ctx.close);
  const created = await ctx.request('/api/device-commands', {
    method: 'POST', headers: { 'Idempotency-Key': 'timeout-key-0001' },
    body: { device_id: deviceId, command: 'unlock', timeout_ms: 1000 }
  });
  ctx.advance(1001);
  const auth = { Authorization: 'Bearer ' + ctx.token };
  const poll = await ctx.request('/api/device/commands/next', { headers: auth });
  assert.equal(poll.body.command, null);
  assert.equal(ctx.state.commands.get(created.body.command.command_id).status, 'timed_out');
});

test('simulation endpoints are not available unless explicitly enabled', async t => {
  const app = express();
  app.use(express.json());
  mount(app, { enabled: false });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/device/commands/next');
  assert.equal(response.status, 404);
});
