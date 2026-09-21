const express = require("express");
const supabase = require("../config/supabase");

const router = express.Router();

// 透過指紋 ID 查詢使用者
router.get("/fingerprint/:fingerprintId", async (req, res) => {
  try {
    const fingerprintId = Number(req.params.fingerprintId);

    if (!Number.isInteger(fingerprintId) || fingerprintId <= 0) {
      return res.status(400).json({
        status: "error",
        message: "fingerprint_id 無效"
      });
    }

    // ① 先查指紋
    const {
      data: fingerprint,
      error: fingerprintError
    } = await supabase
      .from("fingerprints")
      .select(`
        fingerprint_id,
        finger_type,
        user_id,
        is_active
      `)
      .eq("fingerprint_id", fingerprintId)
      .eq("is_active", true)
      .maybeSingle();

    if (fingerprintError) {
      console.error("Fingerprint query error:", fingerprintError);

      return res.status(500).json({
        status: "error",
        message: "查詢指紋資料失敗"
      });
    }

    if (!fingerprint) {
      return res.status(404).json({
        status: "error",
        message: "找不到此指紋"
      });
    }

    // ② 再用 user_id 查使用者
    const {
      data: user,
      error: userError
    } = await supabase
      .from("users")
      .select(`
        id,
        name,
        role,
        username,
        class_name,
        seat_number,
        student_id,
        is_factory_leader,
        is_active
      `)
      .eq("id", fingerprint.user_id)
      .maybeSingle();

    if (userError) {
      console.error("User query error:", userError);

      return res.status(500).json({
        status: "error",
        message: "查詢使用者資料失敗"
      });
    }

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "找不到此指紋對應的使用者"
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        status: "error",
        message: "此使用者帳號未啟用"
      });
    }

    // ③ 回傳身份資訊
    res.json({
      status: "ok",
      fingerprint: {
        fingerprint_id: fingerprint.fingerprint_id,
        finger_type: fingerprint.finger_type
      },
      user: user
    });

  } catch (error) {
    console.error("Fingerprint API error:", error);

    res.status(500).json({
      status: "error",
      message: "伺服器發生錯誤"
    });
  }
});

module.exports = router;
