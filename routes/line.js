const express = require("express");
const crypto = require("crypto");
const deviceRoutes = require("./device");

const router = express.Router();


/*
 * ============================================================
 * LINE Configuration
 * ============================================================
 */

function getChannelSecret() {
  return String(
    process.env.LINE_CHANNEL_SECRET || ""
  ).trim();
}


function getChannelAccessToken() {
  return String(
    process.env.LINE_CHANNEL_ACCESS_TOKEN || ""
  ).trim();
}


/*
 * ============================================================
 * Signature Verification
 * ============================================================
 */

function verifyLineSignature(
  rawBody,
  signature
) {

  const channelSecret =
    getChannelSecret();


  if (
    !channelSecret ||
    !signature ||
    !Buffer.isBuffer(rawBody)
  ) {
    return false;
  }


  const expectedSignature =
    crypto
      .createHmac(
        "sha256",
        channelSecret
      )
      .update(rawBody)
      .digest("base64");


  const expectedBuffer =
    Buffer.from(
      expectedSignature,
      "utf8"
    );

  const receivedBuffer =
    Buffer.from(
      String(signature),
      "utf8"
    );


  if (
    expectedBuffer.length !==
    receivedBuffer.length
  ) {
    return false;
  }


  return crypto.timingSafeEqual(
    expectedBuffer,
    receivedBuffer
  );

}


/*
 * ============================================================
 * LINE Reply
 * ============================================================
 */

async function replyMessages(
  replyToken,
  messages
) {

  const channelAccessToken =
    getChannelAccessToken();


  if (!channelAccessToken) {
    throw new Error(
      "LINE_CHANNEL_ACCESS_TOKEN is not configured"
    );
  }


  const response =
    await fetch(
      "https://api.line.me/v2/bot/message/reply",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          "Authorization":
            `Bearer ${channelAccessToken}`
        },
        body: JSON.stringify({
          replyToken: replyToken,
          messages: messages
        })
      }
    );


  if (!response.ok) {

    const responseText =
      await response.text();

    throw new Error(
      `LINE Reply API HTTP ${response.status}: ${responseText.slice(0, 500)}`
    );

  }

}


async function replyText(
  replyToken,
  text
) {

  return replyMessages(
    replyToken,
    [
      {
        type: "text",
        text: text
      }
    ]
  );

}


function createAccountManagementFlex(
  user = null,
  classData = null
) {

  const isLoggedIn =
    Boolean(
      user &&
      String(
        user.user_id ||
        ""
      ).trim()
    );


  const isStudent =
    isLoggedIn &&
    String(
      user.identity ||
      ""
    ).toLowerCase() ===
      "student";


  const detailText =
    !isLoggedIn
      ? "請先確認是否已在 iKey 指紋辨識器完成註冊"
      : isStudent
        ? [
            `目前登入：${user.name || "未設定姓名"}`,
            `學生｜${classData ? getClassLabel(classData) : String(user.class_id || "")}｜${getStudentSeat(user) || "未設定座號"}號`
          ].join("\n")
        : [
            `目前登入：${user.name || "未設定姓名"}`,
            `老師｜${getTeacherNumber(user) || "未設定老師序號"}`
          ].join("\n");


  const buttons =
    isLoggedIn
      ? [
          {
            type: "button",
            style: "primary",
            height: "sm",
            color: "#2eb8d0",
            action:
              createPostbackAction(
                "更新資料",
                {
                  action:
                    "update_data"
                }
              )
          },
          {
            type: "button",
            style: "primary",
            height: "sm",
            color: "#1b3150",
            action:
              createPostbackAction(
                "登出",
                {
                  action:
                    "logout"
                }
              )
          }
        ]
      : [
          {
            type: "button",
            style: "primary",
            height: "sm",
            color: "#2eb8d0",
            action:
              createPostbackAction(
                "開始",
                {
                  action:
                    "fingerprint_check"
                }
              )
          }
        ];


  return {
    type: "flex",
    altText:
      isLoggedIn
        ? "iKey 帳號管理：目前已登入"
        : "iKey 帳號管理",
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#0b1220",
        paddingAll: "24px",
        contents: [
          {
            type: "text",
            text: "iKey",
            size: "sm",
            weight: "bold",
            color: "#63d8e8"
          },
          {
            type: "text",
            text: "帳號管理",
            size: "xl",
            weight: "bold",
            color: "#f8fafc",
            margin: "md"
          },
          {
            type: "text",
            text: detailText,
            size: "md",
            color: "#a6b2c5",
            wrap: true,
            margin: "sm"
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        backgroundColor: "#0b1220",
        paddingAll: "20px",
        paddingTop: "0px",
        contents:
          buttons
      }
    }
  };

}


function createPostbackAction(
  label,
  params,
  options = {}
) {

  const action = {
    type: "postback",
    label: String(label).slice(0, 40),
    data:
      new URLSearchParams(
        params
      ).toString(),
    displayText:
      String(
        options.displayText ||
        label
      ).slice(0, 300)
  };


  if (options.inputOption) {
    action.inputOption =
      options.inputOption;
  }


  if (
    options.fillInText !==
    undefined
  ) {
    action.fillInText =
      String(
        options.fillInText
      ).slice(0, 300);
  }


  return action;

}


function createIdentitySelectionFlex() {

  return {
    type: "flex",
    altText:
      "iKey 登入：請選擇您的身分",
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#0b1220",
        paddingAll: "24px",
        contents: [
          {
            type: "text",
            text: "iKey",
            size: "sm",
            weight: "bold",
            color: "#63d8e8"
          },
          {
            type: "text",
            text: "登入",
            size: "xl",
            weight: "bold",
            color: "#f8fafc",
            margin: "md"
          },
          {
            type: "text",
            text: "請選擇您的身分",
            size: "md",
            color: "#a6b2c5",
            wrap: true,
            margin: "sm"
          }
        ]
      },
      footer: {
        type: "box",
        layout: "horizontal",
        spacing: "md",
        backgroundColor: "#0b1220",
        paddingAll: "20px",
        paddingTop: "0px",
        contents: [
          {
            type: "button",
            style: "primary",
            height: "sm",
            color: "#2eb8d0",
            action:
              createPostbackAction(
                "學生",
                {
                  action:
                    "login_identity",
                  identity:
                    "student"
                }
              )
          },
          {
            type: "button",
            style: "primary",
            height: "sm",
            color: "#1b3150",
            action:
              createPostbackAction(
                "老師",
                {
                  action:
                    "login_identity",
                  identity:
                    "teacher"
                }
              )
          }
        ]
      }
    }
  };

}


function getDatabaseApiUrl() {

  return String(
    process.env.IKEY_DATABASE_API_URL ||
    ""
  ).trim();

}


async function appsScriptRequest(
  url,
  options = {}
) {

  let response =
    await fetch(
      url,
      {
        ...options,
        redirect: "follow"
      }
    );


  if (
    response.status === 404 &&
    response.url &&
    response.url !== url
  ) {

    let isGoogleContentUrl =
      false;


    try {

      const hostname =
        new URL(
          response.url
        ).hostname;


      isGoogleContentUrl =
        hostname ===
          "script.googleusercontent.com" ||
        hostname.endsWith(
          ".googleusercontent.com"
        );

    } catch (error) {

      isGoogleContentUrl =
        false;

    }


    if (isGoogleContentUrl) {

      console.warn(
        "[LINE] Apps Script ContentService returned 404; retrying final response URL after 3 seconds"
      );


      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            3000
          )
      );


      response =
        await fetch(
          response.url,
          {
            method: "GET",
            redirect: "follow"
          }
        );

    }

  }


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

    throw new Error(
      "Apps Script returned non-JSON response"
    );

  }

}


async function databaseReadCollection(
  action,
  key
) {

  const databaseApiUrl =
    getDatabaseApiUrl();


  if (!databaseApiUrl) {

    throw new Error(
      "IKEY_DATABASE_API_URL is not configured"
    );

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


  if (data.success !== true) {

    throw new Error(
      data.message ||
      `Database read failed: ${action}`
    );

  }


  const collection =
    data[key] ||
    (
      data.data &&
      data.data[key]
    );


  if (!Array.isArray(collection)) {

    throw new Error(
      `Database collection missing: ${key}`
    );

  }


  return collection;

}


async function databaseHealthCheck() {

  const databaseApiUrl =
    getDatabaseApiUrl();


  if (!databaseApiUrl) {

    return {
      online: false,
      status: "error"
    };

  }


  try {

    const data =
      await appsScriptRequest(
        databaseApiUrl
      );


    return {
      online:
        data.success === true,
      status:
        data.status ||
        "unknown"
    };

  } catch (error) {

    console.error(
      "[LINE] database health check failed:",
      error
    );


    return {
      online: false,
      status: "error"
    };

  }

}


async function databaseUpdateUser(
  userId,
  updates
) {

  const databaseApiUrl =
    getDatabaseApiUrl();


  if (!databaseApiUrl) {
    throw new Error(
      "IKEY_DATABASE_API_URL is not configured"
    );
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
          JSON.stringify({
            action:
              "update_user",
            user: {
              ...updates,
              user_id:
                userId
            }
          })
      }
    );


  if (data.success !== true) {
    throw new Error(
      data.message ||
      "User update failed"
    );
  }


  return data;

}


function getLineSourceUserId(
  event
) {

  return String(
    (
      event &&
      event.source &&
      event.source.userId
    ) ||
    ""
  ).trim();

}


function findBoundUser(
  users,
  lineUserId
) {

  if (!lineUserId) {
    return null;
  }


  return (
    users.find(
      (user) =>
        String(
          user.line_user_id ||
          ""
        ).trim() ===
          lineUserId &&
        isRecordEnabled(
          user.enabled
        )
    ) ||
    null
  );

}


async function getBoundUserForEvent(
  event
) {

  const lineUserId =
    getLineSourceUserId(
      event
    );


  if (!lineUserId) {
    return null;
  }


  const users =
    await databaseReadCollection(
      "users",
      "users"
    );


  return findBoundUser(
    users,
    lineUserId
  );

}


async function createAccountManagementForEvent(
  event
) {

  const boundUser =
    await getBoundUserForEvent(
      event
    );


  if (!boundUser) {
    return createFingerprintQuestionFlex();
  }


  let classData =
    null;


  if (
    String(
      boundUser.identity ||
      ""
    ).toLowerCase() ===
      "student"
  ) {

    const classes =
      await databaseReadCollection(
        "classes",
        "classes"
      );


    classData =
      classes.find(
        (item) =>
          String(
            item.class_id ||
            ""
          ) ===
          String(
            boundUser.class_id ||
            ""
          )
      ) ||
      null;

  }


  return createAccountManagementFlex(
    boundUser,
    classData
  );

}


function isRecordEnabled(
  value
) {

  const normalized =
    String(
      value ?? ""
    )
      .trim()
      .toLowerCase();


  return ![
    "false",
    "0",
    "disabled",
    "no"
  ].includes(
    normalized
  );

}


function getStudentSeat(
  user
) {

  const candidates = [
    user.seat_number,
    user.seat_no,
    user.seat,
    user.student_seat
  ];


  const value =
    candidates.find(
      (item) =>
        String(
          item ?? ""
        ).trim() !== ""
    );


  return value === undefined
    ? ""
    : String(value).trim();

}


function getTeacherNumber(
  user
) {

  const candidates = [
    user.teacher_number,
    user.teacher_id,
    user.teacher_serial,
    user.user_id
  ];


  const value =
    candidates.find(
      (item) =>
        String(
          item ?? ""
        ).trim() !== ""
    );


  return value === undefined
    ? ""
    : String(value).trim();

}


function getClassLabel(
  classData
) {

  return String(
    classData.class_name ||
    classData.class_id ||
    "未命名班級"
  ).trim();

}


function chunkItems(
  items,
  size
) {

  const chunks = [];


  for (
    let index = 0;
    index < items.length;
    index += size
  ) {

    chunks.push(
      items.slice(
        index,
        index + size
      )
    );

  }


  return chunks;

}


function createSelectionBubble(
  title,
  subtitle,
  items
) {

  const buttons =
    items.map(
      (item) => ({
        type: "button",
        style: "secondary",
        height: "sm",
        color: "#1b3150",
        margin: "sm",
        adjustMode:
          "shrink-to-fit",
        action:
          item.action
      })
    );


  return {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#0b1220",
      paddingAll: "20px",
      contents: [
        {
          type: "text",
          text: "iKey",
          size: "sm",
          weight: "bold",
          color: "#63d8e8"
        },
        {
          type: "text",
          text: title,
          size: "xl",
          weight: "bold",
          color: "#f8fafc",
          margin: "md",
          wrap: true
        },
        {
          type: "text",
          text: subtitle,
          size: "sm",
          color: "#a6b2c5",
          margin: "sm",
          wrap: true
        },
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          spacing: "sm",
          contents:
            buttons
        }
      ]
    }
  };

}


function createSelectionFlex(
  altText,
  title,
  subtitle,
  items
) {

  if (items.length === 0) {

    return {
      type: "flex",
      altText:
        altText,
      contents:
        createSelectionBubble(
          title,
          "目前沒有可選資料，請確認 iKey 資料庫內容。",
          [
            {
              action:
                createPostbackAction(
                  "返回",
                  {
                    action:
                      "login_restart"
                  }
                )
            }
          ]
        )
    };

  }


  const chunks =
    chunkItems(
      items,
      8
    );


  const bubbles =
    chunks.map(
      (chunk) =>
        createSelectionBubble(
          title,
          subtitle,
          chunk
        )
    );


  return {
    type: "flex",
    altText:
      altText,
    contents:
      bubbles.length === 1
        ? bubbles[0]
        : {
            type: "carousel",
            contents:
              bubbles.slice(
                0,
                12
              )
          }
  };

}


function createStudentClassSelectionFlex(
  classes
) {

  const items =
    classes.map(
      (classData) => ({
        action:
          createPostbackAction(
            getClassLabel(
              classData
            ),
            {
              action:
                "login_student_class",
              class_id:
                String(
                  classData.class_id ||
                  ""
                )
            }
          )
      })
    );


  return createSelectionFlex(
    "iKey 登入：請選擇班級",
    "學生登入",
    "請選擇您的班級",
    items
  );

}


function createStudentSeatSelectionFlex(
  classData,
  students
) {

  const sortedStudents =
    [...students].sort(
      (a, b) => {

        const seatA =
          Number(
            getStudentSeat(a)
          );

        const seatB =
          Number(
            getStudentSeat(b)
          );


        if (
          Number.isFinite(seatA) &&
          Number.isFinite(seatB)
        ) {

          return seatA - seatB;

        }


        return getStudentSeat(a)
          .localeCompare(
            getStudentSeat(b),
            "zh-Hant"
          );

      }
    );


  const items =
    sortedStudents
      .filter(
        (user) =>
          getStudentSeat(
            user
          ) !== ""
      )
      .map(
        (user) => {

          const seat =
            getStudentSeat(
              user
            );


          return {
            action:
              createPostbackAction(
                `${seat} 號`,
                {
                  action:
                    "login_student_user",
                  user_id:
                    String(
                      user.user_id ||
                      ""
                    ),
                  class_id:
                    String(
                      classData.class_id ||
                      ""
                    )
                }
              )
          };

        }
      );


  return createSelectionFlex(
    `iKey 登入：${getClassLabel(classData)} 座號`,
    getClassLabel(
      classData
    ),
    "請選擇您的座號",
    items
  );

}


function createTeacherSelectionFlex(
  teachers
) {

  const sortedTeachers =
    [...teachers].sort(
      (a, b) =>
        getTeacherNumber(a)
          .localeCompare(
            getTeacherNumber(b),
            "zh-Hant"
          )
    );


  const items =
    sortedTeachers
      .filter(
        (user) =>
          getTeacherNumber(
            user
          ) !== ""
      )
      .map(
        (user) => {

          const teacherNumber =
            getTeacherNumber(
              user
            );

          const label =
            user.name
              ? `${teacherNumber}｜${user.name}`
              : teacherNumber;


          return {
            action:
              createPostbackAction(
                label,
                {
                  action:
                    "login_teacher_user",
                  user_id:
                    String(
                      user.user_id ||
                      ""
                    )
                }
              )
          };

        }
      );


  return createSelectionFlex(
    "iKey 登入：請選擇老師序號",
    "老師登入",
    "請選擇您的老師序號",
    items
  );

}


function createIdentityConfirmationFlex(
  user,
  classData
) {

  const isStudent =
    String(
      user.identity ||
      ""
    ).toLowerCase() ===
      "student";


  const detailLines =
    isStudent
      ? [
          `身分：學生`,
          `班級：${classData ? getClassLabel(classData) : String(user.class_id || "")}`,
          `座號：${getStudentSeat(user) || "未設定"}`,
          `姓名：${user.name || "未設定"}`
        ]
      : [
          `身分：老師`,
          `老師序號：${getTeacherNumber(user) || "未設定"}`,
          `姓名：${user.name || "未設定"}`
        ];


  return {
    type: "flex",
    altText:
      "iKey 登入：請確認身分資料",
    quickReply: {
      items:
        createQuickReplyItems([
          createPostbackAction(
            "確認",
            {
              action:
                "login_confirm",
              user_id:
                String(
                  user.user_id ||
                  ""
                )
            }
          ),
          createPostbackAction(
            "取消",
            {
              action:
                "login_cancel"
            }
          ),
          createPostbackAction(
            "重新選擇",
            {
              action:
                "login_restart"
            }
          )
        ])
    },
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#0b1220",
        paddingAll: "24px",
        contents: [
          {
            type: "text",
            text: "iKey",
            size: "sm",
            weight: "bold",
            color: "#63d8e8"
          },
          {
            type: "text",
            text: "確認登入資料",
            size: "xl",
            weight: "bold",
            color: "#f8fafc",
            margin: "md"
          },
          {
            type: "text",
            text:
              detailLines.join(
                "\n"
              ),
            size: "md",
            color: "#dbe5f2",
            wrap: true,
            margin: "lg"
          }
        ]
      },

    }
  };

}


function createIdentityConfirmedFlex(
  user
) {

  return {
    type: "flex",
    altText:
      "iKey LINE 身分資料確認完成",
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#0b1220",
        paddingAll: "24px",
        contents: [
          {
            type: "text",
            text: "iKey",
            size: "sm",
            weight: "bold",
            color: "#63d8e8"
          },
          {
            type: "text",
            text: "身分確認完成",
            size: "xl",
            weight: "bold",
            color: "#7de2b1",
            margin: "md"
          },
          {
            type: "text",
            text:
              user.name
                ? `${user.name}，已完成本階段的身分資料確認。`
                : "已完成本階段的身分資料確認。",
            size: "md",
            color: "#f8fafc",
            wrap: true,
            margin: "lg"
          },
          {
            type: "text",
            text:
              "正式 LINE 帳號綁定尚未寫入資料庫。",
            size: "sm",
            color: "#a6b2c5",
            wrap: true,
            margin: "md"
          }
        ]
      }
    }
  };

}


function createQuickReplyItems(
  actions
) {

  return actions
    .slice(
      0,
      13
    )
    .map(
      (action) => ({
        type: "action",
        action:
          action
      })
    );

}


function createWelcomeMessage() {

  return {
    type: "text",
    text:
      "歡迎使用 iKey 智慧鑰匙管理系統",
    quickReply: {
      items:
        createQuickReplyItems([
          {
            type: "message",
            label: "帳號管理",
            text: "帳號管理"
          },
          {
            type: "message",
            label: "格位狀態",
            text: "格位狀態"
          },
          {
            type: "message",
            label: "系統狀態",
            text: "系統狀態"
          }
        ])
    }
  };

}





function normalizeDepartmentName(
  value
) {

  return String(
    value ||
    ""
  )
    .replace(/\s+/g, "")
    .replace(/科$/, "")
    .replace(/^綜合高中$/, "綜高")
    .trim();

}


function normalizeClassName(
  value
) {

  return String(
    value ||
    ""
  )
    .replace(/\s+/g, "")
    .replace(/科/g, "")
    .trim();

}


function getChineseGrade(
  grade
) {

  return (
    {
      "1": "一",
      "2": "二",
      "3": "三"
    }[
      String(
        grade ||
        ""
      )
    ] ||
    ""
  );

}


function findStudentClassForSession(
  classes,
  session
) {

  const expectedDepartment =
    normalizeDepartmentName(
      session.department
    );

  const expectedGrade =
    String(
      session.grade ||
      ""
    );

  const expectedName =
    normalizeClassName(
      `${session.department || ""}${getChineseGrade(session.grade)}${session.className || ""}`
    );


  const matches =
    classes.filter(
      (classData) => {

        if (
          !isRecordEnabled(
            classData.enabled
          )
        ) {
          return false;
        }


        const departmentMatches =
          normalizeDepartmentName(
            classData.department
          ) ===
          expectedDepartment;

        const gradeMatches =
          String(
            classData.grade ||
            ""
          ) ===
          expectedGrade;

        const className =
          normalizeClassName(
            classData.class_name
          );

        const nameMatches =
          className ===
            expectedName ||
          className.endsWith(
            `${getChineseGrade(session.grade)}${session.className || ""}`
          );


        return (
          departmentMatches &&
          gradeMatches &&
          nameMatches
        );

      }
    );


  if (matches.length === 0) {
    throw new Error(
      "找不到對應班級，請確認網站 Classes 已建立這個班級"
    );
  }


  if (matches.length > 1) {
    throw new Error(
      "找到多筆相同班級，請先整理 Classes 資料後再綁定"
    );
  }


  return matches[0];

}


function findStudentUserForSession(
  users,
  classData,
  session
) {

  const matches =
    users.filter(
      (user) =>
        String(
          user.identity ||
          ""
        ).toLowerCase() ===
          "student" &&
        String(
          user.class_id ||
          ""
        ) ===
          String(
            classData.class_id ||
            ""
          ) &&
        String(
          getStudentSeat(
            user
          )
        ) ===
          String(
            session.seat ||
            ""
          ) &&
        isRecordEnabled(
          user.enabled
        )
    );


  if (matches.length === 0) {
    throw new Error(
      "找不到這個班級與座號的既有學生身分，請先到 iKey 指紋辨識器完成註冊"
    );
  }


  if (matches.length > 1) {
    throw new Error(
      "這個班級與座號對應到多筆學生資料，請先整理 Users"
    );
  }


  return matches[0];

}


function findTeacherUserForSession(
  users,
  teacherSerial
) {

  const serial =
    String(
      teacherSerial ||
      ""
    ).trim();


  const exact =
    users.find(
      (user) =>
        String(
          user.identity ||
          ""
        ).toLowerCase() ===
          "teacher" &&
        String(
          user.user_id ||
          ""
        ).trim() ===
          serial &&
        isRecordEnabled(
          user.enabled
        )
    );


  if (exact) {
    return exact;
  }


  const insensitive =
    users.filter(
      (user) =>
        String(
          user.identity ||
          ""
        ).toLowerCase() ===
          "teacher" &&
        String(
          user.user_id ||
          ""
        )
          .trim()
          .toLowerCase() ===
          serial.toLowerCase() &&
        isRecordEnabled(
          user.enabled
        )
    );


  if (insensitive.length === 1) {
    return insensitive[0];
  }


  throw new Error(
    "找不到這個老師序號的既有老師身分，請到 iKey 指紋辨識器重新辨識確認"
  );

}


function ensureLineBindingAvailable(
  users,
  targetUser,
  lineUserId
) {

  const targetUserId =
    String(
      targetUser.user_id ||
      ""
    );

  const targetLineUserId =
    String(
      targetUser.line_user_id ||
      ""
    ).trim();


  if (
    targetLineUserId &&
    targetLineUserId !==
      lineUserId
  ) {
    throw new Error(
      "此 iKey 身分已綁定其他 LINE 帳號，不能直接覆蓋"
    );
  }


  const anotherUser =
    users.find(
      (user) =>
        String(
          user.line_user_id ||
          ""
        ).trim() ===
          lineUserId &&
        String(
          user.user_id ||
          ""
        ) !==
          targetUserId &&
        isRecordEnabled(
          user.enabled
        )
    );


  if (anotherUser) {
    throw new Error(
      "此 LINE 帳號已綁定其他 iKey 身分，請先登出後再切換"
    );
  }

}


async function completeLineIdentityFlow(
  event,
  session
) {

  const lineUserId =
    getLineSourceUserId(
      event
    );


  if (!lineUserId) {
    throw new Error(
      "目前事件沒有 LINE User ID，無法完成綁定"
    );
  }


  const [
    users,
    classes
  ] =
    await Promise.all([
      databaseReadCollection(
        "users",
        "users"
      ),
      databaseReadCollection(
        "classes",
        "classes"
      )
    ]);


  let targetUser;
  let classData =
    null;


  if (
    session.mode ===
    "update"
  ) {

    targetUser =
      users.find(
        (user) =>
          String(
            user.user_id ||
            ""
          ) ===
            String(
              session.targetUserId ||
              ""
            ) &&
          isRecordEnabled(
            user.enabled
          )
      );


    if (!targetUser) {
      throw new Error(
        "找不到目前登入的 iKey 身分"
      );
    }


    if (
      String(
        targetUser.identity ||
        ""
      ).toLowerCase() !==
        session.identity
    ) {
      throw new Error(
        "目前登入身分與更新流程不一致"
      );
    }


    if (
      session.identity ===
      "student"
    ) {

      classData =
        findStudentClassForSession(
          classes,
          session
        );

    } else if (
      String(
        targetUser.user_id ||
        ""
      )
        .trim()
        .toLowerCase() !==
      String(
        session.teacherSerial ||
        ""
      )
        .trim()
        .toLowerCase()
    ) {

      throw new Error(
        "老師序號目前就是 Users.user_id，更新資料不能直接更換 user_id；若要切換老師身分請先登出"
      );

    }

  } else if (
    session.identity ===
    "student"
  ) {

    classData =
      findStudentClassForSession(
        classes,
        session
      );

    targetUser =
      findStudentUserForSession(
        users,
        classData,
        session
      );

  } else if (
    session.identity ===
    "teacher"
  ) {

    targetUser =
      findTeacherUserForSession(
        users,
        session.teacherSerial
      );

  } else {
    throw new Error(
      "無效的登入身分"
    );
  }


  ensureLineBindingAvailable(
    users,
    targetUser,
    lineUserId
  );


  const profile =
    await getLineProfile(
      lineUserId
    );


  const updates = {
    name:
      String(
        session.name ||
        ""
      ).trim(),
    line_user_id:
      lineUserId,
    line_bind_status:
      "bound",
    line_display_name:
      String(
        profile.displayName ||
        ""
      ).trim()
  };


  if (
    session.identity ===
    "student"
  ) {

    updates.department =
      String(
        classData.department ||
        session.department ||
        ""
      );

    updates.grade =
      String(
        classData.grade ||
        session.grade ||
        ""
      );

    updates.class_id =
      String(
        classData.class_id ||
        ""
      );

    updates.seat_number =
      String(
        session.seat ||
        ""
      );

  }


  await databaseUpdateUser(
    String(
      targetUser.user_id ||
      ""
    ),
    updates
  );


  return {
    userId:
      String(
        targetUser.user_id ||
        ""
      ),
    identity:
      session.identity,
    mode:
      session.mode ||
      "login"
  };

}


function formatTaipeiDateTime(
  value
) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "尚未收到";
  }


  const date =
    new Date(
      Number.isFinite(
        Number(value)
      )
        ? Number(value)
        : value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "時間格式異常";
  }


  return new Intl.DateTimeFormat(
    "zh-TW",
    {
      timeZone:
        "Asia/Taipei",
      year:
        "numeric",
      month:
        "2-digit",
      day:
        "2-digit",
      hour:
        "2-digit",
      minute:
        "2-digit",
      second:
        "2-digit",
      hour12:
        false
    }
  ).format(
    date
  );

}


function createStatusLine(
  label,
  value,
  valueColor =
    "#f8fafc"
) {

  return {
    type: "box",
    layout: "horizontal",
    spacing: "md",
    margin: "md",
    contents: [
      {
        type: "text",
        text: label,
        size: "sm",
        color: "#a6b2c5",
        flex: 4,
        wrap: true
      },
      {
        type: "text",
        text: value,
        size: "sm",
        weight: "bold",
        color: valueColor,
        flex: 6,
        align: "end",
        wrap: true
      }
    ]
  };

}


function createSlotStatusFlex(
  slots,
  classrooms
) {

  const rows = [];


  for (
    let slotNumber = 1;
    slotNumber <= 8;
    slotNumber += 1
  ) {

    const slot =
      slots.find(
        (item) =>
          String(
            item.slot_id ||
            ""
          ) ===
          String(
            slotNumber
          )
      ) ||
      null;


    const classroom =
      slot
        ? (
            classrooms.find(
              (item) =>
                String(
                  item.classroom_id ||
                  ""
                ) ===
                String(
                  slot.classroom_id ||
                  ""
                )
            ) ||
            classrooms.find(
              (item) =>
                String(
                  item.slot_id ||
                  ""
                ) ===
                String(
                  slotNumber
                )
            ) ||
            null
          )
        : (
            classrooms.find(
              (item) =>
                String(
                  item.slot_id ||
                  ""
                ) ===
                String(
                  slotNumber
                )
            ) ||
            null
          );


    const classroomName =
      String(
        (
          classroom &&
          classroom.classroom_name
        ) ||
        "未設定教室"
      );


    const rawStatus =
      String(
        (
          slot &&
          slot.status
        ) ||
        ""
      ).toLowerCase();


    let statusText =
      "狀態未知";

    let statusColor =
      "#a6b2c5";


    if (
      rawStatus ===
      "borrowed"
    ) {

      statusText =
        "已借出";

      statusColor =
        "#ffb86b";

    } else if (
      rawStatus ===
      "available"
    ) {

      statusText =
        "未借出";

      statusColor =
        "#7de2b1";

    }


    rows.push({
      type: "box",
      layout: "vertical",
      margin:
        slotNumber === 1
          ? "lg"
          : "md",
      paddingAll: "12px",
      backgroundColor:
        "#142034",
      cornerRadius:
        "10px",
      contents: [
        {
          type: "box",
          layout:
            "horizontal",
          contents: [
            {
              type: "text",
              text:
                `格位 ${slotNumber}`,
              size: "sm",
              weight:
                "bold",
              color:
                "#f8fafc",
              flex: 4
            },
            {
              type: "text",
              text:
                statusText,
              size: "sm",
              weight:
                "bold",
              color:
                statusColor,
              align:
                "end",
              flex: 3
            }
          ]
        },
        {
          type: "text",
          text:
            `教室名稱：${classroomName}`,
          size: "xs",
          color:
            "#a6b2c5",
          wrap: true,
          margin: "sm"
        }
      ]
    });

  }


  return {
    type: "flex",
    altText:
      "iKey 格位狀態",
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor:
          "#0b1220",
        paddingAll:
          "20px",
        contents: [
          {
            type: "text",
            text: "iKey",
            size: "sm",
            weight: "bold",
            color:
              "#63d8e8"
          },
          {
            type: "text",
            text:
              "格位狀態",
            size: "xl",
            weight: "bold",
            color:
              "#f8fafc",
            margin: "md"
          },
          {
            type: "text",
            text:
              "教室名稱與借用狀態皆讀取目前資料庫",
            size: "xs",
            color:
              "#a6b2c5",
            wrap: true,
            margin: "sm"
          },
          ...rows
        ]
      }
    }
  };

}


function createSystemStatusFlex(
  devices,
  databaseHealth
) {

  const esp =
    devices[
      "esp-robot"
    ] ||
    {
      online: false,
      lastSeen: null
    };


  const terminal =
    devices[
      "lvgl-terminal"
    ] ||
    {
      online: false,
      lastSeen: null
    };


  const contents = [
    {
      type: "text",
      text: "iKey",
      size: "sm",
      weight: "bold",
      color: "#63d8e8"
    },
    {
      type: "text",
      text:
        "系統狀態",
      size: "xl",
      weight: "bold",
      color:
        "#f8fafc",
      margin: "md"
    },
    createStatusLine(
      "ESP32 控制器",
      esp.online
        ? "正常"
        : "斷線",
      esp.online
        ? "#7de2b1"
        : "#ffb86b"
    ),
    createStatusLine(
      "上次連線",
      formatTaipeiDateTime(
        esp.lastSeen
      )
    ),
    createStatusLine(
      "螢幕控制器",
      terminal.online
        ? "正常"
        : "斷線",
      terminal.online
        ? "#7de2b1"
        : "#ffb86b"
    ),
    createStatusLine(
      "上次連線",
      formatTaipeiDateTime(
        terminal.lastSeen
      )
    ),
    createStatusLine(
      "UptimeRobot",
      "尚未提供",
      "#a6b2c5"
    ),
    createStatusLine(
      "資料庫",
      databaseHealth.online
        ? "連線正常"
        : "連線異常",
      databaseHealth.online
        ? "#7de2b1"
        : "#ff7b7b"
    ),
    createStatusLine(
      "DB 上次更新",
      "尚未提供",
      "#a6b2c5"
    ),
    {
      type: "separator",
      margin: "lg",
      color: "#31445f"
    },
    {
      type: "text",
      text:
        `更新時間：${formatTaipeiDateTime(Date.now())}`,
      size: "xs",
      color:
        "#a6b2c5",
      wrap: true,
      margin: "lg"
    }
  ];


  return {
    type: "flex",
    altText:
      "iKey 系統狀態",
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor:
          "#0b1220",
        paddingAll:
          "22px",
        contents:
          contents
      }
    }
  };

}


async function createSlotStatusForLine() {

  const [
    slots,
    classrooms
  ] =
    await Promise.all([
      databaseReadCollection(
        "slots",
        "slots"
      ),
      databaseReadCollection(
        "classrooms",
        "classrooms"
      )
    ]);


  return createSlotStatusFlex(
    slots,
    classrooms
  );

}


async function createSystemStatusForLine() {

  const devices =
    typeof deviceRoutes.getStatusSnapshot ===
      "function"
      ? deviceRoutes.getStatusSnapshot()
      : {};


  const databaseHealth =
    await databaseHealthCheck();


  return createSystemStatusFlex(
    devices,
    databaseHealth
  );

}


const STUDENT_DEPARTMENTS = [
  "控制",
  "綜高",
  "電機",
  "電子",
  "冷凍",
  "資訊",
  "圖傳",
  "製圖",
  "建築"
];


const lineFlowSessions =
  new Map();


function getLineFlowSessionKey(
  event
) {

  return getLineSourceUserId(
    event
  );

}


function getLineFlowSession(
  event
) {

  const key =
    getLineFlowSessionKey(
      event
    );


  if (!key) {
    return null;
  }


  return (
    lineFlowSessions.get(
      key
    ) ||
    null
  );

}


function setLineFlowSession(
  event,
  session
) {

  const key =
    getLineFlowSessionKey(
      event
    );


  if (!key) {
    return null;
  }


  const nextSession = {
    ...session,
    updatedAt:
      Date.now()
  };


  lineFlowSessions.set(
    key,
    nextSession
  );


  return nextSession;

}


function clearLineFlowSession(
  event
) {

  const key =
    getLineFlowSessionKey(
      event
    );


  if (key) {
    lineFlowSessions.delete(
      key
    );
  }

}


function updateLineFlowSession(
  event,
  changes
) {

  const current =
    getLineFlowSession(
      event
    ) ||
    {};


  return setLineFlowSession(
    event,
    {
      ...current,
      ...changes
    }
  );

}



function createFlowChoiceFlex(
  title,
  subtitle,
  choices
) {

  return {
    type: "flex",
    altText:
      `iKey：${title}`,
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#0b1220",
        paddingAll: "22px",
        contents: [
          {
            type: "text",
            text: "iKey",
            size: "sm",
            weight: "bold",
            color: "#63d8e8"
          },
          {
            type: "text",
            text: title,
            size: "xl",
            weight: "bold",
            color: "#f8fafc",
            wrap: true,
            margin: "md"
          },
          {
            type: "text",
            text: subtitle,
            size: "sm",
            color: "#a6b2c5",
            wrap: true,
            margin: "sm"
          },
          {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            margin: "lg",
            contents:
              choices.map(
                (choice) => ({
                  type: "button",
                  style: "primary",
                  height: "sm",
                  color:
                    choice.color ||
                    "#1b3150",
                  adjustMode:
                    "shrink-to-fit",
                  action:
                    createPostbackAction(
                      choice.label,
                      choice.params,
                      {
                        displayText:
                          choice.displayText ||
                          choice.label
                      }
                    )
                })
              )
          }
        ]
      }
    }
  };

}


function createFingerprintQuestionFlex() {

  return createFlowChoiceFlex(
    "帳號管理",
    "請問您是否已經按壓過指紋？",
    [
      {
        label:
          "已經按壓過指紋",
        color:
          "#2eb8d0",
        params: {
          action:
            "fingerprint_yes"
        }
      },
      {
        label:
          "還沒有",
        params: {
          action:
            "fingerprint_no"
        }
      }
    ]
  );

}


function createStudentDepartmentFlex(
  mode = "login"
) {

  return createFlowChoiceFlex(
    "學生資料",
    "請選擇科別",
    STUDENT_DEPARTMENTS.map(
      (department) => ({
        label:
          department,
        params: {
          action:
            "student_department",
          mode:
            mode,
          department:
            department
        }
      })
    )
  );

}


function createStudentGradeFlex(
  department,
  mode = "login"
) {

  return createFlowChoiceFlex(
    "學生資料",
    `科別：${department}\n請選擇年級`,
    [
      ["一年級", "1"],
      ["二年級", "2"],
      ["三年級", "3"]
    ].map(
      ([label, grade]) => ({
        label:
          label,
        params: {
          action:
            "student_grade",
          mode:
            mode,
          department:
            department,
          grade:
            grade
        }
      })
    )
  );

}


function createStudentClassFlex(
  department,
  grade,
  mode = "login"
) {

  const classNames =
    department ===
      "綜高"
      ? [
          "忠",
          "孝",
          "仁",
          "愛"
        ]
      : [
          "甲",
          "乙"
        ];


  return createFlowChoiceFlex(
    "學生資料",
    `科別：${department}\n年級：${grade} 年級\n請選擇班級`,
    classNames.map(
      (className) => ({
        label:
          className,
        params: {
          action:
            "student_class",
          mode:
            mode,
          department:
            department,
          grade:
            grade,
          class_name:
            className
        }
      })
    )
  );

}


function createTeacherSerialPrompt() {

  return {
    type: "text",
    text:
      "請輸入老師序號。\n\n如果忘記老師序號，請到 iKey 指紋辨識器再辨識一次確認。"
  };

}


function createStudentSeatPrompt(
  department,
  grade,
  className
) {

  return {
    type: "text",
    text:
      [
        `科別：${department}`,
        `年級：${grade} 年級`,
        `班級：${className}`,
        "",
        "下一步請輸入座號。"
      ].join("\n")
  };

}



function createFlowDataConfirmationFlex(
  session,
  finalConfirmation = false
) {

  const isStudent =
    session.identity ===
      "student";


  const lines =
    isStudent
      ? [
          "身分：學生",
          `科別：${session.department || "未設定"}`,
          `年級：${session.grade || "未設定"} 年級`,
          `班級：${session.className || "未設定"}`,
          `座號：${session.seat || "未設定"}`
        ]
      : [
          "身分：老師",
          `老師序號：${session.teacherSerial || "未設定"}`
        ];


  if (finalConfirmation) {
    lines.push(
      `姓名：${session.name || "未設定"}`
    );
  }


  lines.push(
    "",
    finalConfirmation
      ? "請確認以上所有資料是否正確。"
      : "請確認以上身分資料是否正確。"
  );


  return createFlowChoiceFlex(
    finalConfirmation
      ? "最終資料確認"
      : "身分資料確認",
    lines.join("\n"),
    [
      {
        label:
          "正確",
        color:
          "#2eb8d0",
        params: {
          action:
            finalConfirmation
              ? "flow_final_correct"
              : "flow_identity_correct"
        }
      },
      {
        label:
          "錯誤",
        params: {
          action:
            finalConfirmation
              ? "flow_name_wrong"
              : "flow_identity_wrong"
        }
      }
    ]
  );

}


async function handleFlowTextInput(
  event,
  messageText
) {

  const session =
    getLineFlowSession(
      event
    );


  if (!session) {
    return false;
  }


  if (
    session.stage ===
    "student_seat"
  ) {

    if (
      !/^\d+$/.test(
        messageText
      ) ||
      Number(
        messageText
      ) <= 0
    ) {

      await replyText(
        event.replyToken,
        "座號請輸入正整數，例如：12"
      );

      return true;

    }


    const nextSession =
      updateLineFlowSession(
        event,
        {
          seat:
            String(
              Number(
                messageText
              )
            ),
          stage:
            "identity_confirm"
        }
      );


    await replyMessages(
      event.replyToken,
      [
        createFlowDataConfirmationFlex(
          nextSession
        )
      ]
    );

    return true;

  }


  if (
    session.stage ===
    "teacher_serial"
  ) {

    if (!messageText) {

      await replyText(
        event.replyToken,
        "請輸入老師序號。"
      );

      return true;

    }


    const nextSession =
      updateLineFlowSession(
        event,
        {
          teacherSerial:
            messageText,
          stage:
            "identity_confirm"
        }
      );


    await replyMessages(
      event.replyToken,
      [
        createFlowDataConfirmationFlex(
          nextSession
        )
      ]
    );

    return true;

  }


  if (
    session.stage ===
    "name"
  ) {

    if (!messageText) {

      await replyText(
        event.replyToken,
        "請輸入姓名。"
      );

      return true;

    }


    const nextSession =
      updateLineFlowSession(
        event,
        {
          name:
            messageText,
          stage:
            "final_confirm"
        }
      );


    await replyMessages(
      event.replyToken,
      [
        createFlowDataConfirmationFlex(
          nextSession,
          true
        )
      ]
    );

    return true;

  }


  return false;

}


async function getLineProfile(
  lineUserId
) {

  const channelAccessToken =
    getChannelAccessToken();


  if (!channelAccessToken) {
    throw new Error(
      "LINE_CHANNEL_ACCESS_TOKEN is not configured"
    );
  }


  const response =
    await fetch(
      `https://api.line.me/v2/bot/profile/${encodeURIComponent(lineUserId)}`,
      {
        headers: {
          "Authorization":
            `Bearer ${channelAccessToken}`
        }
      }
    );


  if (!response.ok) {
    throw new Error(
      "無法取得目前 LINE 帳號資料，請確認已加入 iKey 官方帳號後再試一次"
    );
  }


  return response.json();

}


/*
 * ============================================================
 * Event Handler
 * ============================================================
 */

async function handleTextMessage(
  event,
  messageText
) {

  if (!event.replyToken) {
    return;
  }


  switch (messageText) {

    case "測試":

      await replyText(
        event.replyToken,
        "iKey LINE 系統連線正常"
      );

      console.log(
        "[LINE] Step 1 test reply sent successfully"
      );

      return;


    case "帳號管理":

      clearLineFlowSession(
        event
      );


      await replyMessages(
        event.replyToken,
        [
          await createAccountManagementForEvent(
            event
          )
        ]
      );

      console.log(
        "[LINE] account management Flex Message sent successfully"
      );

      return;


    case "格位狀態":

      await replyMessages(
        event.replyToken,
        [
          await createSlotStatusForLine()
        ]
      );

      console.log(
        "[LINE] slot status Flex Message sent successfully"
      );

      return;


    case "系統狀態":

      await replyMessages(
        event.replyToken,
        [
          await createSystemStatusForLine()
        ]
      );

      console.log(
        "[LINE] system status Flex Message sent successfully"
      );

      return;


    case "登入": {

      clearLineFlowSession(
        event
      );


      const boundUser =
        await getBoundUserForEvent(
          event
        );


      if (boundUser) {

        await replyMessages(
          event.replyToken,
          [
            await createAccountManagementForEvent(
              event
            )
          ]
        );

        console.log(
          `[LINE] login blocked until logout: user_id=${boundUser.user_id}`
        );

        return;

      }


      await replyMessages(
        event.replyToken,
        [
          createFingerprintQuestionFlex()
        ]
      );

      console.log(
        "[LINE] fingerprint confirmation sent successfully"
      );

      return;

    }


    default: {

      const handledFlowInput =
        await handleFlowTextInput(
          event,
          messageText
        );


      if (handledFlowInput) {
        return;
      }


      console.log(
        `[LINE] no text route matched: ${messageText}`
      );


      await replyMessages(
        event.replyToken,
        [
          createWelcomeMessage()
        ]
      );

      return;

    }

  }

}


async function handlePostbackEvent(
  event
) {

  if (!event.replyToken) {
    return;
  }


  const params =
    new URLSearchParams(
      String(
        (
          event.postback &&
          event.postback.data
        ) ||
        ""
      )
    );


  const action =
    params.get(
      "action"
    ) || "";


  console.log(
    `[LINE] postback received: ${action}`
  );


  if (
    action ===
    "fingerprint_check"
  ) {

    await replyMessages(
      event.replyToken,
      [
        createFingerprintQuestionFlex()
      ]
    );

    return;

  }


  if (
    action ===
    "fingerprint_no"
  ) {

    clearLineFlowSession(
      event
    );


    await replyMessages(
      event.replyToken,
      [
        {
          type: "text",
          text:
            "請先到 iKey 指紋辨識器完成指紋註冊。\n完成後再回到 LINE 點選「帳號管理」。"
        }
      ]
    );

    return;

  }


  if (
    action ===
    "fingerprint_yes"
  ) {

    const boundUser =
      await getBoundUserForEvent(
        event
      );


    if (boundUser) {

      await replyMessages(
        event.replyToken,
        [
          await createAccountManagementForEvent(
            event
          )
        ]
      );

      return;

    }


    setLineFlowSession(
      event,
      {
        mode:
          "login",
        stage:
          "identity"
      }
    );


    await replyMessages(
      event.replyToken,
      [
        createIdentitySelectionFlex()
      ]
    );

    return;

  }


  if (
    action ===
    "update_data"
  ) {

    const boundUser =
      await getBoundUserForEvent(
        event
      );


    if (!boundUser) {

      await replyMessages(
        event.replyToken,
        [
          createFingerprintQuestionFlex()
        ]
      );

      return;

    }


    const identity =
      String(
        boundUser.identity ||
        ""
      ).toLowerCase();


    setLineFlowSession(
      event,
      {
        mode:
          "update",
        identity:
          identity,
        targetUserId:
          String(
            boundUser.user_id ||
            ""
          ),
        stage:
          identity === "student"
            ? "student_department"
            : "teacher_serial"
      }
    );


    if (identity === "student") {

      await replyMessages(
        event.replyToken,
        [
          createStudentDepartmentFlex(
            "update"
          )
        ]
      );

      return;

    }


    if (identity === "teacher") {

      await replyMessages(
        event.replyToken,
        [
          createTeacherSerialPrompt()
        ]
      );

      return;

    }


    throw new Error(
      "目前登入身分無法更新"
    );

  }


  if (
    action ===
    "student_department"
  ) {

    const department =
      params.get(
        "department"
      ) || "";

    const mode =
      params.get(
        "mode"
      ) || "login";


    if (
      !STUDENT_DEPARTMENTS.includes(
        department
      )
    ) {
      throw new Error(
        "無效的科別選擇"
      );
    }


    updateLineFlowSession(
      event,
      {
        mode:
          mode,
        identity:
          "student",
        department:
          department,
        stage:
          "student_grade"
      }
    );


    await replyMessages(
      event.replyToken,
      [
        createStudentGradeFlex(
          department,
          mode
        )
      ]
    );

    return;

  }


  if (
    action ===
    "student_grade"
  ) {

    const department =
      params.get(
        "department"
      ) || "";

    const grade =
      params.get(
        "grade"
      ) || "";

    const mode =
      params.get(
        "mode"
      ) || "login";


    if (
      !STUDENT_DEPARTMENTS.includes(
        department
      ) ||
      ![
        "1",
        "2",
        "3"
      ].includes(
        grade
      )
    ) {
      throw new Error(
        "無效的學生資料選擇"
      );
    }


    updateLineFlowSession(
      event,
      {
        mode:
          mode,
        identity:
          "student",
        department:
          department,
        grade:
          grade,
        stage:
          "student_class"
      }
    );


    await replyMessages(
      event.replyToken,
      [
        createStudentClassFlex(
          department,
          grade,
          mode
        )
      ]
    );

    return;

  }


  if (
    action ===
    "student_class"
  ) {

    const department =
      params.get(
        "department"
      ) || "";

    const grade =
      params.get(
        "grade"
      ) || "";

    const className =
      params.get(
        "class_name"
      ) || "";


    const allowedClasses =
      department ===
        "綜高"
        ? [
            "忠",
            "孝",
            "仁",
            "愛"
          ]
        : [
            "甲",
            "乙"
          ];


    if (
      !STUDENT_DEPARTMENTS.includes(
        department
      ) ||
      ![
        "1",
        "2",
        "3"
      ].includes(
        grade
      ) ||
      !allowedClasses.includes(
        className
      )
    ) {
      throw new Error(
        "無效的班級選擇"
      );
    }


    updateLineFlowSession(
      event,
      {
        identity:
          "student",
        department:
          department,
        grade:
          grade,
        className:
          className,
        stage:
          "student_seat"
      }
    );


    await replyMessages(
      event.replyToken,
      [
        createStudentSeatPrompt(
          department,
          grade,
          className
        )
      ]
    );

    console.log(
      `[LINE] student flow waiting for seat input: ${department}/${grade}/${className}`
    );

    return;

  }


  if (
    action ===
    "logout"
  ) {

    clearLineFlowSession(
      event
    );


    const boundUser =
      await getBoundUserForEvent(
        event
      );


    if (!boundUser) {

      await replyMessages(
        event.replyToken,
        [
          createAccountManagementFlex()
        ]
      );

      return;

    }


    await databaseUpdateUser(
      String(
        boundUser.user_id ||
        ""
      ),
      {
        line_user_id: "",
        line_bind_status:
          "unbound",
        line_display_name: ""
      }
    );


    await replyMessages(
      event.replyToken,
      [
        {
          type: "text",
          text:
            "已登出 iKey 帳號"
        },
        createAccountManagementFlex()
      ]
    );


    console.log(
      `[LINE] logout completed: user_id=${boundUser.user_id}`
    );

    return;

  }


  if (
    action.startsWith(
      "login_"
    ) &&
    action !==
      "login_cancel"
  ) {

    const boundUser =
      await getBoundUserForEvent(
        event
      );


    if (boundUser) {

      await replyMessages(
        event.replyToken,
        [
          await createAccountManagementForEvent(
            event
          )
        ]
      );

      console.log(
        `[LINE] login postback blocked until logout: user_id=${boundUser.user_id}`
      );

      return;

    }

  }


  if (
    action ===
    "flow_identity_correct"
  ) {

    const session =
      getLineFlowSession(
        event
      );


    if (
      !session ||
      session.stage !==
        "identity_confirm"
    ) {

      await replyText(
        event.replyToken,
        "登入流程已失效，請重新點選「帳號管理」。"
      );

      return;

    }


    updateLineFlowSession(
      event,
      {
        stage:
          "name"
      }
    );


    await replyText(
      event.replyToken,
      "身分資料已確認。\n下一步請輸入姓名。"
    );

    return;

  }


  if (
    action ===
    "flow_identity_wrong"
  ) {

    const session =
      getLineFlowSession(
        event
      );


    if (!session) {

      await replyMessages(
        event.replyToken,
        [
          await createAccountManagementForEvent(
            event
          )
        ]
      );

      return;

    }


    if (
      session.identity ===
      "student"
    ) {

      updateLineFlowSession(
        event,
        {
          department:
            "",
          grade:
            "",
          className:
            "",
          seat:
            "",
          name:
            "",
          stage:
            "student_department"
        }
      );


      await replyMessages(
        event.replyToken,
        [
          createStudentDepartmentFlex(
            session.mode ||
            "login"
          )
        ]
      );

      return;

    }


    updateLineFlowSession(
      event,
      {
        teacherSerial:
          "",
        name:
          "",
        stage:
          "teacher_serial"
      }
    );


    await replyMessages(
      event.replyToken,
      [
        createTeacherSerialPrompt()
      ]
    );

    return;

  }


  if (
    action ===
    "flow_name_wrong"
  ) {

    const session =
      getLineFlowSession(
        event
      );


    if (!session) {

      await replyText(
        event.replyToken,
        "登入流程已失效，請重新點選「帳號管理」。"
      );

      return;

    }


    updateLineFlowSession(
      event,
      {
        name:
          "",
        stage:
          "name"
      }
    );


    await replyText(
      event.replyToken,
      "請重新輸入姓名。"
    );

    return;

  }


  if (
    action ===
    "flow_final_correct"
  ) {

    const session =
      getLineFlowSession(
        event
      );


    if (
      !session ||
      session.stage !==
        "final_confirm"
    ) {

      await replyText(
        event.replyToken,
        "登入流程已失效，請重新點選「帳號管理」。"
      );

      return;

    }


    updateLineFlowSession(
      event,
      {
        stage:
          "binding"
      }
    );


    try {

      const result =
        await completeLineIdentityFlow(
          event,
          session
        );


      clearLineFlowSession(
        event
      );


      await replyMessages(
        event.replyToken,
        [
          {
            type: "text",
            text:
              result.mode ===
                "update"
                ? "資料更新完成\n\n歡迎使用 iKey\n自動倉儲鑰匙借還系統"
                : "帳號綁定完成\n\n歡迎使用 iKey\n自動倉儲鑰匙借還系統"
          }
        ]
      );


      console.log(
        `[LINE] identity flow completed: user_id=${result.userId}, identity=${result.identity}, mode=${result.mode}`
      );

    } catch (error) {

      updateLineFlowSession(
        event,
        {
          stage:
            "final_confirm"
        }
      );


      throw error;

    }


    return;

  }


  if (
    action ===
    "login_restart"
  ) {

    clearLineFlowSession(
      event
    );


    await replyMessages(
      event.replyToken,
      [
        createIdentitySelectionFlex()
      ]
    );

    return;

  }


  if (
    action ===
    "login_cancel"
  ) {

    clearLineFlowSession(
      event
    );


    await replyMessages(
      event.replyToken,
      [
        await createAccountManagementForEvent(
          event
        )
      ]
    );

    return;

  }


  if (
    action ===
    "login_identity"
  ) {

    const identity =
      params.get(
        "identity"
      );


    if (
      identity ===
      "student"
    ) {

      setLineFlowSession(
        event,
        {
          mode:
            "login",
          identity:
            "student",
          stage:
            "student_department"
        }
      );


      await replyMessages(
        event.replyToken,
        [
          createStudentDepartmentFlex(
            "login"
          )
        ]
      );

      return;

    }


    if (
      identity ===
      "teacher"
    ) {

      setLineFlowSession(
        event,
        {
          mode:
            "login",
          identity:
            "teacher",
          stage:
            "teacher_serial"
        }
      );


      await replyMessages(
        event.replyToken,
        [
          createTeacherSerialPrompt()
        ]
      );

      return;

    }


    throw new Error(
      "無效的身分選擇"
    );

  }

  if (
    action ===
    "login_student_class"
  ) {

    const classId =
      params.get(
        "class_id"
      ) || "";


    const [
      users,
      classes
    ] =
      await Promise.all([
        databaseReadCollection(
          "users",
          "users"
        ),
        databaseReadCollection(
          "classes",
          "classes"
        )
      ]);


    const classData =
      classes.find(
        (item) =>
          String(
            item.class_id ||
            ""
          ) === classId
      );


    if (!classData) {

      throw new Error(
        "找不到指定班級"
      );

    }


    const students =
      users.filter(
        (user) =>
          String(
            user.identity ||
            ""
          ).toLowerCase() ===
            "student" &&
          String(
            user.class_id ||
            ""
          ) === classId &&
          isRecordEnabled(
            user.enabled
          )
      );


    await replyMessages(
      event.replyToken,
      [
        createStudentSeatSelectionFlex(
          classData,
          students
        )
      ]
    );

    return;

  }


  if (
    action ===
    "login_student_user" ||
    action ===
    "login_teacher_user"
  ) {

    const userId =
      params.get(
        "user_id"
      ) || "";


    const [
      users,
      classes
    ] =
      await Promise.all([
        databaseReadCollection(
          "users",
          "users"
        ),
        databaseReadCollection(
          "classes",
          "classes"
        )
      ]);


    const user =
      users.find(
        (item) =>
          String(
            item.user_id ||
            ""
          ) === userId &&
          isRecordEnabled(
            item.enabled
          )
      );


    if (!user) {

      throw new Error(
        "找不到指定 iKey 身分"
      );

    }


    const classData =
      classes.find(
        (item) =>
          String(
            item.class_id ||
            ""
          ) ===
          String(
            user.class_id ||
            ""
          )
      );


    await replyMessages(
      event.replyToken,
      [
        createIdentityConfirmationFlex(
          user,
          classData
        )
      ]
    );

    return;

  }


  if (
    action ===
    "login_confirm"
  ) {

    const userId =
      params.get(
        "user_id"
      ) || "";


    const users =
      await databaseReadCollection(
        "users",
        "users"
      );


    const selectedUser =
      users.find(
        (item) =>
          String(
            item.user_id ||
            ""
          ) === userId &&
          isRecordEnabled(
            item.enabled
          )
      );


    if (!selectedUser) {

      throw new Error(
        "找不到指定 iKey 身分"
      );

    }


    await replyMessages(
      event.replyToken,
      [
        createIdentityConfirmedFlex(
          selectedUser
        )
      ]
    );


    console.log(
      `[LINE] identity UI confirmed: user_id=${selectedUser.user_id}`
    );

    return;

  }


  console.log(
    `[LINE] unknown postback action: ${action}`
  );

}


async function handleLineEvent(
  event
) {

  try {

    if (
      event &&
      event.type === "message" &&
      event.message &&
      event.message.type === "text"
    ) {

      const messageText =
        String(
          event.message.text || ""
        ).trim();


      console.log(
        `[LINE] text message received: ${messageText}`
      );


      await handleTextMessage(
        event,
        messageText
      );

      return;

    }


    if (
      event &&
      event.type === "postback"
    ) {

      await handlePostbackEvent(
        event
      );

      return;

    }


    if (
      event &&
      event.type === "follow" &&
      event.replyToken
    ) {

      await replyMessages(
        event.replyToken,
        [
          createWelcomeMessage()
        ]
      );

      console.log(
        "[LINE] follow welcome message sent successfully"
      );

      return;

    }


    console.log(
      `[LINE] event received but not handled: ${event && event.type}`
    );

  } catch (error) {

    console.error(
      "[LINE] event handler error:",
      error
    );


    if (
      event &&
      event.replyToken
    ) {

      try {

        await replyText(
          event.replyToken,
          `iKey 暫時無法完成此操作：${error.message}`
        );

      } catch (replyError) {

        console.error(
          "[LINE] failed to send error reply:",
          replyError
        );

      }

    }

  }

}


/*
 * ============================================================
 * Webhook
 * ============================================================
 *
 * Important:
 * LINE signature verification must use the exact raw request body.
 * This route therefore uses express.raw() and must be mounted
 * before the application's global express.json() middleware.
 */

router.post(
  "/webhook",
  express.raw({
    type: "application/json"
  }),
  async (
    req,
    res
  ) => {

    try {

      const channelSecret =
        getChannelSecret();

      const channelAccessToken =
        getChannelAccessToken();


      if (!channelSecret) {

        console.error(
          "[LINE] LINE_CHANNEL_SECRET is not configured"
        );

        return res
          .status(503)
          .json({
            success: false,
            status: "error",
            message:
              "LINE webhook is not configured"
          });

      }


      if (!channelAccessToken) {

        console.error(
          "[LINE] LINE_CHANNEL_ACCESS_TOKEN is not configured"
        );

        return res
          .status(503)
          .json({
            success: false,
            status: "error",
            message:
              "LINE reply is not configured"
          });

      }


      const signature =
        req.get(
          "x-line-signature"
        );


      if (
        !verifyLineSignature(
          req.body,
          signature
        )
      ) {

        console.warn(
          "[LINE] Invalid webhook signature"
        );

        return res
          .status(401)
          .json({
            success: false,
            status: "error",
            message:
              "Invalid LINE signature"
          });

      }


      let body;


      try {

        body =
          JSON.parse(
            req.body.toString(
              "utf8"
            )
          );

      } catch (error) {

        console.warn(
          "[LINE] Invalid webhook JSON"
        );

        return res
          .status(400)
          .json({
            success: false,
            status: "error",
            message:
              "Invalid webhook JSON"
          });

      }


      const events =
        Array.isArray(
          body.events
        )
          ? body.events
          : [];


      console.log(
        `[LINE] webhook verified, events=${events.length}`
      );


      const results =
        await Promise.allSettled(
          events.map(
            handleLineEvent
          )
        );


      results.forEach(
        (
          result,
          index
        ) => {

          if (
            result.status ===
            "rejected"
          ) {

            console.error(
              `[LINE] event ${index} failed:`,
              result.reason
            );

          }

        }
      );


      return res
        .status(200)
        .json({
          success: true,
          status: "ok"
        });


    } catch (error) {

      console.error(
        "[LINE] webhook error:",
        error
      );


      return res
        .status(500)
        .json({
          success: false,
          status: "error",
          message:
            "LINE webhook internal error"
        });

    }

  }
);


module.exports = router;
