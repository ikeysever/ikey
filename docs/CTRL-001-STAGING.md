# CTRL-001 — Super-admin unlock test integration (staging only)

Date: 2026-11-09
Status: implemented on isolated branch; tests not yet executed in this session.

## Reused
- Existing `public/super-admin.html` device settings > 開鎖測試 button.
- Existing authenticated admin and device identity APIs in `server.js`.
- Existing `device-command-simulation.js` and its regression tests from `feature/esp32-device-auth-staging`.

## Changes
- `server.js` mounts an opt-in, in-memory command simulator before the existing fail-closed physical command placeholder.
- Existing button POST `/api/devices/:deviceId/commands` maps to simulation command creation only when enabled.
- UI polls `GET /api/device-commands/:commandId` to show simulated receipt and terminal state.
- Regression suite includes the existing admin button endpoint.

## Local staging only
Use `IKEY_CTRL001_SIMULATION=true` in a non-production environment with existing test-only Gen3 store and device auth configuration. Never set this on Render production. The feature refuses to activate when `NODE_ENV=production`. In-memory commands vanish on restart and are not durable.

Run `npm test` (or `node --test tests/device-command-simulation.test.js`) before any further integration. Test create, claim, result, duplicate, timeout, unauthorized admin, invalid device and no real relay actuation.

## Deliberate exclusions
- No production deployment, main modification, GAS write, or physical unlock.
- No persistence or cross-process queue guarantee.
- No actual ESP32 relay firmware integration.
- No production readiness assertion.

## Next
Execute the regression suite, fix failures, then integrate durable, authorization-scoped command storage and device receipt handling on staging. Only after a separate authorization and safety acceptance should physical hardware testing begin.
