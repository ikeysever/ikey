document.addEventListener("DOMContentLoaded", () => {

  /*
   * =========================================
   * 基本元素
   * =========================================
   */

  const loginPage =
    document.getElementById("loginPage");

  const homePage =
    document.getElementById("homePage");

  const loginForm =
    document.getElementById("loginForm");

  const accountInput =
    document.getElementById("account");

  const passwordInput =
    document.getElementById("password");

  const loginMessage =
    document.getElementById("loginMessage");

  const logoutButton =
    document.getElementById("logoutButton");


  /*
   * =========================================
   * 頁面
   * =========================================
   */

  const dashboardPage =
    document.getElementById("dashboardPage");

  const classroomPage =
    document.getElementById("classroomPage");

  const slotStatusPage =
    document.getElementById("slotStatusPage");

  const terminalPage =
    document.getElementById("terminalPage");


  /*
   * =========================================
   * Header
   * =========================================
   */

  const pageTitle =
    document.getElementById("pageTitle");

  const pageDescription =
    document.getElementById("pageDescription");


  /*
   * =========================================
   * Sidebar
   * =========================================
   */

  const sidebarItems =
    document.querySelectorAll(
      ".sidebar-item[data-page]"
    );

  const scheduleToggle =
    document.getElementById("scheduleToggle");

  const scheduleArrow =
    document.getElementById("scheduleArrow");

  const classroomMenu =
    document.getElementById("classroomMenu");

  const classroomItems =
    document.querySelectorAll(
      ".classroom-item"
    );


  /*
   * =========================================
   * Classroom
   * =========================================
   */

  const classroomTitle =
    document.getElementById("classroomTitle");


  /*
   * =========================================
   * Device Status
   * =========================================
   */

  const espRobotStatus =
    document.getElementById("espRobotStatus");

  const lvglTerminalStatus =
    document.getElementById(
      "lvglTerminalStatus"
    );

  const connectedDeviceCount =
    document.getElementById(
      "connectedDeviceCount"
    );

  const connectionDot =
    document.getElementById(
      "connectionDot"
    );

  const connectionText =
    document.getElementById(
      "connectionText"
    );


  /*
   * =========================================
   * System Log
   * =========================================
   */

  const systemLog =
    document.getElementById("systemLog");


  /*
   * =========================================
   * Device State
   * =========================================
   */

  let previousEspRobotOnline = null;

  let previousLvglTerminalOnline = null;

  let pollingStarted = false;


  /*
   * =========================================
   * 系統日誌
   * =========================================
   */

  function addSystemLog(message) {

    if (!systemLog) {
      return;
    }

    const time =
      new Date().toLocaleTimeString(
        "zh-TW",
        {
          hour12: false
        }
      );

    const line =
      document.createElement("div");

    line.className = "log-line";

    line.textContent =
      `[${time}] ${message}`;

    systemLog.prepend(line);

  }


  /*
   * =========================================
   * 隱藏所有內容頁
   * =========================================
   */

  function hideAllContentPages() {

    if (dashboardPage) {
      dashboardPage.hidden = true;
    }

    if (classroomPage) {
      classroomPage.hidden = true;
    }

    if (slotStatusPage) {
      slotStatusPage.hidden = true;
    }

    if (terminalPage) {
      terminalPage.hidden = true;
    }

  }


  /*
   * =========================================
   * Sidebar Active
   * =========================================
   */

  function clearSidebarActive() {

    sidebarItems.forEach(
      (item) => {

        item.classList.remove(
          "active"
        );

      }
    );

  }


  /*
   * =========================================
   * 顯示首頁
   * =========================================
   */

  function showDashboard() {

    hideAllContentPages();

    if (dashboardPage) {
      dashboardPage.hidden = false;
    }

    clearSidebarActive();

    const dashboardButton =
      document.querySelector(
        '.sidebar-item[data-page="dashboard"]'
      );

    if (dashboardButton) {

      dashboardButton.classList.add(
        "active"
      );

    }

    if (pageTitle) {
      pageTitle.textContent = "首頁";
    }

    if (pageDescription) {

      pageDescription.textContent =
        "iKey 智慧鑰匙管理系統";

    }

  }


  /*
   * =========================================
   * 顯示教室
   * =========================================
   */

  function showClassroom(
    classroomNumber
  ) {

    hideAllContentPages();

    if (classroomPage) {
      classroomPage.hidden = false;
    }

    if (classroomTitle) {

      classroomTitle.textContent =
        `教室 ${classroomNumber}`;

    }

    if (pageTitle) {

      pageTitle.textContent =
        `教室 ${classroomNumber} 課表`;

    }

    if (pageDescription) {

      pageDescription.textContent =
        `管理教室 ${classroomNumber} 的課程時間`;

    }

    clearSidebarActive();

  }


  /*
   * =========================================
   * 顯示格位狀態
   * =========================================
   */

  function showSlotStatus() {

    hideAllContentPages();

    if (slotStatusPage) {
      slotStatusPage.hidden = false;
    }

    clearSidebarActive();

    const button =
      document.querySelector(
        '.sidebar-item[data-page="slot-status"]'
      );

    if (button) {

      button.classList.add(
        "active"
      );

    }

    if (pageTitle) {

      pageTitle.textContent =
        "格位目前狀態";

    }

    if (pageDescription) {

      pageDescription.textContent =
        "查看目前鑰匙與格位借用狀態";

    }

  }


  /*
   * =========================================
   * 顯示系統終端機
   * =========================================
   */

  function showTerminal() {

    hideAllContentPages();

    if (terminalPage) {
      terminalPage.hidden = false;
    }

    clearSidebarActive();

    const button =
      document.querySelector(
        '.sidebar-item[data-page="terminal"]'
      );

    if (button) {

      button.classList.add(
        "active"
      );

    }

    if (pageTitle) {

      pageTitle.textContent =
        "系統終端機";

    }

    if (pageDescription) {

      pageDescription.textContent =
        "查看 iKey 系統與裝置事件";

    }

  }


  /*
   * =========================================
   * Sidebar Navigation
   * =========================================
   */

  sidebarItems.forEach(
    (item) => {

      item.addEventListener(
        "click",
        () => {

          const page =
            item.dataset.page;

          if (page === "dashboard") {

            showDashboard();

          }

          if (page === "slot-status") {

            showSlotStatus();

          }

          if (page === "terminal") {

            showTerminal();

          }

        }
      );

    }
  );


  /*
   * =========================================
   * 課表展開
   * =========================================
   */

  if (
    scheduleToggle &&
    classroomMenu
  ) {

    scheduleToggle.addEventListener(
      "click",
      () => {

        classroomMenu.hidden =
          !classroomMenu.hidden;

        if (scheduleArrow) {

          scheduleArrow.textContent =
            classroomMenu.hidden
              ? "▶"
              : "▼";

        }

      }
    );

  }


  /*
   * =========================================
   * 教室按鈕
   * =========================================
   */

  classroomItems.forEach(
    (item) => {

      item.addEventListener(
        "click",
        () => {

          const classroomNumber =
            item.dataset.classroom;

          showClassroom(
            classroomNumber
          );

        }
      );

    }
  );


  /*
   * =========================================
   * 更新裝置 UI
   * =========================================
   */

  function updateDeviceStatus(
    element,
    online
  ) {

    if (!element) {
      return;
    }

    element.classList.remove(
      "robot-online",
      "robot-offline"
    );

    if (online) {

      element.textContent =
        "● 已連線";

      element.classList.add(
        "robot-online"
      );

    } else {

      element.textContent =
        "● 尚未連線";

      element.classList.add(
        "robot-offline"
      );

    }

  }


  /*
   * =========================================
   * 取得裝置狀態
   * =========================================
   */

  async function fetchDeviceStatus() {

    try {

      const response =
        await fetch(
          "/api/device/status",
          {
            cache: "no-store"
          }
        );

      if (!response.ok) {

        throw new Error(
          `HTTP ${response.status}`
        );

      }

      const data =
        await response.json();

      if (
        !data.success ||
        !data.devices
      ) {

        throw new Error(
          "裝置資料格式錯誤"
        );

      }


      /*
       * ESP Robot
       */

      const espRobot =
        data.devices["esp-robot"];

      const espOnline =
        Boolean(
          espRobot &&
          espRobot.online
        );


      /*
       * LVGL Terminal
       */

      const lvglTerminal =
        data.devices[
          "lvgl-terminal"
        ];

      const lvglOnline =
        Boolean(
          lvglTerminal &&
          lvglTerminal.online
        );


      /*
       * 更新畫面
       */

      updateDeviceStatus(
        espRobotStatus,
        espOnline
      );

      updateDeviceStatus(
        lvglTerminalStatus,
        lvglOnline
      );


      /*
       * 計算連線數量
       */

      let connected = 0;

      if (espOnline) {
        connected++;
      }

      if (lvglOnline) {
        connected++;
      }

      if (connectedDeviceCount) {

        connectedDeviceCount.textContent =
          `${connected} / 2`;

      }


      /*
       * 系統連線狀態
       */

      if (
        connectionText &&
        connectionDot
      ) {

        connectionText.textContent =
          "系統正常";

        connectionDot.classList.add(
          "online"
        );

      }


      /*
       * ESP Robot 狀態變化 Log
       */

      if (
        previousEspRobotOnline !== null &&
        previousEspRobotOnline !==
          espOnline
      ) {

        if (espOnline) {

          addSystemLog(
            "ESP Robot 已連線"
          );

        } else {

          addSystemLog(
            "ESP Robot 已離線"
          );

        }

      }


      /*
       * LVGL 狀態變化 Log
       */

      if (
        previousLvglTerminalOnline !== null &&
        previousLvglTerminalOnline !==
          lvglOnline
      ) {

        if (lvglOnline) {

          addSystemLog(
            "LVGL Terminal 已連線"
          );

        } else {

          addSystemLog(
            "LVGL Terminal 已離線"
          );

        }

      }


      previousEspRobotOnline =
        espOnline;

      previousLvglTerminalOnline =
        lvglOnline;

    } catch (error) {

      console.error(
        "Device Status Error:",
        error
      );

      if (connectionText) {

        connectionText.textContent =
          "伺服器連線異常";

      }

      if (connectionDot) {

        connectionDot.classList.remove(
          "online"
        );

      }

    }

  }


  /*
   * =========================================
   * 開始裝置監測
   * =========================================
   */

  function startDevicePolling() {

    if (pollingStarted) {
      return;
    }

    pollingStarted = true;

    fetchDeviceStatus();

    setInterval(
      fetchDeviceStatus,
      5000
    );

  }


  /*
   * =========================================
   * 登入
   * =========================================
   */

  if (loginForm) {

    loginForm.addEventListener(
      "submit",
      async (event) => {

        event.preventDefault();

        const account =
          accountInput
            ? accountInput.value.trim()
            : "";

        const password =
          passwordInput
            ? passwordInput.value
            : "";

        const submitButton =
          loginForm.querySelector(
            'button[type="submit"]'
          );

        if (submitButton) {

          submitButton.disabled = true;

          submitButton.textContent =
            "登入中...";

        }

        if (loginMessage) {

          loginMessage.textContent = "";

        }

        try {

          const response =
            await fetch(
              "/api/login",
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json"
                },

                body: JSON.stringify({
                  account,
                  password
                })
              }
            );

          const data =
            await response.json();

          if (!response.ok) {

            throw new Error(
              data.message ||
              "登入失敗"
            );

          }


          /*
           * 登入成功
           */

          if (loginMessage) {

            loginMessage.textContent =
              "登入成功";

          }


          /*
           * 顯示主系統
           */

          setTimeout(
            () => {

              if (loginPage) {

                loginPage.hidden =
                  true;

              }

              if (homePage) {

                homePage.hidden =
                  false;

              }

              showDashboard();

              startDevicePolling();

            },
            500
          );

        } catch (error) {

          if (loginMessage) {

            loginMessage.textContent =
              error.message;

          }

        } finally {

          if (submitButton) {

            submitButton.disabled =
              false;

            submitButton.textContent =
              "登入系統";

          }

        }

      }
    );

  }


  /*
   * =========================================
   * 登出
   * =========================================
   */

  if (logoutButton) {

    logoutButton.addEventListener(
      "click",
      () => {

        if (homePage) {

          homePage.hidden =
            true;

        }

        if (loginPage) {

          loginPage.hidden =
            false;

        }

        if (passwordInput) {

          passwordInput.value = "";

        }

        if (loginMessage) {

          loginMessage.textContent = "";

        }

      }
    );

  }

});
