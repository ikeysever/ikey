"use strict";
// Not mounted in server.js. Deliberately fail-closed until the atomic
// Sheets adapter, rate limiting, audit log and sessions are implemented.
const express = require("express");
const router = express.Router();
router.post("/register", (req, res) => {
  res.set("Cache-Control", "no-store");
  return res.status(503).json({
    success: false,
    code: "REGISTRATION_NOT_CONFIGURED",
    message: "註冊服務尚在安全整合中，尚未開放建立帳號"
  });
});
module.exports = router;
