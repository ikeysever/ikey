# GAS command dispatcher integration (staging only)

The repository's gas/ directory does not contain the deployed GEN3 doPost entrypoint.
Do not add a second unauthenticated doPost.

In the existing GEN3 dispatcher, AFTER verifying GEN3_APPS_SCRIPT_KEY and BEFORE
the default unknown-action error, route only these exact actions:
- deviceCommandCreateAtomic
- deviceCommandClaimAtomic
- deviceCommandReportAtomic
- deviceCommandGet

Call ikeyDeviceCommandAction(action, payload). The handler enforces signed
Render assertion, nonce replay check, project permission, device registration
and project-device binding under the script lock.

All four GAS files must be included in the same Apps Script project:
device-command-actions.gs, device-command-trust.gs,
device-command-authorization.gs, and generic-db-engine.gs as applicable.

Keep IKEY_PHYSICAL_UNLOCK_ENABLED and IKEY_GAS_COMMAND_TRUST_VERIFIED disabled.
Do not deploy or change production data until dispatcher source is reviewed,
automated tests pass, and required DeviceCommands, DeviceCommandEvents and
Project_Devices schemas have been verified.
