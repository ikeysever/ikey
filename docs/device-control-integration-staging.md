# iKey 3.1 Device control integration (staging)
## Existing verified components
- Device bearer auth: POST /api/device/auth and requireDevice middleware.
- Durable tables: device_commands, device_command_events, device_command_nonces.
- Safe non-actuating serial test: /api/serial-test/* and device test claim/report RPC.
- LINE and web share requestProjectUnlock for permission checks, currently returning 503 intentionally.

## Heartbeat candidate
- POST /api/device/heartbeat with device Bearer token and empty JSON body.
- GET /api/projects/:projectId/devices/:deviceId/live with authorized user session.
- 30-second heartbeat, 120-second offline threshold; heartbeat is not proof of physical unlock.
- Deploy only after device_heartbeats schema and access policies are verified.

## Unlock signal integration requirements (not yet implemented)
1. Keep requestProjectUnlock as the single authorization entry for LINE and web; preserve owner/admin and approved schedule checks.
2. Create a unique idempotency key per user operation and persist command in device_commands.
3. Use atomic claim with per-device authentication, single-use claim token and strict expiry; no direct command response to LINE.
4. Device must return signed or authenticated execution receipt, and preferably actual lock-state feedback; never infer physical success from queued or claimed state.
5. Validate atomic claim/report RPC permissions and replay protection against concurrency and redelivery.
6. Publish a single read-only command status API for both web and LINE.
7. Run simulated ESP32 tests: unauthorized, expired, duplicate, retry, offline, concurrency, failed actuation, and feedback mismatch.
8. Keep physical actuation disabled until hardware team validates relay/lock polarity and fail-safe behavior.

No live unlock signal is enabled by this staging change.
