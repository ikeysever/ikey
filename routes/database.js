const express = require("express");

const router = express.Router();


/*
 * =========================================
 * Database API URL
 * =========================================
 */

function getDatabaseApiUrl() {

  return process.env.IKEY_DATABASE_API_URL;

}


/*
 * =========================================
 * GET /api/database/health
 * =========================================
 */

router.get("/health", async (req, res) => {

  try {

    const databaseApiUrl =
      getDatabaseApiUrl();


    if (!databaseApiUrl) {

      return res.status(500).json({
        success: false,
        status: "error",
        message:
          "IKEY_DATABASE_API_URL is not configured"
      });

    }


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


    const data =
      await response.json();


    return res.json({
      success: true,
      status:
        data.status,
      message:
        "iKey Server connected to database",
      database:
        data
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


/*
 * =========================================
 * GET /api/database/users
 *
 * Render
 *   ↓
 * Apps Script ?action=users
 *   ↓
 * Users Sheet
 * =========================================
 */

router.get("/users", async (req, res) => {

  try {

    const databaseApiUrl =
      getDatabaseApiUrl();


    if (!databaseApiUrl) {

      return res.status(500).json({
        success: false,
        status: "error",
        message:
          "IKEY_DATABASE_API_URL is not configured"
      });

    }


    /*
     * 建立 Apps Script Users API URL
     */

    const url =
      new URL(
        databaseApiUrl
      );

    url.searchParams.set(
      "action",
      "users"
    );


    /*
     * 呼叫 Apps Script
     */

    const response =
      await fetch(
        url.toString()
      );


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
     * Apps Script JSON
     */

    const data =
      await response.json();


    /*
     * 回傳結果
     */

    return res.json({
      success:
        data.success === true,

      status:
        data.status || "unknown",

      message:
        "Users data received",

      database:
        data
    });


  } catch (error) {

    console.error(
      "Database Users Error:",
      error
    );


    return res.status(500).json({
      success: false,
      status: "error",
      message:
        "Failed to read Users data"
    });

  }

});


module.exports = router;
