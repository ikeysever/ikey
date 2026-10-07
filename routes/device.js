const express = require("express");

const router = express.Router();

/*
 * iKey 裝置 Heartbeat
 *
 * esp-robot = ESP Robot
 * lvgl-terminal = LVGL Terminal
 */

const devices = {
  "esp-robot": {
    name: "ESP Robot",
    lastSeen: null
  },

  "lvgl-terminal": {
    name: "LVGL Terminal",
    lastSeen: null
  }
};

/*
 * 超過 30 秒沒有 Heartbeat
 * 就判定為離線
 */
const OFFLINE_TIMEOUT = 30000;


/*
 * =========================================
 * POST /api/device/heartbeat
 * 裝置回報自己還在線
 * =========================================
 */

router.post("/heartbeat", (req, res) => {

  const { deviceId } = req.body;

  if (!deviceId || !devices[deviceId]) {

    return res.status(400).json({
      success: false,
      message: "無效的 deviceId"
    });

  }

  devices[deviceId].lastSeen =
    Date.now();

  return res.json({
    success: true,
    deviceId: deviceId,
    deviceName: devices[deviceId].name,
    message: "Heartbeat received"
  });

});


/*
 * =========================================
 * GET /api/device/status
 * 網頁取得所有裝置狀態
 * =========================================
 */

function getDeviceStatusSnapshot(
  now = Date.now()
) {

  const result = {};


  Object.entries(devices).forEach(
    ([deviceId, device]) => {

      const online =
        device.lastSeen !== null &&
        now - device.lastSeen <
        OFFLINE_TIMEOUT;


      result[deviceId] = {
        name: device.name,
        online: online,
        lastSeen: device.lastSeen
      };

    }
  );


  return result;

}


router.get("/status", (req, res) => {

  return res.json({
    success: true,
    devices:
      getDeviceStatusSnapshot()
  });

});


router.getStatusSnapshot =
  getDeviceStatusSnapshot;


module.exports = router;
