const express = require("express");
const crypto = require("crypto");

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


function createAccountManagementFlex() {

  return {
    type: "flex",
    altText:
      "iKey 帳號管理：請登入 iKey 帳號",
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
            text: "請登入您的 iKey 帳號",
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
            action: {
              type: "message",
              label: "登入",
              text: "登入"
            }
          }
        ]
      }
    }
  };

}


function createPostbackAction(
  label,
  params
) {

  return {
    type: "postback",
    label: String(label).slice(0, 40),
    data:
      new URLSearchParams(
        params
      ).toString()
  };

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
            style: "secondary",
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


async function databaseUpdateUser(
  user
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
            user:
              user
          })
      }
    );


  if (data.success !== true) {

    throw new Error(
      data.message ||
      "Failed to update LINE binding"
    );

  }


  return data;

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
            style: "secondary",
            height: "sm",
            color: "#1b3150",
            action:
              createPostbackAction(
                "取消",
                {
                  action:
                    "login_restart"
                }
              )
          },
          {
            type: "button",
            style: "primary",
            height: "sm",
            color: "#2eb8d0",
            action:
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
              )
          }
        ]
      }
    }
  };

}


function createLoginSuccessFlex(
  user
) {

  return {
    type: "flex",
    altText:
      "iKey LINE 帳號登入成功",
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
            text: "登入成功",
            size: "xl",
            weight: "bold",
            color: "#7de2b1",
            margin: "md"
          },
          {
            type: "text",
            text:
              user.name
                ? `${user.name}，您的 LINE 帳號已與 iKey 身分完成綁定。`
                : "您的 LINE 帳號已與 iKey 身分完成綁定。",
            size: "md",
            color: "#f8fafc",
            wrap: true,
            margin: "lg"
          }
        ]
      }
    }
  };

}


async function getLineProfile(
  lineUserId
) {

  const channelAccessToken =
    getChannelAccessToken();


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

    const responseText =
      await response.text();

    throw new Error(
      `LINE profile HTTP ${response.status}: ${responseText.slice(0, 300)}`
    );

  }


  return response.json();

}


async function bindLineAccount(
  selectedUser,
  lineUserId,
  allUsers
) {

  const selectedBoundId =
    String(
      selectedUser.line_user_id ||
      ""
    ).trim();

  const selectedStatus =
    String(
      selectedUser.line_bind_status ||
      ""
    )
      .trim()
      .toLowerCase();


  if (
    selectedBoundId &&
    selectedBoundId !== lineUserId &&
    selectedStatus !== "unbound"
  ) {

    throw new Error(
      "此 iKey 身分已綁定其他 LINE 帳號"
    );

  }


  const existingBinding =
    allUsers.find(
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
          String(
            selectedUser.user_id ||
            ""
          )
    );


  if (existingBinding) {

    throw new Error(
      "此 LINE 帳號已綁定其他 iKey 身分"
    );

  }


  const profile =
    await getLineProfile(
      lineUserId
    );


  const updatedUser = {
    ...selectedUser,
    line_user_id:
      lineUserId,
    line_bind_status:
      "bound",
    line_display_name:
      String(
        profile.displayName ||
        ""
      )
  };


  await databaseUpdateUser(
    updatedUser
  );


  return updatedUser;

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

      await replyMessages(
        event.replyToken,
        [
          createAccountManagementFlex()
        ]
      );

      console.log(
        "[LINE] account management Flex Message sent successfully"
      );

      return;


    case "登入":

      await replyMessages(
        event.replyToken,
        [
          createIdentitySelectionFlex()
        ]
      );

      console.log(
        "[LINE] identity selection Flex Message sent successfully"
      );

      return;


    default:

      console.log(
        `[LINE] no text route matched: ${messageText}`
      );

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
    "login_restart"
  ) {

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


      const students =
        users.filter(
          (user) =>
            String(
              user.identity ||
              ""
            ).toLowerCase() ===
              "student" &&
            isRecordEnabled(
              user.enabled
            )
        );


      const availableClasses =
        classes
          .filter(
            (classData) =>
              isRecordEnabled(
                classData.enabled
              ) &&
              students.some(
                (user) =>
                  String(
                    user.class_id ||
                    ""
                  ) ===
                  String(
                    classData.class_id ||
                    ""
                  )
              )
          )
          .sort(
            (a, b) =>
              getClassLabel(a)
                .localeCompare(
                  getClassLabel(b),
                  "zh-Hant"
                )
          );


      await replyMessages(
        event.replyToken,
        [
          createStudentClassSelectionFlex(
            availableClasses
          )
        ]
      );

      return;

    }


    if (
      identity ===
      "teacher"
    ) {

      const users =
        await databaseReadCollection(
          "users",
          "users"
        );


      const teachers =
        users.filter(
          (user) =>
            String(
              user.identity ||
              ""
            ).toLowerCase() ===
              "teacher" &&
            isRecordEnabled(
              user.enabled
            )
        );


      await replyMessages(
        event.replyToken,
        [
          createTeacherSelectionFlex(
            teachers
          )
        ]
      );

      return;

    }

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

    if (
      !event.source ||
      event.source.type !== "user" ||
      !event.source.userId
    ) {

      throw new Error(
        "帳號綁定只能在與 iKey 官方帳號的一對一聊天室完成"
      );

    }


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


    const updatedUser =
      await bindLineAccount(
        selectedUser,
        event.source.userId,
        users
      );


    await replyMessages(
      event.replyToken,
      [
        createLoginSuccessFlex(
          updatedUser
        )
      ]
    );


    console.log(
      `[LINE] account bound successfully: user_id=${updatedUser.user_id}`
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
