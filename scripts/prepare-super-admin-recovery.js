"use strict";
// One-time, operator-run recovery helper. NOT a web endpoint.
// Run: node scripts/prepare-super-admin-recovery.js
// Requires an authenticated Supabase project owner to execute the generated SQL.
const fs = require("node:fs");
const path = require("node:path");
const { passwordHash, passwordVerify } = require("../gen3-auth/core");

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error("Interactive terminal required; refusing noninteractive password input.");
  process.exit(1);
}
process.stdout.write("Enter a NEW temporary password (8-128 chars; input hidden): ");
let password = "";
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding("utf8");
process.stdin.on("data", function onData(key) {
  if (key === "\u0003") { process.stdout.write("\nCancelled.\n"); process.exit(130); }
  if (key === "\r" || key === "\n") {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdout.write("\n");
    if (password.length < 8 || password.length > 128) {
      console.error("Password must be 8-128 characters.");
      process.exitCode = 1;
      return;
    }
    const hash = passwordHash(password);
    if (!passwordVerify(password, hash)) {
      console.error("Password verification failed.");
      process.exitCode = 1;
      return;
    }
    password = "";
    // Explicit operator review required. Never execute SQL automatically.
    const sql = [
      "-- Review the target project and account before running in Supabase SQL Editor.",
      "-- Only applies to the existing ikey super_admin account.",
      "-- Do not paste this file into GitHub or share its contents.",
      "BEGIN;",
      "DO $$ BEGIN",
      " IF (SELECT count(*) FROM public.gen3_users WHERE username = 'ikey' AND global_role = 'super_admin') <> 1 THEN",
      "  RAISE EXCEPTION 'Expected exactly one ikey super_admin account';",
      " END IF;",
      "END $$;",
      "UPDATE public.gen3_users SET",
      " password_hash = '" + hash + "',",
      " account_status = 'active',",
      " failed_login_attempts = '0',",
      " locked_until = '',",
      " updated_at = now()::text",
      "WHERE username = 'ikey' AND global_role = 'super_admin'",
      "RETURNING username, global_role, account_status;",
      "-- Session revocation and audit must be completed using approved admin procedures.",
      "COMMIT;",
      ""
    ].join("\n");
    const output = path.resolve(process.cwd(), "ikey-recovery-PRIVATE.sql");
    fs.writeFileSync(output, sql, { flag: "wx", mode: 0o600 });
    console.log("Prepared local SQL:", output);
    console.log("IMPORTANT: SQL not executed; verify ownership, revoke sessions and audit before use.");
    return;
  }
  if (key === "\u007f" || key === "\b") { password = password.slice(0, -1); return; }
  if (key.length === 1 && key >= " " && password.length < 129) password += key;
});
