# iKey ESP32 device authentication — production cutover gate (2026-11-08)

Status: **NOT DEPLOYED**. PR #103 is a draft. No production GAS, Render, main branch, database or physical output has been changed by this integration.

## Already verified
- Existing iKey_Database / Devices schema: device_id, password_hash, status, created_by_user_id, created_at, updated_at.
- Existing device row is pre_registered; no credentials are included in this document.
- Device-auth integration CI and mainline tests passed on PR #103.
- Render production service remains on main with auto-deploy disabled.

## Required sequence
1. Export and archive the **actual currently deployed** Apps Script source and deployment ID. Compare against the repository's gen3-auth/Code.gs; do not overwrite the existing script from GitHub blindly.
2. Merge **only** the read-only deviceAuthFindById_ function and its execute dispatcher case from this branch into the currently deployed GAS source. Keep existing doPost, authentication, database allowlist and project handlers. Review the final diff and redeploy the same GAS web app. Verify the script property GEN3_SPREADSHEET_ID targets the database containing Devices. Do not expose GEN3_API_KEY.
3. Verify GAS action deviceAuthFindById with a known device ID via a protected server-side probe only; never expose the password hash in logs or a browser response. Confirm malformed IDs, duplicate rows and schema mismatch fail closed.
4. Set IKEY_DEVICE_TOKEN_SECRET in the existing Render service using a cryptographically random secret of at least 32 bytes. Keep the value out of GitHub and chat. Do not change IKEY_PHYSICAL_UNLOCK_ENABLED or IKEY_GAS_COMMAND_TRUST_VERIFIED.
5. After successful GAS verification, approve PR #103, merge only this reviewed branch, then deploy the existing Render service intentionally (auto-deploy is off). Verify GET /api/health, POST /api/device/auth and GET /api/device/me; check bad credentials and expired tokens.
6. Only after auth passes, plan a **non-actuating GPIO test** with the device's actual pin map and isolated low-voltage LED. Keep all physical unlock endpoints disabled until separate end-to-end safety review.

## Known limits
- GitHub CI tests mocked storage and cannot prove the deployed GAS is updated.
- This repository commit does not modify an existing live Apps Script deployment.
- Do not merge the old feature/esp32-device-auth-staging branch wholesale: it diverged substantially from main.
- Do not claim website-to-ESP32 control is ready: authenticated command claim/report, web UI authorization, device polling and physical-output safeguards require separate integration and testing.
