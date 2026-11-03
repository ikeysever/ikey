# iKey mainline 2 isolated simulation PR

This file is a non-production CI verification marker.

- Target branch: `feature/esp32-device-auth-staging`
- Workflow: `.github/workflows/ikey-mainline2-simulation.yml`
- Test command: `node --test tests/device-command-simulation.test.js`
- No Render deployment, Google Apps Script, Google database, or physical lock access.
- Do not merge this PR without explicit project owner approval.

The test workflow uses a mock in-memory device command queue and local HTTP listener.
This marker exists only to create a minimal pull request diff for CI validation.
