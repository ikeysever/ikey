'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mount = require('../lib/admin-slot-unlock-router');

test('inactive registered slots take precedence over the device-code fallback', async t => {
  const code = 'ABCD2345';
  const app = express();
  app.use(express.json());
  let active = false;
  const tables = [];
  const store = {
    async dbCall(action, {table, where}) {
      assert.equal(action, 'db.select');
      tables.push(table);
      if (table === 'Project_Slot_Codes') {
        assert.deepEqual(where, {slot_code: code});
        return {rows: [{slot_code: code, is_active: active, project_id: 'project', device_id: code, slot_number: 2}]};
      }
      if (table === 'Projects') return {rows: [{created_by_user_id: 'owner'}]};
      if (table === 'Project_Devices') return {rows: [{device_id: code}]};
      throw new Error('Unexpected table');
    }
  };
  mount(app, {store, sameProjectOrigin: () => true, requireProjectUser(req, res, next) {
    req.projectUser = {user_id: 'owner'};
    next();
  }});
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const resolve = () => fetch('http://127.0.0.1:' + server.address().port + '/api/admin/slots/resolve', {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({slot_code: code})
  });
  const inactive = await resolve();
  assert.equal(inactive.status, 404);
  assert.equal((await inactive.json()).code, 'SLOT_NOT_FOUND');
  assert.deepEqual(tables, ['Project_Slot_Codes']);
  active = true;
  const response = await resolve();
  assert.equal(response.status, 200);
  const slot = await response.json();
  assert.equal(slot.slot_number, 2);
  assert.equal(slot.control_ready, false);
});
