"use strict";

const crypto = require("node:crypto");

const COOKIE_NAME = "ikey_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const SUPERADMIN_ACCOUNT = "ikey";

function getServerRole(account) {
  return account === SUPERADMIN_ACCOUNT ? "superadmin" : null;
}

function sign(value, secret) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function issueSession(account, secret, now = Date.now()) {
  if (typeof secret !== "string" || secret.length < 32 ||
      getServerRole(account) !== "superadmin") return null;
  const payload = Buffer.from(JSON.stringify({
    sub: account, iat: now, exp: now + SESSION_TTL_MS,
  })).toString("base64url");
  return payload + "." + sign(payload, secret);
}

function verifySession(token, secret, now = Date.now()) {
  if (typeof token !== "string" || typeof secret !== "string" ||
      secret.length < 32 || token.length > 2048) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const expected = sign(parts[0], secret);
  const actual = parts[1];
  if (actual.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (data.sub !== SUPERADMIN_ACCOUNT ||
        !Number.isSafeInteger(data.iat) || !Number.isSafeInteger(data.exp) ||
        data.iat > now || data.exp <= now ||
        data.exp - data.iat !== SESSION_TTL_MS) return null;
    return Object.freeze({ userId: data.sub, globalRole: getServerRole(data.sub) });
  } catch {
    return null;
  }
}

function cookieOptions(req) {
  return {
    httpOnly: true,
    secure: req.secure || req.get("x-forwarded-proto") === "https",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_MS,
  };
}

function sessionFromRequest(req, secret) {
  const cookies = String(req.headers.cookie || "").split(";");
  const entry = cookies.map(part => part.trim()).find(part => part.startsWith(COOKIE_NAME + "="));
  if (!entry) return null;
  return verifySession(entry.slice(COOKIE_NAME.length + 1), secret);
}

module.exports = {
  COOKIE_NAME, SESSION_TTL_MS, getServerRole, issueSession, verifySession,
  cookieOptions, sessionFromRequest,
};
