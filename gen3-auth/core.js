"use strict";
const crypto = require("node:crypto");

const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const hashToken = token => crypto.createHash("sha256").update(token).digest("hex");
const token = () => crypto.randomBytes(32).toString("base64url");
const nowIso = () => new Date().toISOString();

function passwordHash(password) {
  if (typeof password !== "string" || password.length < 8 || password.length > 128) throw new Error("INVALID_PASSWORD");
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64);
  return "scrypt:v1:" + salt.toString("base64url") + ":" + derived.toString("base64url");
}
function passwordVerify(password, stored) {
  if (typeof password !== "string" || typeof stored !== "string" || !stored.startsWith("scrypt:v1:")) return false;
  const fields = stored.split(":");
  if (fields.length !== 4) return false;
  try {
    const salt = Buffer.from(fields[2], "base64url");
    const expected = Buffer.from(fields[3], "base64url");
    if (salt.length !== 16 || expected.length !== 64) return false;
    const actual = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(actual, expected);
  } catch { return false; }
}
function safeUser(user) {
  return { user_id:user.user_id,username:user.username||"",display_name:user.display_name,
    global_role:user.global_role,account_status:user.account_status };
}
function active(user, at = Date.now()) {
  if (!user || user.account_status === "disabled" || user.account_status === "pending_deletion") return false;
  if (user.account_status === "temporarily_locked" && Date.parse(user.locked_until || "") > at) return false;
  return user.account_status === "active" || user.account_status === "pending_verification" ||
    (user.account_status === "temporarily_locked" && Date.parse(user.locked_until || "") <= at);
}
function newSession(userId, at=Date.now()) {
  const raw = token();
  return { raw, record: { session_id:crypto.randomUUID(),user_id:userId,
    session_token_hash:hashToken(raw),created_at:new Date(at).toISOString(),
    expires_at:new Date(at+SESSION_MS).toISOString(),last_seen_at:new Date(at).toISOString(),
    revoked_at:"",revoked_reason:"" } };
}
module.exports={SESSION_MS,LOCK_MS,hashToken,token,nowIso,
  passwordHash,passwordVerify,safeUser,active,newSession};
