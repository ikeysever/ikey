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

async function replyText(
  replyToken,
  text
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
          messages: [
            {
              type: "text",
              text: text
            }
          ]
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


/*
 * ============================================================
 * Event Handler
 * ============================================================
 */

async function handleLineEvent(
  event
) {

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


    if (
      messageText === "測試" &&
      event.replyToken
    ) {

      await replyText(
        event.replyToken,
        "iKey LINE 系統連線正常"
      );


      console.log(
        "[LINE] Step 1 test reply sent successfully"
      );

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
