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
    const key = minute + ':' + req.method + ':' + req.path;
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

// Configurable per-minute protection for expensive auth endpoints.
// Process-local limiter: protects this instance, not a distributed global quota.
const apiRateBuckets = new Map();
const apiRateDefaults = {
  'POST /auth/login': 30,
  'POST /auth/register': 10,
  'POST /auth/prefetch': 30,
  'GET /auth/status': 120,
  'GET /auth/me': 120
};
const configuredLimit = (route, fallback) => {
  const name = 'IKEY_RPM_' + route.replace(/[^A-Z0-9]/gi, '_').toUpperCase();
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number(raw);
  return Number.isSafeInteger(value) && value >= 1 && value <= 10000 ? value : fallback;
};
app.use('/api', (req, res, next) => {
  const route = req.method + ' ' + req.path;
  const fallback = apiRateDefaults[route];
  if (!fallback) return next();
  const limit = configuredLimit(route, fallback);
  const now = Date.now();
  const windowMs = 60000;
  // req.ip is the connection IP, not a user-supplied forwarded header.
  const key = req.ip + '|' + route;
  let bucket = apiRateBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    apiRateBuckets.set(key, bucket);
  }
  const remaining = Math.max(0, limit - bucket.count - 1);
  const waitSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  res.set('X-RateLimit-Limit', String(limit));
  res.set('X-RateLimit-Remaining', String(remaining));
  if (bucket.count >= limit) {
    res.set('Retry-After', String(waitSeconds));
    console.warn('API rate limited', route, 'retry_after_s', waitSeconds);
    return res.status(429).json({ success: false, code: 'RATE_LIMITED', message: '請求太頻繁，請稍後再試', retry_after_seconds: waitSeconds });
  }
  bucket.count++;
  if (apiRateBuckets.size > 5000) {
    for (const [k, v] of apiRateBuckets) if (v.resetAt <= now) apiRateBuckets.delete(k);
  }
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
