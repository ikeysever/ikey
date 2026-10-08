const { record } = require("../lib/ibox/operational-events");
const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
  // Each request is recorded, not just uptime transitions. User-Agent is
  // untrusted, so UptimeRobot identification is only a self-reported hint.
  const claimedUptimeRobot = /uptimerobot/i.test(req.get("user-agent") || "");
  record("health_probe", claimedUptimeRobot
    ? "Health check received (UptimeRobot user-agent; unverified)"
    : "Health check received", { claimedUptimeRobot });
  res.json({
    status: "ok",
    message: "iKey Server 正常運作"
  });
});

module.exports = router;