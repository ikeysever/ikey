'use strict';
const express = require('express');
const crypto = require('node:crypto');
const { hashToken, active } = require('./core');
const { sortAnnouncements } = require('../lib/announcement-order');

const TABLE = 'System_Announcements';
const READ_TABLE = 'System_Announcement_Reads';
const CATEGORIES = new Set(['system','maintenance','feature','administrative','other']);
const PRIORITIES = new Set(['urgent','important','normal']);
const STATUSES = ['draft','scheduled','published','archived','deleted'];
const COOKIE = 'ikey_gen3_session';
const nowIso = () => new Date().toISOString();
const clean = value => typeof value === 'string' ? value.trim() : '';
const safeRecord = row => ({
  announcement_id: String(row.announcement_id || ''),
  title: String(row.title || ''),
  content: String(row.content || ''),
  category: String(row.category || 'other'),
  priority: String(row.priority || 'normal'),
  status: String(row.status || 'draft'),
  created_at: String(row.created_at || ''),
  updated_at: String(row.updated_at || ''),
  published_at: String(row.published_at || ''),
  scheduled_at: String(row.scheduled_at || ''),
  expires_at: String(row.expires_at || ''),
  archived_at: String(row.archived_at || ''),
  deleted_at: String(row.deleted_at || '')
});
function getCookie(req, name) {
  const part = String(req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(name + '='));
  return part ? part.slice(name.length + 1) : '';
}
function sameOrigin(req) {
  const origin = req.get('origin');
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    const scheme = req.secure || req.get('x-forwarded-proto') === 'https' ? 'https:' : 'http:';
    return parsed.protocol === scheme && parsed.host === req.get('host');
  } catch { return false; }
}
function parseOptionalDate(value, field) {
  if (value === '' || value === null || value === undefined) return '';
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    const error = new Error('INVALID_' + field.toUpperCase());
    error.status = 400;
    throw error;
  }
  return new Date(value).toISOString();
}
function validateInput(body, partial = false) {
  const source = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const title = source.title === undefined && partial ? undefined : clean(source.title);
  const content = source.content === undefined && partial ? undefined : clean(source.content);
  const category = source.category === undefined && partial ? undefined : clean(source.category || 'system');
  const priority = source.priority === undefined && partial ? undefined : clean(source.priority || 'normal');
  if (!partial || source.title !== undefined) {
    if (!title || title.length > 120) throw Object.assign(new Error('標題必填，且不得超過 120 字'), { status: 400 });
  }
  if (!partial || source.content !== undefined) {
    if (!content || content.length > 10000) throw Object.assign(new Error('公告內容必填，且不得超過 10,000 字'), { status: 400 });
  }
  if (category !== undefined && !CATEGORIES.has(category)) throw Object.assign(new Error('公告分類不正確'), { status: 400 });
  if (priority !== undefined && !PRIORITIES.has(priority)) throw Object.assign(new Error('公告優先級不正確'), { status: 400 });
  const scheduled_at = source.scheduled_at === undefined && partial ? undefined : parseOptionalDate(source.scheduled_at, 'scheduled_at');
  const expires_at = source.expires_at === undefined && partial ? undefined : parseOptionalDate(source.expires_at, 'expires_at');
  const published_at = source.published_at === undefined && partial ? undefined : parseOptionalDate(source.published_at, 'published_at');
  const scheduleForCompare = scheduled_at === undefined ? '' : scheduled_at;
  const expiryForCompare = expires_at === undefined ? '' : expires_at;
  if (expiryForCompare && scheduleForCompare && Date.parse(expiryForCompare) <= Date.parse(scheduleForCompare)) {
    throw Object.assign(new Error('到期時間必須晚於排程發布時間'), { status: 400 });
  }
  const out = {};
  for (const [key, value] of Object.entries({ title, content, category, priority, scheduled_at, expires_at, published_at })) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}
function createAnnouncementRouter(store) {
  const router = express.Router();
  async function resolveUser(req) {
    if (!store) return null;
    const raw = getCookie(req, COOKIE);
    if (!raw || raw.length > 256) return null;
    const resolved = await store.resolveSession(hashToken(raw));
    if (!resolved || resolved.session.revoked_at || Date.parse(resolved.session.expires_at) <= Date.now() || !active(resolved.user)) return null;
    return resolved.user;
  }
  async function requireUser(req, res, next) {
    res.set('Cache-Control', 'no-store');
    try {
      const user = await resolveUser(req);
      if (!user) return res.status(401).json({ success: false, message: '請先登入' });
      req.announcementUser = user;
      return next();
    } catch {
      return res.status(503).json({ success: false, message: '無法驗證登入狀態' });
    }
  }
  function requireSuperAdmin(req, res, next) {
    if (req.announcementUser?.global_role !== 'super_admin') return res.status(403).json({ success: false, message: '需要超級管理員權限' });
    return next();
  }
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (['POST','PUT','PATCH','DELETE'].includes(req.method) && !sameOrigin(req)) {
      return res.status(403).json({ success: false, message: '來源驗證失敗' });
    }
    next();
  });
  async function selectByStatus(status) {
    const result = await store.dbCall('db.select', { table: TABLE, where: { status }, limit: 100 });
    if (!Array.isArray(result?.rows)) throw new Error('INVALID_ANNOUNCEMENT_LIST');
    return result.rows.map(safeRecord);
  }
  async function findById(id) {
    const result = await store.dbCall('db.select', { table: TABLE, where: { announcement_id: id }, limit: 1 });
    const row = (result?.rows || []).find(item => String(item.announcement_id) === id);
    return row ? safeRecord(row) : null;
  }
  async function update(id, data) {
    const result = await store.dbCall('db.update', { table: TABLE, where: { announcement_id: id }, data });
    if (result?.updated !== true) throw new Error('ANNOUNCEMENT_UPDATE_UNCONFIRMED');
  }
  function validId(value) { return typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value); }

  // Public, read-only list. Only currently published and non-expired announcements are exposed.
  router.get('/announcements', async (_req, res) => {
    try {
      const rows = await selectByStatus('published');
      const now = Date.now();
      const visible = rows.filter(row => !row.expires_at || Date.parse(row.expires_at) > now);
      return res.json({ success: true, announcements: sortAnnouncements(visible) });
    } catch (err) {
      console.warn('Announcement list unavailable', err.message);
      return res.status(503).json({ success: false, message: '公告服務暫時無法使用' });
    }
  });
  router.get('/announcements/:id', async (req, res) => {
    const id = String(req.params.id || '');
    if (!validId(id)) return res.status(400).json({ success: false, message: '公告 ID 格式不正確' });
    try {
      const row = await findById(id);
      if (!row || row.status !== 'published' || (row.expires_at && Date.parse(row.expires_at) <= Date.now())) {
        return res.status(404).json({ success: false, message: '找不到公告' });
      }
      return res.json({ success: true, announcement: row });
    } catch (err) {
      console.warn('Announcement lookup unavailable', err.message);
      return res.status(503).json({ success: false, message: '公告服務暫時無法使用' });
    }
  });
  router.post('/announcements/:id/read', requireUser, async (req, res) => {
    const id = String(req.params.id || '');
    if (!validId(id)) return res.status(400).json({ success: false, message: '公告 ID 格式不正確' });
    try {
      const announcement = await findById(id);
      if (!announcement || announcement.status !== 'published' || (announcement.expires_at && Date.parse(announcement.expires_at) <= Date.now())) {
        return res.status(404).json({ success: false, message: '找不到公告' });
      }
      const userId = String(req.announcementUser.user_id);
      const readId = crypto.createHash('sha256').update(userId + ':' + id).digest('hex');
      try {
        const inserted = await store.dbCall('db.insert', {
          table: READ_TABLE, primary_key: 'read_id',
          data: { read_id: readId, announcement_id: id, user_id: userId, read_at: nowIso() }
        });
        if (inserted?.inserted === true) return res.status(201).json({ success: true, already_read: false });
      } catch (err) {
        if (!String(err.message).includes('DB_DUPLICATE_KEY')) throw err;
      }
      const existing = await store.dbCall('db.select', { table: READ_TABLE, where: { read_id: readId }, limit: 1 });
      if ((existing?.rows || []).some(row => row.read_id === readId)) return res.json({ success: true, already_read: true });
      throw new Error('ANNOUNCEMENT_READ_UNCONFIRMED');
    } catch (err) {
      console.warn('Announcement read receipt unavailable', err.message);
      return res.status(503).json({ success: false, message: '閱讀紀錄暫時無法儲存' });
    }
  });

  // Render Cron Job entry point. Configure a secret of at least 32 characters and
  // invoke this route on a schedule (for example once per minute). No browser session
  // or public endpoint can trigger scheduled publishing.
  router.post('/internal/announcements/publish-due', async (req, res) => {
    const expected = process.env.ANNOUNCEMENTS_CRON_SECRET || '';
    const supplied = String(req.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const expectedBuffer = Buffer.from(expected);
    const suppliedBuffer = Buffer.from(supplied);
    if (expectedBuffer.length < 32 || expectedBuffer.length !== suppliedBuffer.length ||
        !crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)) {
      return res.status(401).json({ success: false, message: '未授權的排程請求' });
    }
    try {
      const [scheduled, published] = await Promise.all([
        selectByStatus('scheduled'),
        selectByStatus('published')
      ]);
      const now = Date.now();
      const updated = [];
      for (const row of scheduled) {
        if (!row.scheduled_at || Date.parse(row.scheduled_at) > now) continue;
        if (row.expires_at && Date.parse(row.expires_at) <= now) {
          await update(row.announcement_id, { status: 'archived', archived_at: nowIso(), updated_at: nowIso() });
        } else {
          const publishedAt = new Date(row.scheduled_at).toISOString();
          await update(row.announcement_id, { status: 'published', published_at: publishedAt, scheduled_at: '', updated_at: nowIso() });
        }
        updated.push(row.announcement_id);
      }
      // Also archive announcements that were published earlier and have since expired.
      for (const row of published) {
        const expiry = Date.parse(row.expires_at);
        if (!row.expires_at || !Number.isFinite(expiry) || expiry > now) continue;
        await update(row.announcement_id, { status: 'archived', archived_at: nowIso(), updated_at: nowIso() });
        updated.push(row.announcement_id);
      }
      return res.json({ success: true, processed: updated.length, announcement_ids: updated });
    } catch (err) {
      console.warn('Announcement schedule worker failed', err.message);
      return res.status(503).json({ success: false, message: '公告排程處理失敗' });
    }
  });

  const admin = express.Router();
  admin.use(requireUser, requireSuperAdmin);
  admin.get('/', async (req, res) => {
    try {
      const groups = await Promise.all(STATUSES.map(selectByStatus));
      const rows = groups.flat().filter(row => row.status !== 'deleted' || req.query.include_trash === 'true');
      return res.json({ success: true, announcements: sortAnnouncements(rows) });
    } catch (err) {
      console.warn('Admin announcement list unavailable', err.message);
      return res.status(503).json({ success: false, message: '公告清單暫時無法讀取' });
    }
  });
  admin.get('/:id', async (req, res) => {
    const id = String(req.params.id || '');
    if (!validId(id)) return res.status(400).json({ success: false, message: '公告 ID 格式不正確' });
    try {
      const row = await findById(id);
      if (!row) return res.status(404).json({ success: false, message: '找不到公告' });
      return res.json({ success: true, announcement: row });
    } catch (err) {
      console.warn('Admin announcement lookup unavailable', err.message);
      return res.status(503).json({ success: false, message: '公告資料暫時無法讀取' });
    }
  });
  admin.post('/', async (req, res) => {
    try {
      const fields = validateInput(req.body);
      const now = nowIso();
      const scheduled = fields.scheduled_at && Date.parse(fields.scheduled_at) > Date.now();
      const status = fields.published_at ? 'published' : (scheduled ? 'scheduled' : 'draft');
      const id = crypto.randomUUID();
      const record = {
        announcement_id: id, title: fields.title, content: fields.content,
        category: fields.category, priority: fields.priority, status,
        created_by_user_id: String(req.announcementUser.user_id),
        updated_by_user_id: String(req.announcementUser.user_id),
        created_at: now, updated_at: now,
        published_at: status === 'published' ? (fields.published_at || now) : '',
        scheduled_at: fields.scheduled_at || '', expires_at: fields.expires_at || '',
        archived_at: '', deleted_at: ''
      };
      const result = await store.dbCall('db.insert', { table: TABLE, primary_key: 'announcement_id', data: record });
      if (result?.inserted !== true || result?.record?.announcement_id !== id) {
        return res.status(503).json({ success: false, message: '公告尚未確認儲存成功' });
      }
      return res.status(201).json({ success: true, announcement: safeRecord(record) });
    } catch (err) {
      const status = err.status || (String(err.message).includes('DB_DUPLICATE_KEY') ? 409 : 503);
      if (status >= 500) console.warn('Announcement create unavailable', err.message);
      return res.status(status).json({ success: false, message: status === 503 ? '公告資料服務暫時無法使用，未確認儲存成功' : err.message });
    }
  });
  admin.put('/:id', async (req, res) => {
    const id = String(req.params.id || '');
    if (!validId(id)) return res.status(400).json({ success: false, message: '公告 ID 格式不正確' });
    try {
      const current = await findById(id);
      if (!current || current.status === 'deleted') return res.status(404).json({ success: false, message: '找不到可編輯的公告' });
      const fields = validateInput(req.body, true);
      const requestedStatus = req.body?.status;
      if (requestedStatus !== undefined && requestedStatus !== 'draft') {
        return res.status(400).json({ success: false, message: '不允許直接設定此公告狀態' });
      }
      const data = { ...fields, updated_at: nowIso() };
      if (requestedStatus === 'draft') {
        data.status = 'draft'; data.published_at = ''; data.scheduled_at = '';
      } else if (current.status === 'published' && fields.scheduled_at && Date.parse(fields.scheduled_at) > Date.now()) {
        data.status = 'scheduled'; data.published_at = '';
      } else if (fields.scheduled_at !== undefined && fields.scheduled_at && Date.parse(fields.scheduled_at) > Date.now()) {
        data.status = 'scheduled';
      } else if (fields.scheduled_at !== undefined && !fields.scheduled_at && current.status === 'scheduled') {
        data.status = 'draft';
      }
      await update(id, data);
      return res.json({ success: true, announcement: { ...current, ...data } });
    } catch (err) {
      const status = err.status || 503;
      if (status >= 500) console.warn('Announcement update unavailable', err.message);
      return res.status(status).json({ success: false, message: status === 503 ? '公告資料服務暫時無法更新' : err.message });
    }
  });
  admin.post('/:id/publish', async (req, res) => {
    const id = String(req.params.id || '');
    if (!validId(id)) return res.status(400).json({ success: false, message: '公告 ID 格式不正確' });
    try {
      const row = await findById(id);
      if (!row || row.status === 'deleted') return res.status(404).json({ success: false, message: '找不到可發布的公告' });
      const now = nowIso();
      await update(id, { status: 'published', published_at: now, scheduled_at: '', updated_at: now });
      return res.json({ success: true, status: 'published' });
    } catch (err) {
      console.warn('Announcement publish unavailable', err.message);
      return res.status(503).json({ success: false, message: '公告發布狀態更新失敗' });
    }
  });
  admin.post('/:id/unpublish', async (req, res) => {
    const id = String(req.params.id || '');
    if (!validId(id)) return res.status(400).json({ success: false, message: '公告 ID 格式不正確' });
    try {
      const row = await findById(id);
      if (!row || row.status !== 'published') return res.status(404).json({ success: false, message: '找不到已發布公告' });
      const now = nowIso();
      await update(id, { status: 'archived', archived_at: now, updated_at: now });
      return res.json({ success: true, status: 'archived' });
    } catch (err) {
      console.warn('Announcement unpublish unavailable', err.message);
      return res.status(503).json({ success: false, message: '公告下架失敗' });
    }
  });
  admin.post('/:id/restore', async (req, res) => {
    const id = String(req.params.id || '');
    if (!validId(id)) return res.status(400).json({ success: false, message: '公告 ID 格式不正確' });
    try {
      const row = await findById(id);
      if (!row || row.status !== 'deleted') return res.status(404).json({ success: false, message: '找不到回收站公告' });
      const now = nowIso();
      await update(id, { status: 'draft', deleted_at: '', updated_at: now });
      return res.json({ success: true, status: 'draft' });
    } catch (err) {
      console.warn('Announcement restore unavailable', err.message);
      return res.status(503).json({ success: false, message: '公告還原失敗' });
    }
  });
  admin.delete('/:id', async (req, res) => {
    const id = String(req.params.id || '');
    if (!validId(id)) return res.status(400).json({ success: false, message: '公告 ID 格式不正確' });
    try {
      const row = await findById(id);
      if (!row || row.status === 'deleted') return res.status(404).json({ success: false, message: '找不到公告' });
      const now = nowIso();
      await update(id, { status: 'deleted', deleted_at: now, updated_at: now });
      return res.json({ success: true, status: 'deleted', soft_deleted: true });
    } catch (err) {
      console.warn('Announcement recycle unavailable', err.message);
      return res.status(503).json({ success: false, message: '公告移至回收站失敗' });
    }
  });
  router.use('/admin/announcements', admin);
  return router;
}
module.exports = { createAnnouncementRouter, validateInput, safeRecord };
