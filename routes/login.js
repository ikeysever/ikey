const express = require("express");

const router = express.Router();

// 固定登入帳密
const LOGIN_ACCOUNT = "ikey";
const LOGIN_PASSWORD = "ikey123456";

// POST /api/login
router.post("/", (req, res) => {
  const { account, password } = req.body;

  if (account === LOGIN_ACCOUNT && password === LOGIN_PASSWORD) {
    return res.json({
      success: true,
      message: "登入成功"
    });
  }

  return res.status(401).json({
    success: false,
    message: "帳號或密碼錯誤"
  });
});

module.exports = router;