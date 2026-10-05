const express = require("express");

const router = express.Router();


/*
 * =========================================
 * GET /api/database/health
 *
 * Render
 *   ↓
 * Google Apps Script
 *   ↓
 * iKey_Database
 * =========================================
 */

router.get("/health", async (req, res) => {

  try {

    const databaseApiUrl =
      process.env.IKEY_DATABASE_API_URL;


    /*
     * 檢查 Environment Variable
     */

    if (!databaseApiUrl) {

      return res.status(500).json({
        success: false,
        status: "error",
        message:
          "IKEY_DATABASE_API_URL is not configured"
      });

    }


    /*
     * 呼叫 Google Apps Script
     */

    const response =
      await fetch(databaseApiUrl);


    if (!response.ok) {

      return res.status(502).json({
        success: false,
        status: "error",
        message:
          "Google Apps Script request failed",
        http_status:
          response.status
      });

    }


    /*
     * 讀取 Apps Script JSON
     */

    const data =
      await response.json();


    /*
     * 回傳給 iKey
     */

    return res.json({
      success: true,
      status: data.status,
      message:
        "iKey Server connected to database",
      database: data
    });


  } catch (error) {

    console.error(
      "Database Health Error:",
      error
    );


    return res.status(500).json({
      success: false,
      status: "error",
      message:
        "Database connection failed"
    });

  }

});


module.exports = router;
