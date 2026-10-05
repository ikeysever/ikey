document.addEventListener("DOMContentLoaded", () => {

  // =========================================
  // 基本元素
  // =========================================

  const loginPage = document.getElementById("loginPage");
  const homePage = document.getElementById("homePage");

  const loginForm = document.getElementById("loginForm");
  const accountInput = document.getElementById("account");
  const passwordInput = document.getElementById("password");
  const loginMessage = document.getElementById("loginMessage");
  const logoutButton = document.getElementById("logoutButton");

  const animationRoot = document.getElementById("animationRoot");


  // =========================================
  // 內容頁面
  // =========================================

  const dashboardPage = document.getElementById("dashboardPage");
  const classroomPage = document.getElementById("classroomPage");
  const slotStatusPage = document.getElementById("slotStatusPage");
  const terminalPage = document.getElementById("terminalPage");

  const pageTitle = document.getElementById("pageTitle");
  const pageDescription = document.getElementById("pageDescription");

  const classroomTitle = document.getElementById("classroomTitle");


  // =========================================
  // Sidebar
  // =========================================

  const sidebarItems =
    document.querySelectorAll(".sidebar-item[data-page]");

  const scheduleToggle =
    document.getElementById("scheduleToggle");

  const scheduleArrow =
    document.getElementById("scheduleArrow");

  const classroomMenu =
    document.getElementById("classroomMenu");

  const classroomItems =
    document.querySelectorAll(".classroom-item");


  // =========================================
  // 裝置狀態
  // =========================================

  const espRobotStatus =
    document.getElementById("espRobotStatus");

  const lvglTerminalStatus =
    document.getElementById("lvglTerminalStatus");

  const connectedDeviceCount =
    document.getElementById("connectedDeviceCount");

  const connectionDot =
    document.getElementById("connectionDot");

  const connectionText =
    document.getElementById("connectionText");

  const systemLog =
    document.getElementById("systemLog");


  let previousEspRobotOnline = null;
  let previousLvglTerminalOnline = null;

  let pollingStarted = false;


  // =========================================
  // 系統日誌
  // =========================================

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

    line.innerHTML =
      `<span>[${time}]</span> ${message}`;

    systemLog.prepend(line);

  }


  // =========================================
  // 歡迎動畫
  // =========================================

  function playWelcomeAnimation() {

    return new Promise((resolve) => {

      if (!animationRoot) {
        resolve();
        return;
      }

      // 清除舊動畫
      animationRoot.innerHTML = "";

      // Overlay
      const overlay =
        document.createElement("div");

      overlay.style.position = "fixed";
      overlay.style.inset = "0";
      overlay.style.zIndex = "99999";

      overlay.style.display = "flex";
      overlay.style.alignItems = "center";
      overlay.style.justifyContent = "center";

      overlay.style.background =
        "radial-gradient(circle at center, #172033 0%, #0b1020 45%, #05070d 100%)";

      overlay.style.opacity = "0";
      overlay.style.transition =
        "opacity 0.45s ease";

      overlay.style.overflow = "hidden";


      // 背景光暈
      const glow =
        document.createElement("div");

      glow.style.position = "absolute";

      glow.style.width = "420px";
      glow.style.height = "420px";

      glow.style.borderRadius = "50%";

      glow.style.background =
        "rgba(255,255,255,0.05)";

      glow.style.filter = "blur(50px)";

      glow.style.transform =
        "scale(0.5)";

      glow.style.opacity = "0";

      glow.style.transition =
        "all 1.4s cubic-bezier(.2,.8,.2,1)";


      // 中央內容
      const content =
        document.createElement("div");

      content.style.position = "relative";
      content.style.zIndex = "2";

      content.style.display = "flex";
      content.style.flexDirection = "column";
      content.style.alignItems = "center";

      content.style.textAlign = "center";

      content.style.transform =
        "translateY(18px) scale(0.94)";

      content.style.opacity = "0";

      content.style.transition =
        "all 0.9s cubic-bezier(.2,.8,.2,1)";


      // Logo 外框
      const logoBox =
        document.createElement("div");

      logoBox.style.width = "110px";
      logoBox.style.height = "110px";

      logoBox.style.display = "flex";
      logoBox.style.alignItems = "center";
      logoBox.style.justifyContent = "center";

      logoBox.style.marginBottom = "26px";

      logoBox.style.borderRadius = "28px";

      logoBox.style.background =
        "rgba(255,255,255,0.06)";

      logoBox.style.border =
        "1px solid rgba(255,255,255,0.10)";

      logoBox.style.boxShadow =
        "0 20px 60px rgba(0,0,0,0.30)";


      // Logo
      const logo =
        document.createElement("img");

      logo.src = "./assets/ikey-logo.png";
      logo.alt = "iKey";

      logo.style.width = "76px";
      logo.style.height = "76px";

      logo.style.objectFit = "contain";

      logo.style.display = "block";


      // Welcome
      const welcome =
        document.createElement("div");

      welcome.textContent =
        "WELCOME TO";

      welcome.style.fontSize = "12px";
      welcome.style.fontWeight = "700";
      welcome.style.letterSpacing = "5px";

      welcome.style.color =
        "rgba(255,255,255,0.50)";

      welcome.style.marginBottom =
        "12px";


      // iKey
      const title =
        document.createElement("div");

      title.textContent = "iKey";

      title.style.fontSize =
        "clamp(48px, 8vw, 76px)";

      title.style.fontWeight = "800";

      title.style.letterSpacing =
        "-3px";

      title.style.lineHeight = "1";

      title.style.color = "#ffffff";


      // 中文名稱
      const subtitle =
        document.createElement("div");

      subtitle.textContent =
        "智慧鑰匙管理系統";

      subtitle.style.marginTop =
        "18px";

      subtitle.style.fontSize =
        "16px";

      subtitle.style.fontWeight =
        "500";

      subtitle.style.letterSpacing =
        "4px";

      subtitle.style.color =
        "rgba(255,255,255,0.72)";


      // Loading line
      const lineBox =
        document.createElement("div");

      lineBox.style.width = "180px";
      lineBox.style.height = "2px";

      lineBox.style.marginTop =
        "34px";

      lineBox.style.background =
        "rgba(255,255,255,0.10)";

      lineBox.style.borderRadius =
        "999px";

      lineBox.style.overflow =
        "hidden";


      const line =
        document.createElement("div");

      line.style.width = "0%";
      line.style.height = "100%";

      line.style.background =
        "rgba(255,255,255,0.90)";

      line.style.borderRadius =
        "999px";

      line.style.transition =
        "width 1.5s cubic-bezier(.2,.8,.2,1)";


      // 組裝
      logoBox.appendChild(logo);

      lineBox.appendChild(line);

      content.appendChild(logoBox);
      content.appendChild(welcome);
      content.appendChild(title);
      content.appendChild(subtitle);
      content.appendChild(lineBox);

      overlay.appendChild(glow);
      overlay.appendChild(content);

      animationRoot.appendChild(overlay);


      // 開始淡入
      requestAnimationFrame(() => {

        overlay.style.opacity = "1";

        setTimeout(() => {

          glow.style.opacity = "1";

          glow.style.transform =
            "scale(1)";

          content.style.opacity = "1";

          content.style.transform =
            "translateY(0) scale(1)";

        }, 120);


        setTimeout(() => {

          line.style.width = "100%";

        }, 500);

      });


      // 開始離場
      setTimeout(() => {

        content.style.opacity = "0";

        content.style.transform =
          "translateY(-12px) scale(1.03)";

        glow.style.opacity = "0";

        glow.style.transform =
          "scale(1.3)";

      }, 2000);


      // Overlay 淡出
      setTimeout(() => {

        overlay.style.opacity = "0";

      }, 2250);


      // 移除動畫
      setTimeout(() => {

        animationRoot.innerHTML = "";

        resolve();

      }, 2750);

    });

  }


  // =========================================
  // 隱藏所有內容頁
  // =========================================

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


  // =========================================
  // 清除 Sidebar Active
  // =========================================

  function clearSidebarActive() {

    sidebarItems.forEach((item) => {

      item.classList.remove("active");

    });

  }


  // =========================================
  // 首頁
  // =========================================

  function showDashboard() {

    hideAllContentPages();

    if (dashboardPage) {
      dashboardPage.hidden = false;
    }

    clearSidebarActive();

    const button =
      document.querySelector(
        '.sidebar-item[data-page="dashboard"]'
      );

    if (button) {
      button.classList.add("active");
    }

    if (pageTitle) {
      pageTitle.textContent = "首頁";
    }

    if (pageDescription) {

      pageDescription.textContent =
        "iKey 智慧鑰匙管理系統";

    }

  }


  // =========================================
  // 教室
  // =========================================

  function showClassroom(number) {

    hideAllContentPages();

    if (classroomPage) {
      classroomPage.hidden = false;
    }

    if (classroomTitle) {

      classroomTitle.textContent =
        `教室 ${number}`;

    }

    if (pageTitle) {

      pageTitle.textContent =
        `教室 ${number} 課表`;

    }

    if (pageDescription) {

      pageDescription.textContent =
        `管理教室 ${number} 的課程時間`;

    }

    clearSidebarActive();

  }


  // =========================================
  // 格位狀態
  // =========================================

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
      button.classList.add("active");
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


  // =========================================
  // 系統終端機
  // =========================================

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
      button.classList.add("active");
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


  // =========================================
  // Sidebar 頁面切換
  // =========================================

  sidebarItems.forEach((item) => {

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

  });


  // =========================================
  // 課表展開
  // =========================================

  if (scheduleToggle && classroomMenu) {

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


  // =========================================
  // 教室選擇
  // =========================================

  classroomItems.forEach((item) => {

    item.addEventListener(
      "click",
      () => {

        showClassroom(
          item.dataset.classroom
        );

      }
    );

  });


  // =========================================
  // 更新裝置顯示
  // =========================================

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


  // =========================================
  // 取得 Device Status
  // =========================================

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

      if (!data.success || !data.devices) {

        throw new Error(
          "裝置狀態資料格式錯誤"
        );

      }


      const espRobot =
        data.devices["esp-robot"];

      const lvglTerminal =
        data.devices["lvgl-terminal"];


      const espOnline =
        Boolean(
          espRobot &&
          espRobot.online
        );

      const lvglOnline =
        Boolean(
          lvglTerminal &&
          lvglTerminal.online
        );


      updateDeviceStatus(
        espRobotStatus,
        espOnline
      );

      updateDeviceStatus(
        lvglTerminalStatus,
        lvglOnline
      );


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


      // Render / API 正常
      if (connectionText) {

        connectionText.textContent =
          "系統正常";

      }

      if (connectionDot) {

        connectionDot.classList.add(
          "online"
        );

      }


      // ESP Robot 狀態變化
      if (
        previousEspRobotOnline !== null &&
        previousEspRobotOnline !== espOnline
      ) {

        addSystemLog(
          espOnline
            ? "ESP Robot 已連線"
            : "ESP Robot 已離線"
        );

      }


      // LVGL Terminal 狀態變化
      if (
        previousLvglTerminalOnline !== null &&
        previousLvglTerminalOnline !== lvglOnline
      ) {

        addSystemLog(
          lvglOnline
            ? "LVGL Terminal 已連線"
            : "LVGL Terminal 已離線"
        );

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


  // =========================================
  // 每 5 秒監測一次
  // =========================================

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


  // =========================================
  // 登入
  // =========================================

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


          // 登入成功
          if (loginMessage) {

            loginMessage.textContent =
              "登入成功";

          }


          // 稍微停一下讓使用者看到登入成功
          await new Promise(
            (resolve) =>
              setTimeout(resolve, 350)
          );


          // 播放歡迎動畫
          await playWelcomeAnimation();


          // 切換頁面
          if (loginPage) {
            loginPage.hidden = true;
          }

          if (homePage) {
            homePage.hidden = false;
          }


          // 顯示首頁
          showDashboard();


          // 開始監測裝置
          startDevicePolling();


        } catch (error) {

          if (loginMessage) {

            loginMessage.textContent =
              error.message;

          }

        } finally {

          if (submitButton) {

            submitButton.disabled = false;

            submitButton.textContent =
              "登入系統";

          }

        }

      }
    );

  }


  // =========================================
  // 登出
  // =========================================

  if (logoutButton) {

    logoutButton.addEventListener(
      "click",
      () => {

        if (homePage) {
          homePage.hidden = true;
        }

        if (loginPage) {
          loginPage.hidden = false;
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
