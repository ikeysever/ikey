const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "iKey Server 正常運作"
  });
});

module.exports = router;