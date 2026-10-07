const express = require("express");

const router = express.Router();


/*
 * ============================================================
 * Database URL
 * ============================================================
 */

function getDatabaseApiUrl() {

  return process.env.IKEY_DATABASE_API_URL;

}


/*
 * ============================================================
 * Apps Script Request
 * ============================================================
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


  if (!response.ok) {

    throw new Error(
      `Apps Script HTTP ${response.status}: ${text.slice(0, 500)}`
    );

  }


  try {

    return JSON.parse(text);

  } catch (error) {

    const titleMatch =
      text.match(
        /<title[^>]*>(.*?)<\/title>/i
      );


    const bodyText =
      text
        .replace(
          /<script[\s\S]*?<\/script>/gi,
          " "
        )
        .replace(
          /<style[\s\S]*?<\/style>/gi,
          " "
        )
        .replace(
          /<[^>]+>/g,
          " "
        )
        .replace(
          /\s+/g,
          " "
        )
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
 * ============================================================
 * GET Helper
 * ============================================================
 */

async function databaseGet(
  req,
  res,
  action,
  message
) {

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
      action
    );


    const data =
      await appsScriptRequest(
        url.toString()
      );


    if (
      data.success !== true
    ) {

      return res.status(400).json({
        success: false,
        status:
          data.status || "error",
        message:
          data.message ||
          "Database request failed",
        database:
          data
      });

    }


    return res.json({
      success: true,
      status:
        data.status || "ok",
      message:
        message,
      database:
        data
    });


  } catch (error) {

    console.error(
      `Database GET ${action} Error:`,
      error
    );


    return res.status(500).json({
      success: false,
      status: "error",
      message:
        `Failed to read ${action}`
    });

  }

}


/*
 * ============================================================
 * POST Helper
 * ============================================================
 */

async function databasePost(
  req,
  res,
  action,
  payloadKey,
  payload,
  successMessage
) {

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


    const body = {
      action:
        action
    };


    if (payloadKey) {

      body[payloadKey] =
        payload;

    }


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
            JSON.stringify(
              body
            )
        }
      );


    if (
      data.success !== true
    ) {

      return res.status(400).json({
        success: false,
        status:
          data.status || "error",
        message:
          data.message ||
          "Database request failed",
        database:
          data
      });

    }


    return res.json({
      success: true,
      status: "ok",
      message:
        successMessage,
      database:
        data
    });


  } catch (error) {

    console.error(
      `Database POST ${action} Error:`,
      error
    );


    return res.status(500).json({
      success: false,
      status: "error",
      message:
        "Database request failed"
    });

  }

}


/*
 * ============================================================
 * Health
 * ============================================================
 */

router.get(
  "/health",
  async (req, res) => {

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

  }
);


/*
 * ============================================================
 * Users
 * ============================================================
 */

router.get(
  "/users",
  (req, res) =>
    databaseGet(
      req,
      res,
      "users",
      "Users data received"
    )
);


router.post(
  "/users",
  (req, res) =>
    databasePost(
      req,
      res,
      "create_user",
      "user",
      req.body,
      "User created successfully"
    )
);


router.put(
  "/users/:userId",
  (req, res) => {

    const user = {
      ...req.body,
      user_id:
        req.params.userId
    };


    return databasePost(
      req,
      res,
      "update_user",
      "user",
      user,
      "User updated successfully"
    );

  }
);


/*
 * ============================================================
 * Classes
 * ============================================================
 */

router.get(
  "/classes",
  (req, res) =>
    databaseGet(
      req,
      res,
      "classes",
      "Classes data received"
    )
);


router.post(
  "/classes",
  (req, res) =>
    databasePost(
      req,
      res,
      "create_class",
      "class",
      req.body,
      "Class created successfully"
    )
);


router.put(
  "/classes/:classId",
  (req, res) => {

    const classData = {
      ...req.body,
      class_id:
        req.params.classId
    };


    return databasePost(
      req,
      res,
      "update_class",
      "class",
      classData,
      "Class updated successfully"
    );

  }
);


/*
 * ============================================================
 * Classrooms
 * ============================================================
 */

router.get(
  "/classrooms",
  (req, res) =>
    databaseGet(
      req,
      res,
      "classrooms",
      "Classrooms data received"
    )
);


router.post(
  "/classrooms",
  (req, res) =>
    databasePost(
      req,
      res,
      "create_classroom",
      "classroom",
      req.body,
      "Classroom created successfully"
    )
);


router.put(
  "/classrooms/:classroomId",
  (req, res) => {

    const classroom = {
      ...req.body,
      classroom_id:
        req.params.classroomId
    };


    return databasePost(
      req,
      res,
      "update_classroom",
      "classroom",
      classroom,
      "Classroom updated successfully"
    );

  }
);


/*
 * ============================================================
 * Schedules
 * ============================================================
 */

router.get(
  "/schedules",
  (req, res) =>
    databaseGet(
      req,
      res,
      "schedules",
      "Schedules data received"
    )
);


router.post(
  "/schedules",
  (req, res) =>
    databasePost(
      req,
      res,
      "create_schedule",
      "schedule",
      req.body,
      "Schedule created successfully"
    )
);


router.put(
  "/schedules/:scheduleId",
  (req, res) => {

    const schedule = {
      ...req.body,
      schedule_id:
        req.params.scheduleId
    };


    return databasePost(
      req,
      res,
      "update_schedule",
      "schedule",
      schedule,
      "Schedule updated successfully"
    );

  }
);


router.delete(
  "/schedules/:scheduleId",
  (req, res) =>
    databasePost(
      req,
      res,
      "delete_schedule",
      "schedule_id",
      req.params.scheduleId,
      "Schedule deleted successfully"
    )
);


/*
 * ============================================================
 * Slot Status
 * ============================================================
 */

router.get(
  "/slots",
  (req, res) =>
    databaseGet(
      req,
      res,
      "slot_status",
      "Slot status received"
    )
);


router.put(
  "/slots/:slotId",
  (req, res) => {

    const slot = {
      ...req.body,
      slot_id:
        req.params.slotId
    };


    return databasePost(
      req,
      res,
      "set_slot_status",
      "slot",
      slot,
      "Slot status updated successfully"
    );

  }
);


/*
 * ============================================================
 * Borrow Transaction
 * ============================================================
 */

router.post(
  "/borrow",
  (req, res) =>
    databasePost(
      req,
      res,
      "borrow",
      "borrow",
      req.body,
      "Borrow completed successfully"
    )
);


/*
 * ============================================================
 * Borrow Records
 * ============================================================
 */

router.get(
  "/borrow-records",
  (req, res) =>
    databaseGet(
      req,
      res,
      "borrow_records",
      "Borrow records received"
    )
);


router.post(
  "/borrow-records",
  (req, res) =>
    databasePost(
      req,
      res,
      "create_borrow_record",
      "record",
      req.body,
      "Borrow record created successfully"
    )
);


/*
 * ============================================================
 * Devices
 * ============================================================
 */

router.get(
  "/devices",
  (req, res) =>
    databaseGet(
      req,
      res,
      "devices",
      "Devices data received"
    )
);


router.put(
  "/devices/:deviceId",
  (req, res) => {

    const device = {
      ...req.body,
      device_id:
        req.params.deviceId
    };


    return databasePost(
      req,
      res,
      "upsert_device",
      "device",
      device,
      "Device updated successfully"
    );

  }
);


router.post(
  "/devices",
  (req, res) =>
    databasePost(
      req,
      res,
      "upsert_device",
      "device",
      req.body,
      "Device updated successfully"
    )
);


/*
 * ============================================================
 * System Logs
 * ============================================================
 */

router.get(
  "/logs",
  (req, res) =>
    databaseGet(
      req,
      res,
      "system_logs",
      "System logs received"
    )
);


router.post(
  "/logs",
  (req, res) =>
    databasePost(
      req,
      res,
      "create_system_log",
      "log",
      req.body,
      "System log created successfully"
    )
);


/*
 * ============================================================
 * API Information
 * ============================================================
 */

router.get(
  "/",
  (req, res) => {

    return res.json({
      success: true,

      service:
        "iKey Database API",

      endpoints: {

        health:
          "GET /api/database/health",

        users: {
          read:
            "GET /api/database/users",
          create:
            "POST /api/database/users",
          update:
            "PUT /api/database/users/:userId"
        },

        classes: {
          read:
            "GET /api/database/classes",
          create:
            "POST /api/database/classes",
          update:
            "PUT /api/database/classes/:classId"
        },

        classrooms: {
          read:
            "GET /api/database/classrooms",
          create:
            "POST /api/database/classrooms",
          update:
            "PUT /api/database/classrooms/:classroomId"
        },

        schedules: {
          read:
            "GET /api/database/schedules",
          create:
            "POST /api/database/schedules",
          update:
            "PUT /api/database/schedules/:scheduleId",
          delete:
            "DELETE /api/database/schedules/:scheduleId"
        },

        slots: {
          read:
            "GET /api/database/slots",
          update:
            "PUT /api/database/slots/:slotId"
        },

        borrow: {
          create:
            "POST /api/database/borrow"
        },

        borrow_records: {
          read:
            "GET /api/database/borrow-records",
          create:
            "POST /api/database/borrow-records"
        },

        devices: {
          read:
            "GET /api/database/devices",
          upsert:
            "PUT /api/database/devices/:deviceId"
        },

        logs: {
          read:
            "GET /api/database/logs",
          create:
            "POST /api/database/logs"
        }

      }
    });

  }
);


module.exports = router;
