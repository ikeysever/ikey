'use strict';

// Staging-only, in-memory device command queue. It never drives hardware and
// never writes commands/results to Google Sheets or any external database.
const crypto = require('node:crypto');

module.exports = function mountDeviceCommandSimulation(app, options = {}) {
  const enabled = options.enabled === true;
  const secret = options.secret || process.env.IKEY_DEVICE_TOKEN_SECRET;
  const authStore = options.authStore;
  const requireProjectUser = options.requireProjectUser;
  const now = options.now || Date.now;
  const commands = new Map();
  const idempotency = new Map();
  const idPattern = /^[A-HJ-NP-Z2-9]{8}$/;
  const terminal = new Set(['succeeded', 'failed', 'timed_out']);

  const disabled = (_req, res) => res.status(404).json({ success: false, code: 'NOT_FOUND' });
  const gate = (req, res, next) => enabled ? next() : disabled(req, res);
  const noStore = (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); };

  function verifyToken(token) {
    if (!secret || Buffer.byteLength(secret, 'utf8') < 32 ||
        typeof token !== 'string' || token.length > 2048) return null;
    const parts = token.split('.');
    if (parts.length !== 2 || !parts[0] || !/^[A-Za-z0-9_-]+$/.test(parts[1])) return null;
    const expected = Buffer.from(crypto.createHmac('sha256', secret).update(parts[0]).digest('base64url'));
    const actual = Buffer.from(parts[1]);
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
    try {
      const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      if (!idPattern.test(payload.sub) || !Number.isSafeInteger(payload.exp) ||
          payload.exp <= now() || payload.exp > now() + 15 * 60 * 1000) return null;
      return payload.sub;
    } catch { return null; }
  }

  async function deviceIdFromRequest(req) {
    const header = req.get('Authorization') || '';
    const id = header.startsWith('Bearer ') ? verifyToken(header.slice(7)) : null;
    if (!id || !authStore || typeof authStore.dbCall !== 'function') return null;
    const result = await authStore.dbCall('db.select', {
      table: 'Devices', where: { device_id: id }, limit: 1
    });
    if (!Array.isArray(result?.rows)) throw new Error('INVALID_DEVICE_LOOKUP');
    const row = result.rows.find(item => item.device_id === id);
    return row && row.status === 'pre_registered' ? id : null;
  }

  function expireCommands() {
    const time = now();
    for (const command of commands.values()) {
      if (!terminal.has(command.status) && time >= command.deadline_at) {
        command.status = 'timed_out';
        command.finished_at = new Date(time).toISOString();
        command.updated_at = command.finished_at;
      }
    }
  }

  function publicCommand(command) {
    return {
      command_id: command.command_id, device_id: command.device_id,
      command: command.command, status: command.status,
      created_at: command.created_at, deadline_at: command.deadline_at,
      claimed_at: command.claimed_at || null, finished_at: command.finished_at || null,
      result: command.result || null
    };
  }

  async function adminOnly(req, res, next) {
    if (typeof requireProjectUser === 'function') {
      return requireProjectUser(req, res, () => {
        if (req.projectUser?.global_role !== 'super_admin')
          return res.status(403).json({ success: false, code: 'FORBIDDEN' });
        next();
      });
    }
    if (!authStore) return res.status(503).json({ success: false, code: 'ADMIN_AUTH_UNAVAILABLE' });
    try {
      const { hashToken, active } = require('./gen3-auth/core');
      const raw = String(req.headers.cookie || '').split(';').map(x => x.trim())
        .find(x => x.startsWith('ikey_gen3_session='))?.slice('ikey_gen3_session='.length);
      if (!raw || raw.length > 256) return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
      const resolved = await authStore.resolveSession(hashToken(raw));
      if (!resolved || resolved.session.revoked_at ||
          Date.parse(resolved.session.expires_at) <= now() || !active(resolved.user))
        return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
      req.projectUser = resolved.user;
      if (req.projectUser.global_role !== 'super_admin')
        return res.status(403).json({ success: false, code: 'FORBIDDEN' });
      next();
    } catch (error) {
      console.warn('Simulated command admin auth unavailable', error.name);
      return res.status(503).json({ success: false, code: 'ADMIN_AUTH_UNAVAILABLE' });
    }
  }

  app.post('/api/device-commands', gate, noStore, adminOnly, async (req, res) => {
    expireCommands();
    const deviceId = req.body?.device_id;
    const commandName = req.body?.command;
    const key = req.get('Idempotency-Key') || req.body?.idempotency_key;
    const timeoutMs = req.body?.timeout_ms === undefined ? 15000 : req.body.timeout_ms;
    if (typeof deviceId !== 'string' || !idPattern.test(deviceId) ||
        commandName !== 'unlock' || typeof key !== 'string' ||
        !/^[A-Za-z0-9._:-]{8,128}$/.test(key) ||
        !Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000)
      return res.status(400).json({ success: false, code: 'INVALID_REQUEST' });

    const origin = req.get('origin');
    if (origin) {
      try {
        const parsed = new URL(origin);
        const protocol = req.secure || req.get('x-forwarded-proto') === 'https' ? 'https:' : 'http:';
        if (parsed.protocol !== protocol || parsed.host !== req.get('host'))
          return res.status(403).json({ success: false, code: 'ORIGIN_REJECTED' });
      } catch { return res.status(403).json({ success: false, code: 'ORIGIN_REJECTED' }); }
    }
    const fingerprint = JSON.stringify({ device_id: deviceId, command: commandName, timeout_ms: timeoutMs });
    const scopedKey = deviceId + ':' + key;
    const priorId = idempotency.get(scopedKey);
    if (priorId) {
      const prior = commands.get(priorId);
      if (prior && prior.fingerprint !== fingerprint)
        return res.status(409).json({ success: false, code: 'IDEMPOTENCY_CONFLICT' });
      if (prior) return res.status(200).json({ success: true, duplicate: true, command: publicCommand(prior) });
    }
    try {
      if (!authStore || typeof authStore.dbCall !== 'function')
        return res.status(503).json({ success: false, code: 'DEVICE_LOOKUP_UNAVAILABLE' });
      const result = await authStore.dbCall('db.select', {
        table: 'Devices', where: { device_id: deviceId }, limit: 1
      });
      if (!Array.isArray(result?.rows))
        return res.status(503).json({ success: false, code: 'DEVICE_LOOKUP_UNAVAILABLE' });
      const device = result.rows.find(item => item.device_id === deviceId);
      if (!device || device.status !== 'pre_registered')
        return res.status(404).json({ success: false, code: 'DEVICE_NOT_REGISTERED' });
    } catch (error) {
      console.warn('Simulated command device lookup failed', error.name);
      return res.status(503).json({ success: false, code: 'DEVICE_LOOKUP_UNAVAILABLE' });
    }

    // Re-check after the async device lookup: concurrent requests may both
    // pass the first idempotency check before either reaches this point.
    const racedId = idempotency.get(scopedKey);
    if (racedId) {
      const raced = commands.get(racedId);
      if (raced && raced.fingerprint !== fingerprint)
        return res.status(409).json({ success: false, code: 'IDEMPOTENCY_CONFLICT' });
      if (raced) return res.status(200).json({ success: true, duplicate: true, command: publicCommand(raced) });
    }

    const time = now();
    const command = {
      command_id: crypto.randomUUID(), device_id: deviceId, command: 'unlock',
      status: 'pending', created_at: new Date(time).toISOString(),
      deadline_at: time + timeoutMs, claimed_at: null, finished_at: null,
      result: null, idempotency_key: key, fingerprint, updated_at: new Date(time).toISOString()
    };
    commands.set(command.command_id, command);
    idempotency.set(scopedKey, command.command_id);
    return res.status(201).json({ success: true, duplicate: false, command: publicCommand(command) });
  });

  app.get('/api/device/commands/next', gate, noStore, async (req, res) => {
    expireCommands();
    try {
      const deviceId = await deviceIdFromRequest(req);
      if (!deviceId) return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
      const command = [...commands.values()]
        .filter(item => item.device_id === deviceId && item.status === 'pending')
        .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
      if (!command) return res.json({ success: true, command: null });
      const time = now();
      command.status = 'claimed';
      command.claimed_at = new Date(time).toISOString();
      command.updated_at = command.claimed_at;
      return res.json({ success: true, command: publicCommand(command) });
    } catch (error) {
      console.warn('Simulated device command poll failed', error.name);
      return res.status(503).json({ success: false, code: 'DEVICE_LOOKUP_UNAVAILABLE' });
    }
  });

  app.post('/api/device/commands/:commandId/result', gate, noStore, async (req, res) => {
    expireCommands();
    try {
      const deviceId = await deviceIdFromRequest(req);
      if (!deviceId) return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
      const command = commands.get(req.params.commandId);
      if (!command || command.device_id !== deviceId)
        return res.status(404).json({ success: false, code: 'COMMAND_NOT_FOUND' });
      const outcome = req.body?.status;
      const detail = typeof req.body?.detail === 'string' ? req.body.detail.slice(0, 240) : '';
      if (!['succeeded', 'failed'].includes(outcome))
        return res.status(400).json({ success: false, code: 'INVALID_RESULT' });
      if (command.status === outcome)
        return res.json({ success: true, duplicate: true, command: publicCommand(command) });
      if (terminal.has(command.status))
        return res.status(409).json({ success: false, code: 'COMMAND_ALREADY_FINISHED', status: command.status });
      if (command.status !== 'claimed')
        return res.status(409).json({ success: false, code: 'COMMAND_NOT_CLAIMED' });
      const time = now();
      command.status = outcome;
      command.result = { status: outcome, detail, reported_at: new Date(time).toISOString() };
      command.finished_at = command.result.reported_at;
      command.updated_at = command.finished_at;
      return res.json({ success: true, duplicate: false, command: publicCommand(command) });
    } catch (error) {
      console.warn('Simulated device result report failed', error.name);
      return res.status(503).json({ success: false, code: 'DEVICE_LOOKUP_UNAVAILABLE' });
    }
  });

  // Super-admin readback for the settings UI; this only reads simulated in-memory state.
  app.get('/api/device-commands/:commandId', gate, noStore, adminOnly, (req, res) => {
    expireCommands();
    const commandId = String(req.params.commandId || '');
    if (!/^[0-9a-f-]{36}$/i.test(commandId))
      return res.status(400).json({ success: false, code: 'INVALID_COMMAND_ID' });
    const command = commands.get(commandId);
    if (!command)
      return res.status(404).json({ success: false, code: 'COMMAND_NOT_FOUND' });
    return res.json({ success: true, command: publicCommand(command) });
  });

  // Test-only introspection is deliberately not mounted as an HTTP route.
  return { commands, idempotency, expireCommands };
};
