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


test('concurrent create requests with the same idempotency key create only one command', async t => {
  const ctx = await setup();
  t.after(ctx.close);
  const headers = { 'Idempotency-Key': 'concurrent-key-0001' };
  const body = { device_id: deviceId, command: 'unlock', timeout_ms: 5000 };
  const results = await Promise.all([
    ctx.request('/api/device-commands', { method: 'POST', headers, body }),
    ctx.request('/api/device-commands', { method: 'POST', headers, body })
  ]);
  assert.equal(results.filter(x => x.status === 201).length, 1);
  assert.equal(results.filter(x => x.status === 200 && x.body.duplicate).length, 1);
  assert.equal(new Set(results.map(x => x.body.command.command_id)).size, 1);
  assert.equal(ctx.state.commands.size, 1);
});

test('concurrent device polls claim a pending command at most once', async t => {
  const ctx = await setup();
  t.after(ctx.close);
  const created = await ctx.request('/api/device-commands', {
    method: 'POST', headers: { 'Idempotency-Key': 'poll-race-key-0001' },
    body: { device_id: deviceId, command: 'unlock', timeout_ms: 5000 }
  });
  const headers = { Authorization: 'Bearer ' + ctx.token };
  const polls = await Promise.all([
    ctx.request('/api/device/commands/next', { headers }),
    ctx.request('/api/device/commands/next', { headers })
  ]);
  assert.equal(polls.filter(x => x.body.command?.command_id === created.body.command.command_id).length, 1);
  assert.equal(polls.filter(x => x.body.command === null).length, 1);
});

test('expired and tampered device tokens are rejected', async t => {
  const ctx = await setup();
  t.after(ctx.close);
  const expired = ctx.token;
  ctx.advance(11 * 60 * 1000);
  const expiredResponse = await ctx.request('/api/device/commands/next', {
    headers: { Authorization: 'Bearer ' + expired }
  });
  assert.equal(expiredResponse.status, 401);

  const tamperedResponse = await ctx.request('/api/device/commands/next', {
    headers: { Authorization: 'Bearer ' + expired.slice(0, -1) + (expired.endsWith('A') ? 'B' : 'A') }
  });
  assert.equal(tamperedResponse.status, 401);
});

test('failed execution is terminal and a contradictory late result is rejected', async t => {
  const ctx = await setup();
  t.after(ctx.close);
  const created = await ctx.request('/api/device-commands', {
    method: 'POST', headers: { 'Idempotency-Key': 'failure-key-0001' },
    body: { device_id: deviceId, command: 'unlock', timeout_ms: 5000 }
  });
  const headers = { Authorization: 'Bearer ' + ctx.token };
  await ctx.request('/api/device/commands/next', { headers });
  const path = '/api/device/commands/' + created.body.command.command_id + '/result';
  const failed = await ctx.request(path, {
    method: 'POST', headers, body: { status: 'failed', detail: 'simulated actuator feedback timeout' }
  });
  assert.equal(failed.status, 200);
  assert.equal(failed.body.command.status, 'failed');

  const contradictory = await ctx.request(path, {
    method: 'POST', headers, body: { status: 'succeeded', detail: 'late contradictory report' }
  });
  assert.equal(contradictory.status, 409);
  assert.equal(contradictory.body.code, 'COMMAND_ALREADY_FINISHED');
});

test('a claimed command that passes its deadline cannot accept a late success report', async t => {
  const ctx = await setup();
  t.after(ctx.close);
  const created = await ctx.request('/api/device-commands', {
    method: 'POST', headers: { 'Idempotency-Key': 'claimed-timeout-0001' },
    body: { device_id: deviceId, command: 'unlock', timeout_ms: 1000 }
  });
  const headers = { Authorization: 'Bearer ' + ctx.token };
  await ctx.request('/api/device/commands/next', { headers });
  ctx.advance(1001);
  const report = await ctx.request('/api/device/commands/' + created.body.command.command_id + '/result', {
    method: 'POST', headers, body: { status: 'succeeded', detail: 'late result' }
  });
  assert.equal(report.status, 409);
  assert.equal(report.body.code, 'COMMAND_ALREADY_FINISHED');
  assert.equal(report.body.status, 'timed_out');
});
