# iKey 3.1 — sequential project feature delivery

## Stage 1 — Create/Join entry
- Create Project remains unchanged.
- Join Project has a separate page and 24-character invite-code input. **Submission disabled until the GAS projectAccessJoin action and Render route are deployed and verified.**
- Source for validated invitation, approval, owner-only invitation generation and projectAccessMine exists on feature/project-visual-design-sync-new11 (PR #63), but has not passed the production GAS release gate.
- Before enabling, deploy GAS Code.gs and project-data.gs, test owner/nonowner, invalid/expired invite, direct vs approval, member list, and session-origin protections.

## Stage 2 — Independent project settings
- Move the overview entirely from project.html into project-settings.html, show project ID/name/description, add owner-only themes/sounds, invitation, display-name-based members and roles. Keep non-owner fields inaccessible.

## Stage 3 — Other settings
- Release PR #72 only after the GAS settings write action is deployed and live readback is verified.

## Stage 4 — Devices
- Add preprovisioned device ID/credential verification, owner-only binding, device list and settings, group assignment; keep physical unlock disabled until authenticated ESP32 gateway is tested.

## Stage 5 — Project homepage
- Show verified role, authorization/booking action, registered device grid, optional password input, and secure backend-validated unlock.

## Release policy
No merging of unverified GAS-dependent write routes to production. No invented device connectivity or success responses. Record each milestone in development history.
