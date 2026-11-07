# iKey 3.1 device integration checklist

This document records the release gates for real ESP32 device integration.

## Factory registration
- Super administrator assigns a unique device ID at manufacture.
- The device secret must not appear in source control, client-side HTML, logs, or project listing responses.
- Bind a factory-registered device to a project only after server-side authentication, ownership verification, and duplicate-binding checks.
- Support credential rotation and revocation.

## Device settings
- Authorized administrator may change display name, normally locked/open policy, heartbeat interval in minutes, and firmware auto-update permission.
- Each write must be validated server-side and audited. Physical mode changes must not be assumed successful until acknowledged by the device.

## Connection health
- Device heartbeat uses authenticated requests and server timestamps.
- UI distinguishes last seen, online, stale and offline; it must not infer connectivity from cached project data.
- Connection test must return a device acknowledgment rather than just an HTTP response from Render.

## Groups and unlock
- Group membership changes are owner-authorized and auditable.
- One unlock request creates an explicit per-device result, including partial failure.
- Reject replayed or expired commands. Never store unlock passwords in the browser or project snapshots.
- Keep real unlock disabled until hardware test and safety review.

## Release order
1. Deploy and verify the existing Generation 3 Apps Script project and membership/settings database actions.
2. Prepare factory device registry and verified device binding API.
3. Implement authenticated heartbeat and device status.
4. Implement settings and group persistence.
5. Integrate authenticated ESP32 commands and test physical lock behavior.
