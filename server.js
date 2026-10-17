'use strict';
const express = require('express');
const path = require('node:path');
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));

app.get('/ping', (_req, res) => res.status(200).json({ ok: true, service: 'ikey', version: '3.1' }));
app.get('/api/health', (_req, res) => res.status(200).json({ ok: true, service: 'ikey-api', version: '3.1' }));
app.get('/api/auth/status', (_req, res) => res.status(200).json({ ready: false, method: 'ikey-password', reason: 'Auth storage and account rules are not connected yet' }));

// Never pretend registration or login succeeded before authentication is implemented.
for (const route of ['/api/auth/register', '/api/auth/login']) {
  app.post(route, (_req, res) => res.status(501).json({ ok: false, code: 'NOT_IMPLEMENTED', message: '帳號功能尚未啟用' }));
}
app.use('/api', (_req, res) => res.status(404).json({ ok: false, code: 'NOT_FOUND' }));
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));
app.use((_err, _req, res, _next) => res.status(400).json({ ok: false, code: 'BAD_REQUEST' }));

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => console.log('iKey 3.1 API listening on ' + port));
}
module.exports = app;
