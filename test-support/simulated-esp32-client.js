'use strict';
// CTRL-001 T03: test-only ESP32 protocol emulator. NEVER actuates hardware.
const TERMINAL = new Set(['succeeded', 'failed', 'timed_out']);
function createSimulatedEsp32({ baseUrl, deviceToken, fetchImpl = fetch, onCommand = async () => true }) {
  if (typeof baseUrl !== 'string' || !/^https?:\/\//.test(baseUrl)) throw Error('INVALID_BASE_URL');
  if (typeof deviceToken !== 'string' || !deviceToken) throw Error('TOKEN_REQUIRED');
  const seen = new Set();
  const auth = { Authorization: 'Bearer ' + deviceToken };
  async function json(path, init = {}) {
    const response = await fetchImpl(baseUrl + path, {
      ...init, headers: { ...auth, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
      redirect: 'error', cache: 'no-store'
    });
    const body = await response.json();
    if (!response.ok || body.success !== true) {
      const error = Error(body.code || 'DEVICE_REQUEST_FAILED');
      error.status = response.status;
      throw error;
    }
    return body;
  }
  async function tick() {
    const next = await json('/api/device/commands/next');
    const command = next.command;
    if (!command) return { state: 'idle' };
    if (command.command !== 'unlock' || command.status !== 'claimed' ||
        !/^[0-9a-f-]{36}$/i.test(command.command_id)) {
      throw Error('UNEXPECTED_COMMAND');
    }
    if (seen.has(command.command_id)) return { state: 'duplicate', command_id: command.command_id };
    // Mark before invoking callback. Network failures must not re-actuate.
    seen.add(command.command_id);
    const deadline = typeof command.deadline_at === 'number'
      ? command.deadline_at : Date.parse(command.deadline_at);
    if (!Number.isFinite(deadline) || Date.now() >= deadline) {
      return { state: 'expired', command_id: command.command_id };
    }
    let ok = false;
    try { ok = await onCommand(Object.freeze({ command_id: command.command_id, device_id: command.device_id })); }
    catch { ok = false; }
    const status = ok === true ? 'succeeded' : 'failed';
    const reported = await json('/api/device/commands/' + encodeURIComponent(command.command_id) + '/result', {
      method: 'POST', body: JSON.stringify({ status, detail: 'test-only emulator: no relay actuation' })
    });
    if (!TERMINAL.has(reported.command?.status)) throw Error('INVALID_RECEIPT');
    return { state: reported.command.status, command_id: command.command_id };
  }
  return Object.freeze({ tick });
}
module.exports = { createSimulatedEsp32 };
