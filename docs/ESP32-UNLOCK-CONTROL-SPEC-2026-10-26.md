# iKey 3.1 — ESP32 Unlock Control Specification

- Date: 2026-10-26
- Scope: staging-only design record; no production deployment authorized.
- Target device: ESP32 board currently used for iKey; exact firmware integration remains to be verified.

## Requested behavior

1. Web super-admin presses and confirms `開鎖測試`.
2. Web creates one uniquely identified `unlock` command.
3. ESP32 authenticates to the command API and claims only commands addressed to its own device ID.
4. ESP32 drives relay control on GPIO 23 using bounded pulses: energized for 500 ms, de-energized for 200 ms per attempt.
5. GPIO 25 is the lock-open feedback input. Sample feedback during each pulse and pause; when a valid open signal is detected, immediately stop pulsing and report `succeeded`.
6. If the lock-open signal is not detected after 10 attempts, force the relay output to its inactive state and report `failed`.
7. Every terminal path must de-energize the relay: success, 10-attempt exhaustion, command deadline, Wi-Fi/API error, reset, and invalid command.
8. Prevent duplicate execution: a command ID may start the physical sequence at most once. A repeated poll/report must not repeat relay pulses.

## Pin assignments

| Pin | Role |
| --- | --- |
| GPIO 23 | Relay control output |
| GPIO 25 | Lock-open feedback input |

## Timing

- Relay energized interval: 500 ms maximum per attempt.
- Inactive pause between attempts: 200 ms.
- Maximum attempts per command: 10.
- Maximum energized time per command: 5,000 ms total, excluding pauses.
- Stop immediately after confirmed open feedback.

## Safety requirements

- Relay active level is not yet confirmed. Do not assume HIGH means energized until verified against the relay module/driver.
- Feedback active level is not yet confirmed. Confirm whether GPIO 25 reads HIGH or LOW when the lock is actually open.
- Verify GPIO 25 electrical compatibility with ESP32 3.3 V GPIO. Never feed 5 V directly into the ESP32 pin.
- Use a suitable transistor/MOSFET or relay driver and appropriate flyback protection for inductive loads; do not power the lock coil from an ESP32 GPIO.
- Hardware-only tests must be performed with the lock power stage isolated where practical. Monitor relay supply stability and coil temperature.
- Fail closed at the software-control level: GPIO 23 must return to the relay's inactive level on boot and on every error path.
- Do not use TLS certificate bypass (`setInsecure`) for an operational device.

## Current backend boundary

- The current `device-command-simulation.js` is an in-memory staging simulator, not a deployed physical-control service.
- The current simulation has authenticated device polling at `GET /api/device/commands/next` and result reporting at `POST /api/device/commands/:commandId/result`.
- A device token and the API host/certificate trust configuration must be provisioned securely before end-to-end Wi-Fi integration can be tested.
- A simulated success must never be presented as proof that the physical lock opened.

## Open items before final firmware

1. Confirm relay active level: HIGH or LOW.
2. Confirm feedback active level: HIGH means open, or LOW means open.
3. Verify GPIO 25 wiring and input bias/pull-up/pull-down against the actual feedback circuit.
4. Establish a staging API host and secure device-token provisioning method; do not point this firmware at production until separately approved.
5. Run a hardware-in-the-loop test that records pulse count, feedback transition, command ID, and terminal report.

## Acceptance criteria

- Feedback becomes open during any attempt: stop further pulses and report `succeeded` once.
- Feedback never becomes open: no more than 10 pulses; force relay inactive and report `failed`.
- Repeated delivery of the same command ID: no second physical sequence.
- API timeout or reset: relay inactive; command is not reported as successful without feedback.
- Production `main`, Render production service, and production database remain unchanged during staging work.