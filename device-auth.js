'use strict';
// Staging-only device authentication. No actuator commands or DB mutations.
const crypto = require('node:crypto');
const { passwordVerify } = require('./gen3-auth/core');

module.exports = function mountDeviceAuth(app, authStore) {
  const attempts = new Map();
  const ttlMs = 15 * 60 * 1000;
  const secret = process.env.IKEY_DEVICE_TOKEN_SECRET;
  const idPattern = /^[A-HJ-NP-Z2-9]{8}$/;

  function limited(key) {
    const now = Date.now();
    if (attempts.size > 5000) {
      for (const [k, v] of attempts) if (v.until <= now) attempts.delete(k);
    }
    const state = attempts.get(key);
    if (!state || state.until <= now) {
      attempts.set(key, { count: 1, until: now + 60000 });
      return false;
    }
    state.count++;
    return state.count > 5;
  }
  function sign(data) {
    return crypto.createHmac('sha256', secret).update(data).digest('base64url');
  }
  function makeToken(id) {
    const payload = Buffer.from(JSON.stringify({
      sub: id, exp: Date.now() + ttlMs,
      nonce: crypto.randomBytes(16).toString('base64url')
    })).toString('base64url');
    return payload + '.' + sign(payload);
  }
  function validateToken(token) {
    if (!secret || typeof token !== 'string' || token.length > 2048) return null;
    const parts = token.split('.');
    if (parts.length !== 2 || !parts[0] || !/^[A-Za-z0-9_-]+$/.test(parts[1])) return null;
    const expected = Buffer.from(sign(parts[0]));
    const actual = Buffer.from(parts[1]);
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
    try {
      const obj = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      return idPattern.test(obj.sub) && Number.isSafeInteger(obj.exp) &&
        obj.exp > Date.now() && obj.exp <= Date.now() + ttlMs ? obj.sub : null;
    } catch { return null; }
  }
  app.post('/api/device/auth', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!secret || Buffer.byteLength(secret, 'utf8') < 32)
      return res.status(503).json({ success: false, code: 'DEVICE_AUTH_NOT_CONFIGURED' });
    const id = req.body?.device_id;
    const password = req.body?.password;
    if (typeof id !== 'string' || !idPattern.test(id) ||
        typeof password !== 'string' || password.length < 8 || password.length > 128)
      return res.status(400).json({ success: false, code: 'INVALID_REQUEST' });
    if (limited(String(req.ip) + ':' + id))
      return res.status(429).json({ success: false, code: 'RATE_LIMITED' });
    try {
      const result = await authStore.dbCall('db.select', {
        table: 'Devices', where: { device_id: id }, limit: 1
      });
      if (!Array.isArray(result?.rows)) throw new Error('INVALID_DB_RESPONSE');
      const row = result.rows.find(item => item.device_id === id);
      if (!row || row.status !== 'pre_registered' ||
          !passwordVerify(password, row.password_hash))
        return res.status(401).json({ success: false, code: 'INVALID_CREDENTIALS' });
      return res.json({
        success: true, device_id: id, access_token: makeToken(id),
        token_type: 'Bearer', expires_in: ttlMs / 1000
      });
    } catch (err) {
      console.warn('Device auth storage unavailable', err.name);
      return res.status(503).json({ success: false, code: 'DEVICE_AUTH_UNAVAILABLE' });
    }
  });
  require('./device-command-simulation')(app, { enabled: process.env.IKEY_DEVICE_SIMULATION_ENABLED === 'true', authStore });

  app.get('/api/device/me', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!secret || Buffer.byteLength(secret, 'utf8') < 32)
      return res.status(503).json({ success: false, code: 'DEVICE_AUTH_NOT_CONFIGURED' });
    const header = req.get('Authorization') || '';
    const id = header.startsWith('Bearer ') ? validateToken(header.slice(7)) : null;
    if (!id) return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
    try {
      const result = await authStore.dbCall('db.select', {
        table: 'Devices', where: { device_id: id }, limit: 1
      });
      if (!Array.isArray(result?.rows)) throw new Error('INVALID_DB_RESPONSE');
      const row = result.rows.find(item => item.device_id === id);
      if (!row || row.status !== 'pre_registered')
        return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
      return res.json({ success: true, device_id: id, authenticated: true });
    } catch (err) {
      console.warn('Device auth check unavailable', err.name);
      return res.status(503).json({ success: false, code: 'DEVICE_AUTH_UNAVAILABLE' });
    }
  });
};
