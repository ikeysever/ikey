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
 * Apps Script Request
 * =========================================
 */

async function appsScriptRequest(
  url,
  options = {}
) {

  const response =
    await fetch(
      url,
      {
        ...options,
        redirect: "follow"
      }
    );


  const text =
    await response.text();


  /*
   * HTTP 錯誤
   */

  if (!response.ok) {

    throw new Error(
      `Apps Script HTTP ${response.status}: ${text.slice(0, 300)}`
    );

  }


  /*
   * 嘗試解析 JSON
   */

  try {

    return JSON.parse(
      text
    );

  } catch (error) {

    const titleMatch =
  text.match(/<title[^>]*>(.*?)<\/title>/i);

const bodyText =
  text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

console.error(
  "Apps Script non-JSON TITLE:",
  titleMatch
    ? titleMatch[1]
    : "NO TITLE"
);

console.error(
  "Apps Script non-JSON TEXT:",
  bodyText.slice(0, 1000)
);


    throw new Error(
      "Apps Script returned non-JSON response"
    );

  }

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


    const data =
      await appsScriptRequest(
        databaseApiUrl
      );


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


    const data =
      await appsScriptRequest(
        url.toString()
      );


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
     * Apps Script POST
     */

    const data =
      await appsScriptRequest(
        databaseApiUrl,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "text/plain;charset=utf-8"
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


    /*
     * Apps Script 拒絕
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
     * 建立成功
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
