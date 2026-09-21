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

    const { data, error } = await supabase
      .from("fingerprints")
      .select(`
        fingerprint_id,
        finger_type,
        is_active,
        user_id,
        users!inner (
          id,
          name,
          role,
          username,
          class_name,
          seat_number,
          student_id,
          is_factory_leader,
          is_active
        )
      `)
      .eq("fingerprint_id", fingerprintId)
      .eq("is_active", true)
      .eq("users.is_active", true)
      .maybeSingle();

    if (error) {
      console.error("Fingerprint query error:", error);

      return res.status(500).json({
        status: "error",
        message: "查詢指紋資料失敗"
      });
    }

    if (!data) {
      return res.status(404).json({
        status: "error",
        message: "找不到此指紋或使用者帳號未啟用"
      });
    }

    res.json({
      status: "ok",
      fingerprint: {
        fingerprint_id: data.fingerprint_id,
        finger_type: data.finger_type
      },
      user: data.users
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
