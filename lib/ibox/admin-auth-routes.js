"use strict";
const express = require("express");
const { COOKIE_NAME, issueSession, cookieOptions, sessionFromRequest } = require("./admin-session");
const router = express.Router();

// Preserve existing POST /api/login payload and response contract.
// Attach a signed cookie only after the existing credential check succeeds.
router.post("/", (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    if (res.statusCode >= 200 && res.statusCode < 300 &&
        body && body.success === true && req.body?.account === "ikey") {
      const token = issueSession("ikey", process.env.IKEY_SESSION_SECRET);
      if (token) res.cookie(COOKIE_NAME, token, cookieOptions(req));
    }
    return originalJson(body);
  };
  next();
});

router.get("/session", (req, res) => {
  res.set("Cache-Control", "no-store");
  const actor = sessionFromRequest(req, process.env.IKEY_SESSION_SECRET);
  if (!actor) return res.status(401).json({ authenticated: false });
  return res.json({ authenticated: true, account: actor.userId, globalRole: actor.globalRole });
});

router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true, sameSite: "strict", secure: cookieOptions(req).secure, path: "/",
  });
  return res.json({ success: true });
});

module.exports = router;
