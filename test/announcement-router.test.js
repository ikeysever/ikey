'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createServer } = require('node:http');
const { createAnnouncementRouter } = require('../gen3-auth/announcement-router');

function makeStore() {
  const tables = {
    System_Announcements: [],
    System_Announcement_Reads: []
  };
  return {
    tables,
    async resolveSession() {
      const user = globalThis.__announcementTestRole === 'super_admin'
        ? { user_id: 'admin-1', global_role: 'super_admin', account_status: 'active' }
        : { user_id: 'user-1', global_role: 'user', account_status: 'active' };
      return { user, session: { revoked_at: '', expires_at: '2999-01-01T00:00:00.000Z' } };
    },
    async dbCall(action, payload) {
      const rows = tables[payload.table];
      if (!rows) throw new Error('DB_TABLE_NOT_FOUND');
      if (action === 'db.select') {
        const matches = rows.filter(row => Object.entries(payload.where).every(([k,v]) => String(row[k]) === String(v)));
        return { rows: matches.slice(0, payload.limit || 100), count: matches.length };
      }
      if (action === 'db.insert') {
        if (rows.some(row => String(row[payload.primary_key]) === String(payload.data[payload.primary_key]))) throw new Error('GEN3_STORAGE_DB_DUPLICATE_KEY');
        rows.push({ ...payload.data });
        return { inserted: true, record: { ...payload.data } };
      }
      if (action === 'db.update') {
        const matches = rows.filter(row => Object.entries(payload.where).every(([k,v]) => String(row[k]) === String(v)));
        if (matches.length !== 1) throw new Error('DB_NOT_UNIQUE');
        Object.assign(matches[0], payload.data);
        return { updated: true };
      }
      throw new Error('UNSUPPORTED_ACTION');
    }
  };
}
async function withApi(role, fn, seed = []) {
  globalThis.__announcementTestRole = role;
  const store = makeStore();
  store.tables.System_Announcements.push(...seed.map(row => ({ ...row })));
  const app = express();
  app.use(express.json());
  app.use('/api', createAnnouncementRouter(store));
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const base = 'http://127.0.0.1:' + address.port;
  try { await fn({ base, store }); }
  finally { await new Promise(resolve => server.close(resolve)); delete globalThis.__announcementTestRole; }
}
const adminCookie = 'ikey_gen3_session=admin-session';
const userCookie = 'ikey_gen3_session=user-session';
const published = (overrides = {}) => ({
  announcement_id: '11111111-1111-4111-8111-111111111111',
  title: '系統公告', content: '公告內容', category: 'system', priority: 'normal',
  status: 'published', created_by_user_id: 'admin-1', updated_by_user_id: 'admin-1',
  created_at: '2026-11-01T00:00:00.000Z', updated_at: '2026-11-01T00:00:00.000Z',
  published_at: '2026-11-01T00:00:00.000Z', scheduled_at: '', expires_at: '',
  archived_at: '', deleted_at: '', ...overrides
});

test('public list exposes only published, non-expired announcements and sorts by priority', async () => {
  await withApi('user', async ({ base }) => {
    const response = await fetch(base + '/api/announcements');
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.announcements[0].created_by_user_id, undefined);
    assert.deepEqual(data.announcements.map(x => x.announcement_id), [
      '22222222-2222-4222-8222-222222222222',
      '11111111-1111-4111-8111-111111111111'
    ]);
  }, [
    published(),
    published({ announcement_id: '22222222-2222-4222-8222-222222222222', priority: 'urgent' }),
    published({ announcement_id: '33333333-3333-4333-8333-333333333333', status: 'draft' }),
    published({ announcement_id: '44444444-4444-4444-8444-444444444444', expires_at: '2000-01-01T00:00:00.000Z' })
  ]);
});

test('admin routes reject non-super-admin users', async () => {
  await withApi('user', async ({ base }) => {
    const response = await fetch(base + '/api/admin/announcements', { headers: { Cookie: userCookie } });
    assert.equal(response.status, 403);
  });
});

test('super admin can create, publish, soft-delete and restore an announcement', async () => {
  await withApi('super_admin', async ({ base, store }) => {
    const create = await fetch(base + '/api/admin/announcements', {
      method: 'POST', headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '維護通知', content: '今晚維護', category: 'maintenance', priority: 'important' })
    });
    const created = await create.json();
    assert.equal(create.status, 201);
    const id = created.announcement.announcement_id;
    assert.equal(store.tables.System_Announcements.length, 1);

    const publish = await fetch(base + '/api/admin/announcements/' + id + '/publish', { method: 'POST', headers: { Cookie: adminCookie } });
    assert.equal(publish.status, 200);
    assert.equal(store.tables.System_Announcements[0].status, 'published');

    const remove = await fetch(base + '/api/admin/announcements/' + id, { method: 'DELETE', headers: { Cookie: adminCookie } });
    assert.equal(remove.status, 200);
    assert.equal(store.tables.System_Announcements[0].status, 'deleted');

    const restore = await fetch(base + '/api/admin/announcements/' + id + '/restore', { method: 'POST', headers: { Cookie: adminCookie } });
    assert.equal(restore.status, 200);
    assert.equal(store.tables.System_Announcements[0].status, 'draft');
  });
});

test('read receipts are idempotent per user and announcement', async () => {
  await withApi('user', async ({ base, store }) => {
    const id = '11111111-1111-4111-8111-111111111111';
    const first = await fetch(base + '/api/announcements/' + id + '/read', { method: 'POST', headers: { Cookie: userCookie } });
    const second = await fetch(base + '/api/announcements/' + id + '/read', { method: 'POST', headers: { Cookie: userCookie } });
    assert.equal(first.status, 201);
    assert.equal((await first.json()).already_read, false);
    assert.equal(second.status, 200);
    assert.equal((await second.json()).already_read, true);
    assert.equal(store.tables.System_Announcement_Reads.length, 1);
  }, [published()]);
});

test('scheduled worker publishes due items and archives expired published items', async () => {
  const previousSecret = process.env.ANNOUNCEMENTS_CRON_SECRET;
  process.env.ANNOUNCEMENTS_CRON_SECRET = 'staging-test-secret-'.padEnd(40, 'x');
  const expired = published({
    announcement_id: '55555555-5555-4555-8555-555555555555',
    expires_at: new Date(Date.now() - 60_000).toISOString()
  });
  const stillVisible = published({
    announcement_id: '66666666-6666-4666-8666-666666666666',
    expires_at: new Date(Date.now() + 60_000).toISOString()
  });
  const due = published({
    announcement_id: '77777777-7777-4777-8777-777777777777',
    status: 'scheduled',
    published_at: '',
    scheduled_at: new Date(Date.now() - 60_000).toISOString(),
    expires_at: ''
  });
  const expiredBeforeSchedule = published({
    announcement_id: '88888888-8888-4888-8888-888888888888',
    status: 'scheduled',
    published_at: '',
    scheduled_at: new Date(Date.now() - 120_000).toISOString(),
    expires_at: new Date(Date.now() - 60_000).toISOString()
  });
  try {
    await withApi('user', async ({ base, store }) => {
      const response = await fetch(base + '/api/internal/announcements/publish-due', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + process.env.ANNOUNCEMENTS_CRON_SECRET }
      });
      const data = await response.json();
      assert.equal(response.status, 200);
      assert.equal(data.processed, 3);
      assert.equal(store.tables.System_Announcements.find(row => row.announcement_id === expired.announcement_id).status, 'archived');
      assert.equal(store.tables.System_Announcements.find(row => row.announcement_id === due.announcement_id).status, 'published');
      assert.equal(store.tables.System_Announcements.find(row => row.announcement_id === expiredBeforeSchedule.announcement_id).status, 'archived');
      assert.equal(store.tables.System_Announcements.find(row => row.announcement_id === stillVisible.announcement_id).status, 'published');
    }, [expired, stillVisible, due, expiredBeforeSchedule]);
  } finally {
    if (previousSecret === undefined) delete process.env.ANNOUNCEMENTS_CRON_SECRET;
    else process.env.ANNOUNCEMENTS_CRON_SECRET = previousSecret;
  }
});

test('invalid announcement input is rejected before any database write', async () => {
  await withApi('super_admin', async ({ base, store }) => {
    const response = await fetch(base + '/api/admin/announcements', {
      method: 'POST', headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '', content: 'invalid', category: 'system', priority: 'normal' })
    });
    assert.equal(response.status, 400);
    assert.equal(store.tables.System_Announcements.length, 0);
  });
});

test('partial admin update preserves fields omitted from the request', async () => {
  const row = published({ status: 'draft', published_at: '' });
  await withApi('super_admin', async ({ base, store }) => {
    const response = await fetch(base + '/api/admin/announcements/' + row.announcement_id, {
      method: 'PUT', headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '更新後標題' })
    });
    assert.equal(response.status, 200);
    assert.equal(store.tables.System_Announcements[0].title, '更新後標題');
    assert.equal(store.tables.System_Announcements[0].content, '公告內容');
    assert.equal(store.tables.System_Announcements[0].category, 'system');
  }, [row]);
});
