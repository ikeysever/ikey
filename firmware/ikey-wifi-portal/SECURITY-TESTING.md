# iBOX Wi-Fi Portal V2 — security release candidate

## Scope
ESP32 Arduino Core 3.x, ArduinoJson 7.x. **Serial-only testing; no physical lock GPIO is driven.** No changes to the iKey backend, Render deployment, or main branch.

## Before flashing
1. Configure unique `DEVICE_ID`, `DEVICE_PASSWORD` (never commit real credentials).
2. Replace `SETUP_AP_PASSWORD` placeholder with a **unique random 12+ character password** for this specific iBOX. Do not reuse across devices.
3. Use ESP32 Dev Module board target and ArduinoJson 7.x.
4. Check the ESP32 has enough flash and the BOOT button is on GPIO0.
5. The firmware uses ISRG Root X1 to validate the TLS chain for `ikey.onrender.com`. This CA is **not guaranteed** to be the one used by Render at the time of testing. A TLS failure must block device login; do **not** add `setInsecure()` as a workaround.

## Validation checklist
- [ ] GitHub Actions compile passes for the selected ESP32 board
- [ ] First boot (no saved Wi-Fi) opens iKey-Setup-XXXX with unique password
- [ ] Wrong AP password cannot connect
- [ ] Phone opens http://192.168.4.1 while connected to AP
- [ ] Incorrect Wi-Fi credentials are rejected and not persisted
- [ ] Correct 2.4 GHz Wi-Fi + reachable backend persists settings
- [ ] ESP32 power cycle reconnects without provisioning
- [ ] BOOT held 5 seconds while running opens provisioning; normal polling pauses
- [ ] Setup timeout closes AP; on unprovisioned device BOOT can reopen it
- [ ] Five failed submissions are blocked
- [ ] Serial-only command prints TEST_UNLOCK_SUCCESS and reports success
- [ ] DNS/TLS failure prevents login and command polling
- [ ] Expired/invalid device credentials fail closed
- [ ] Repeated power cycles and Wi-Fi disconnects recover correctly

## Remaining production gates
- Enable and validate ESP32 secure boot, flash encryption and encrypted NVS in a hardware-specific provisioning process. These are NOT enabled by this sketch.
- Verify backend authorization, replay protection, audit trails, token lifetimes and revocation.
- Verify Render's actual certificate chain and establish a safe CA update/rotation plan.
- Protect physical access to BOOT, USB, UART, and lock wiring; add tamper controls.
- Review local provisioning threats, including HTTP on SoftAP, Wi-Fi AP impersonation and denial-of-service.
- Hardware-in-the-loop testing and explicit approval are required before controlling a physical lock.
