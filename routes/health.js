const express = require("express");

const router = express.Router();

router.get("/ping", (req, res) => {
  res.json({
    status: "ok",
    service: "iKey",
    message: "iKey Server OK"
  });
});

module.exports = router;
