'use strict';
const express = require('express');
const path = require('node:path');
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
// Server-side API request timing and per-minute counts; no credentials or payloads logged.
const requestMinuteStats = new Map();
app.use('/api', (req, res, next) => {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
    const minute = Math.floor(Date.now() / 60000);
    const key = minute + ':' + req.method + ':' + req.path.replace(/\\/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '/:id');
    const stat = requestMinuteStats.get(key) || { count: 0, totalMs: 0, maxMs: 0, errors: 0 };
    stat.count++;
    stat.totalMs += elapsedMs;
    stat.maxMs = Math.max(stat.maxMs, elapsedMs);
    if (res.statusCode >= 400) stat.errors++;
    requestMinuteStats.set(key, stat);
    if (elapsedMs >= 3000) console.info('API slow request', req.method, req.path.split('?')[0], res.statusCode, Math.round(elapsedMs) + 'ms');
    for (const [k, v] of requestMinuteStats) {
      if (Number(k.split(':', 1)[0]) >= minute) continue;
      console.info('API minute stats', k, 'count', v.count, 'avg_ms', Math.round(v.totalMs / v.count), 'max_ms', Math.round(v.maxMs), 'errors', v.errors);
      requestMinuteStats.delete(k);
    }
  });
  next();
});

app.get('/ping', (_req, res) => res.status(200).json({ ok: true, service: 'ikey', version: '3.1' }));
app.get('/api/health', (_req, res) => res.status(200).json({ ok: true, service: 'ikey-api', version: '3.1' }));
// Fail closed until the existing Gen3 Apps Script and its schema are verified.
let authStore = null;
try {
  const { createSheetsStore } = require('./gen3-auth/sheets-store');
  authStore = createSheetsStore();
} catch (error) {
  console.warn('Gen3 authentication storage is not configured:', error.message);
}
const { createRouter } = require('./gen3-auth/routes');
app.get('/api/auth/status', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!authStore) return res.json({ ready: false, enabled: false, registration: false, reason: 'CONFIG_MISSING' });
  try {
    const health = await authStore.health();
    const ready = health?.storage === true && health?.version === 'gen3-username-v3';
    return res.json({ ready, enabled: ready, registration: ready, reason: ready ? null : 'SCHEMA_NOT_READY' });
  } catch (_error) {
    return res.json({ ready: false, enabled: false, registration: false, reason: 'STORAGE_UNAVAILABLE' });
  }
});
app.use('/api/auth', createRouter(authStore));
app.use('/api', (_req, res) => res.status(404).json({ ok: false, code: 'NOT_FOUND' }));
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));
app.use((_err, _req, res, _next) => res.status(400).json({ ok: false, code: 'BAD_REQUEST' }));

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => console.log('iKey 3.1 API listening on ' + port));
}
module.exports = app;
