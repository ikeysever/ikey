document.addEventListener("DOMContentLoaded", () => {

  /*
   * =========================================
   * Login
   * =========================================
   */

  const loginPage =
    document.getElementById("loginPage");

  const appPage =
    document.getElementById("appPage");

  const loginForm =
    document.getElementById("loginForm");

  const accountInput =
    document.getElementById("account");

  const passwordInput =
    document.getElementById("password");

  const loginButton =
    document.getElementById("loginButton");

  const loginMessage =
    document.getElementById("loginMessage");

  const logoutButton =
    document.getElementById("logoutButton");


  /*
   * =========================================
   * Welcome Animation
   * =========================================
   */

  const welcomeOverlay =
    document.getElementById("welcomeOverlay");


  /*
   * =========================================
   * Pages
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
   * Sidebar
   * =========================================
   */

  const homeButton =
    document.getElementById("homeButton");

  const scheduleToggle =
    document.getElementById("scheduleToggle");

  const classroomMenu =
    document.getElementById("classroomMenu");

  const scheduleArrow =
    document.getElementById("scheduleArrow");

  const classroomButtons =
    document.querySelectorAll(".classroom-button");

  const slotStatusButton =
    document.getElementById("slotStatusButton");

  const terminalButton =
    document.getElementById("terminalButton");


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
    document.getElementById("lvglTerminalStatus");

  const connectedDeviceCount =
    document.getElementById("connectedDeviceCount");


  /*
   * =========================================
   * Device State
   * =========================================
   */

  let previousEspRobotOnline = null;
  let previousLvglTerminalOnline = null;

  let devicePollingStarted = false;


  /*
   * =========================================
   * System Log
   * =========================================
   */

  const systemLog =
    document.getElementById("systemLog");


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

    line.textContent =
      `[${time}] ${message}`;

    systemLog.prepend(line);

  }


  /*
   * =========================================
   * Page Control
   * =========================================
   */

  function hideAllPages() {

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


  function showDashboard() {

    hideAllPages();

    if (dashboardPage) {
      dashboardPage.hidden = false;
    }

  }


  function showClassroom(
    classroomNumber
  ) {

    hideAllPages();

    if (classroomPage) {

      classroomPage.hidden = false;

    }

    if (classroomTitle) {

      classroomTitle.textContent =
        `教室 ${classroomNumber}`;

    }

  }


  function showSlotStatus() {

    hideAllPages();

    if (slotStatusPage) {
      slotStatusPage.hidden = false;
    }

  }


  function showTerminal() {

    hideAllPages();

    if (terminalPage) {
      terminalPage.hidden = false;
    }

  }


  /*
   * =========================================
   * Device UI
   * =========================================
   */

  function updateDeviceElement(
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
   * Fetch Device Status
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
          "Invalid device status response"
        );

      }


      /*
       * ESP Robot
       */

      const espRobot =
        data.devices["esp-robot"];

      const espRobotOnline =
        Boolean(
          espRobot &&
          espRobot.online
        );

      updateDeviceElement(
        espRobotStatus,
        espRobotOnline
      );


      /*
       * LVGL Terminal
       */

      const lvglTerminal =
        data.devices["lvgl-terminal"];

      const lvglTerminalOnline =
        Boolean(
          lvglTerminal &&
          lvglTerminal.online
        );

      updateDeviceElement(
        lvglTerminalStatus,
        lvglTerminalOnline
      );


      /*
       * Connected Count
       */

      let connectedCount = 0;

      if (espRobotOnline) {
        connectedCount++;
      }

      if (lvglTerminalOnline) {
        connectedCount++;
      }

      if (connectedDeviceCount) {

        connectedDeviceCount.textContent =
          `${connectedCount} / 2`;

      }


      /*
       * ESP Robot Log
       */

      if (
        previousEspRobotOnline !== null &&
        previousEspRobotOnline !==
          espRobotOnline
      ) {

        if (espRobotOnline) {

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
       * LVGL Terminal Log
       */

      if (
        previousLvglTerminalOnline !== null &&
        previousLvglTerminalOnline !==
          lvglTerminalOnline
      ) {

        if (lvglTerminalOnline) {

          addSystemLog(
            "LVGL Terminal 已連線"
          );

        } else {

          addSystemLog(
            "LVGL Terminal 已離線"
          );

        }

      }


      /*
       * Save Previous State
       */

      previousEspRobotOnline =
        espRobotOnline;

      previousLvglTerminalOnline =
        lvglTerminalOnline;

    } catch (error) {

      console.error(
        "Device status error:",
        error
      );

    }

  }


  /*
   * =========================================
   * Start Device Polling
   * =========================================
   */

  function startDevicePolling() {

    if (devicePollingStarted) {
      return;
    }

    devicePollingStarted = true;

    fetchDeviceStatus();

    setInterval(
      fetchDeviceStatus,
      5000
    );

  }


  /*
   * =========================================
   * Sidebar Events
   * =========================================
   */

  if (homeButton) {

    homeButton.addEventListener(
      "click",
      () => {

        showDashboard();

      }
    );

  }


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

          scheduleArrow.classList.toggle(
            "open",
            !classroomMenu.hidden
          );

        }

      }
    );

  }


  classroomButtons.forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {

          const classroomNumber =
            button.dataset.classroom;

          showClassroom(
            classroomNumber
          );

        }
      );

    }
  );


  if (slotStatusButton) {

    slotStatusButton.addEventListener(
      "click",
      () => {

        showSlotStatus();

      }
    );

  }


  if (terminalButton) {

    terminalButton.addEventListener(
      "click",
      () => {

        showTerminal();

      }
    );

  }


  /*
   * =========================================
   * Login
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

        if (loginButton) {

          loginButton.disabled = true;
          loginButton.textContent =
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
           * Login Success
           */

          if (loginMessage) {

            loginMessage.textContent =
              "登入成功";

          }


          if (welcomeOverlay) {

            welcomeOverlay.hidden =
              false;

          }


          setTimeout(
            () => {

              if (loginPage) {

                loginPage.hidden =
                  true;

              }

              if (appPage) {

                appPage.hidden =
                  false;

              }

              showDashboard();

              startDevicePolling();

            },
            1200
          );


          setTimeout(
            () => {

              if (welcomeOverlay) {

                welcomeOverlay.hidden =
                  true;

              }

            },
            2200
          );

        } catch (error) {

          if (loginMessage) {

            loginMessage.textContent =
              error.message;

          }

        } finally {

          if (loginButton) {

            loginButton.disabled =
              false;

            loginButton.textContent =
              "登入";

          }

        }

      }
    );

  }


  /*
   * =========================================
   * Logout
   * =========================================
   */

  if (logoutButton) {

    logoutButton.addEventListener(
      "click",
      () => {

        if (appPage) {

          appPage.hidden =
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
