# iKey Gen3 staging GAS dispatcher patch (not deployed)

Source verification: the connected Google Drive document named
`iKey_Gen3_Auth_API程式即時更新` contains a V14 diagnostic candidate.
Its `doPost(e)` checks `GEN3_API_KEY`, builds `payload`, then routes
`db.` actions to `ikeyDbDispatch_`, device actions to
`ikeyFactoryDeviceAction`, project actions to `executeProjectAccess`,
admin actions to `executeAdminAccount`, and others to `execute`.
**The document explicitly says to compare against the actual editor source.**

## Minimal non-destructive integration (after source verification)

Before the existing `const result = action.startsWith('db.')` statement:

```js
const IKEY_PING_ACTIONS = [
  'devicePingCreate','devicePingClaim','devicePingReport','devicePingStatus'
];
```

Replace the initial expression with the ping branch and preserve the
existing remainder, unchanged:

```js
const result = IKEY_PING_ACTIONS.includes(action)
  ? ikeyPingDispatchAuthorized_(action, payload, ikeyPingAuthorization_())
  : action.startsWith('db.')
    ? ikeyDbDispatch_(action, payload)
    // preserve every remaining branch of the existing doPost here
```

Do not paste this illustrative expression verbatim: it is intentionally
incomplete. Integrate into the verified current editor source, not the
older V14 diagnostic candidate.

## Required blockers before activation

1. Review the current GAS factory-device registration and project binding
   implementation. Implement `ikeyPingAuthorization_()` using actual trusted
   project-owner and device-binding checks. Do not substitute a boolean stub.
2. Add the staging GAS files for queue, trust verification, nonce ledger and
   dispatcher to the **same** Apps Script project.
3. Provision `Device_Ping_Commands` and `Device_Ping_Nonces` with the exact
   header schemas in the source. Test on an isolated staging spreadsheet first.
4. Configure the same 32+ byte `IKEY_COMMAND_TRUST_SECRET` in Render and GAS.
   Never place it in GitHub, browser code or ESP32 firmware.
5. Only then activate `IKEY_GAS_PING_ENABLED` with a dedicated staging device.
   Demo device auth is still volatile and not suitable for production unlock.
6. Run create, claim, report, status and replay-denial tests against the
   isolated staging GAS deployment before merging to main.

Current Render production follows `main` with auto-deploy enabled.
Do not merge PR #101 until these blockers are cleared.
