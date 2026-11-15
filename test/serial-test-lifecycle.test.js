'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mount = require('../lib/serial-test-router');

test('project and super-admin commands share storage and status, with distinct authorization', async t => {
  const app = express();
  app.use(express.json());
  const commands = new Map();
  const device = 'ABCD2345';
  const store = {
    async dbCall(action, {table, where, data}) {
      if (action === 'db.insert') {
        assert.equal(table, 'Device_Test_Commands');
        commands.set(data.command_id, data);
        return {inserted: true, record: data};
      }
      const records = {
        Projects: {created_by_user_id: 'owner'},
        Devices: {status: 'pre_registered'},
        Project_Devices: {project_id: 'project'},
        Device_Test_Commands: commands.get(where.command_id)
      };
      return {rows: records[table] ? [records[table]] : []};
    }
  };
  const old = [process.env.IKEY_SERIAL_TEST_ENABLED, process.env.IKEY_STORAGE_BACKEND];
  process.env.IKEY_SERIAL_TEST_ENABLED = 'true';
  process.env.IKEY_STORAGE_BACKEND = 'supabase';
  t.after(() => ['IKEY_SERIAL_TEST_ENABLED', 'IKEY_STORAGE_BACKEND'].forEach((key, i) => {
    if (old[i] === undefined) delete process.env[key];
    else process.env[key] = old[i];
  }));
  mount(app, {
    store, sameProjectOrigin: () => true, requireDevice: (_req, res) => res.sendStatus(401),
    requireProjectUser(req, _res, next) {
      const id = req.get('actor');
      req.projectUser = {user_id: id, global_role: id === 'system' ? 'super_admin' : 'user'};
      next();
    }
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  function call(actor, path, body) {
    return fetch('http://127.0.0.1:' + server.address().port + '/api/serial-test/' + path, {
      headers: {actor, 'Content-Type': 'application/json'},
      method: body ? 'POST' : 'GET', body: JSON.stringify(body)
    });
  }
  for (const [actor, path, body] of [
    ['owner', 'commands', {project_id: 'project', device_id: device}],
    ['system', 'admin/commands', {device_id: device}]
  ]) {
    assert.equal((await call('outsider', path, body)).status, 403);
    const created = await call(actor, path, body);
    assert.equal(created.status, 201);
    const data = await created.json();
    assert.equal(data.status, 'pending');
    assert.equal(data.physical_unlock, false);
    const row = commands.get(data.command_id);
    assert.equal(row.actor_user_id, actor);
    const url = path + '/' + data.command_id;
    assert.deepEqual(await (await call(actor, url)).json(), data);
    assert.equal((await call('outsider', url)).status, actor === 'owner' ? 404 : 403);
    row.expires_at = new Date(0).toISOString();
    assert.equal((await (await call(actor, url)).json()).status, 'expired');
    row.status = 'completed';
    assert.equal((await (await call(actor, url)).json()).status, 'completed');
  }
  assert.equal(commands.size, 2);
});
