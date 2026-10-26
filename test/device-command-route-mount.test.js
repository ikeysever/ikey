'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('device command simulation is mounted behind an explicit environment gate', () => {
  const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  assert.ok(server.includes("require('./device-command-simulation')(app,"));
  assert.ok(server.includes("enabled: process.env.IKEY_DEVICE_SIMULATION_ENABLED === 'true'"));
  assert.ok(server.includes("secret: process.env.IKEY_DEVICE_TOKEN_SECRET"));
  assert.ok(server.includes('requireProjectUser'));
  const deviceAuth = fs.readFileSync(path.join(__dirname, '../device-auth.js'), 'utf8');
  assert.equal((server.match(/require\('\.\/device-command-simulation'\)\(app,/g) || []).length, 1);
  assert.equal(deviceAuth.includes("require('./device-command-simulation')"), false);
});

test('device command simulation is documented as in-memory and not a physical-control backend', () => {
  const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  assert.ok(server.includes('it is in-memory and is NOT a physical-control backend'));
  const simulator = fs.readFileSync(path.join(__dirname, '../device-command-simulation.js'), 'utf8');
  assert.ok(simulator.includes('in-memory'));
  assert.ok(simulator.includes("app.get('/api/device/commands/next'"));
  assert.ok(simulator.includes("app.post('/api/device/commands/:commandId/result'"));
});
