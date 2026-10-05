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
      await fetch(
        databaseApiUrl
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


    const data =
      await response.json();


    return res.json({
      success:
        data.success === true,

      status:
        data.status || "unknown",

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


    const url =
      new URL(
        databaseApiUrl
      );


    url.searchParams.set(
      "action",
      "users"
    );


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


    const data =
      await response.json();


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


/*
 * =========================================
 * POST /api/database/users
 * =========================================
 */

router.post("/users", async (req, res) => {

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


    const user =
      req.body;


    /*
     * 基本驗證
     */

    if (
      !user ||
      !user.user_id ||
      !user.identity ||
      !user.name
    ) {

      return res.status(400).json({
        success: false,
        status: "error",
        message:
          "user_id, identity and name are required"
      });

    }


    /*
     * 傳送給 Apps Script
     */

    const response =
      await fetch(
        databaseApiUrl,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              action:
                "create_user",

              user:
                user
            })
        }
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


    const data =
      await response.json();


    /*
     * Apps Script 驗證失敗
     */

    if (
      data.success !== true
    ) {

      return res.status(400).json({
        success: false,
        status:
          data.status || "error",

        message:
          data.message ||
          "Failed to create user",

        database:
          data
      });

    }


    /*
     * 成功
     */

    return res.status(201).json({
      success: true,
      status: "ok",
      message:
        "User created successfully",

      database:
        data
    });


  } catch (error) {

    console.error(
      "Create User Error:",
      error
    );


    return res.status(500).json({
      success: false,
      status: "error",
      message:
        "Failed to create user"
    });

  }

});


module.exports = router;
