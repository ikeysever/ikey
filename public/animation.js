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

  const classroomSchedulePanel =
    document.getElementById("classroomSchedulePanel");

  const classroomPlaceholder =
    document.getElementById("classroomPlaceholder");

  const classroomPlaceholderTitle =
    document.getElementById("classroomPlaceholderTitle");

  const classroomCode =
    document.getElementById("classroomCode");

  const classroomName =
    document.getElementById("classroomName");

  const scheduleLoadState =
    document.getElementById("scheduleLoadState");

  const scheduleGrid =
    document.getElementById("scheduleGrid");

  const addCourseModal =
    document.getElementById("addCourseModal");

  const addCourseCloseButton =
    document.getElementById("addCourseCloseButton");

  const addCourseCancelButton =
    document.getElementById("addCourseCancelButton");

  const addCourseConfirmButton =
    document.getElementById("addCourseConfirmButton");

  const addCourseDay =
    document.getElementById("addCourseDay");

  const addCourseTime =
    document.getElementById("addCourseTime");

  const addCourseNotice =
    document.getElementById("addCourseNotice");

  let activeClassroomNumber = null;


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
  // 教室課表：共用工具
  // =========================================

  const scheduleDays = [
    { value: "Monday", label: "星期一" },
    { value: "Tuesday", label: "星期二" },
    { value: "Wednesday", label: "星期三" },
    { value: "Thursday", label: "星期四" },
    { value: "Friday", label: "星期五" },
    { value: "Saturday", label: "星期六" },
    { value: "Sunday", label: "星期日" }
  ];


  function isRecordEnabled(value) {

    const normalized =
      String(value ?? "")
        .trim()
        .toLowerCase();


    return ![
      "false",
      "0",
      "disabled",
      "no"
    ].includes(normalized);

  }


  function parseScheduleTime(value) {

    const text =
      String(value ?? "")
        .trim();


    // 一般 API 時間格式：
    // 08:00 / 8:00
    const timeMatch =
      text.match(
        /^(\d{1,2}):(\d{2})(?::\d{2})?$/
      );


    if (timeMatch) {

      const hour =
        Number(timeMatch[1]);

      const minute =
        Number(timeMatch[2]);


      if (
        Number.isInteger(hour) &&
        Number.isInteger(minute) &&
        hour >= 0 &&
        hour <= 23 &&
        minute >= 0 &&
        minute <= 59
      ) {

        return hour * 60 + minute;

      }

    }


    // Google Sheet 的時間儲存格可能由 Apps Script
    // 以 Date.toISOString() 回傳。
    // 例如台灣 08:00 可能成為 1899-12-30T00:00:00.000Z。
    // 網頁端用本地時間還原成課表時間。
    if (
      /^\d{4}-\d{2}-\d{2}T/.test(
        text
      )
    ) {

      const date =
        new Date(text);


      if (
        !Number.isNaN(
          date.getTime()
        )
      ) {

        return (
          date.getHours() * 60 +
          date.getMinutes()
        );

      }

    }


    return null;

  }


  function formatScheduleTime(value) {

    const minutes =
      parseScheduleTime(value);


    if (minutes === null) {

      return String(
        value ?? ""
      );

    }


    const hour =
      Math.floor(
        minutes / 60
      );

    const minute =
      minutes % 60;


    return (
      `${String(hour).padStart(2, "0")}:` +
      `${String(minute).padStart(2, "0")}`
    );

  }


  async function fetchDatabaseCollection(
    endpoint,
    key
  ) {

    const response =
      await fetch(
        `/api/database/${endpoint}`,
        {
          cache: "no-store"
        }
      );


    let data = null;


    try {

      data =
        await response.json();

    } catch (error) {

      throw new Error(
        `${endpoint} 回傳格式錯誤`
      );

    }


    if (
      !response.ok ||
      data.success !== true
    ) {

      throw new Error(
        data.message ||
        `無法讀取 ${endpoint}`
      );

    }


    const database =
      data.database || data;


    const collection =
      database[key] ||
      (
        database.data &&
        database.data[key]
      ) ||
      data[key];


    if (!Array.isArray(collection)) {

      throw new Error(
        `${endpoint} 資料格式錯誤`
      );

    }


    return collection;

  }


  function openAddCourseModal(
    dayIndex,
    hour
  ) {

    if (
      !addCourseModal ||
      !scheduleDays[dayIndex]
    ) {

      return;

    }


    if (addCourseDay) {

      addCourseDay.textContent =
        scheduleDays[dayIndex].label;

    }


    if (addCourseTime) {

      const start =
        `${String(hour).padStart(2, "0")}:00`;

      const end =
        `${String(hour + 1).padStart(2, "0")}:00`;

      addCourseTime.textContent =
        `${start} ～ ${end}`;

    }


    if (addCourseNotice) {

      addCourseNotice.hidden = true;

    }


    addCourseModal.hidden = false;

  }


  function closeAddCourseModal() {

    if (!addCourseModal) {
      return;
    }


    addCourseModal.hidden = true;

  }


  function buildScheduleGrid(
    schedules,
    classes,
    users
  ) {

    if (!scheduleGrid) {
      return;
    }


    scheduleGrid.innerHTML = "";


    // Header：時間＋星期一～星期日
    const header =
      document.createElement("div");

    header.className =
      "schedule-grid-header";


    const timeHeader =
      document.createElement("div");

    timeHeader.className =
      "schedule-grid-header-cell";

    timeHeader.textContent =
      "時間";

    header.appendChild(timeHeader);


    scheduleDays.forEach(
      (day) => {

        const cell =
          document.createElement("div");

        cell.className =
          "schedule-grid-header-cell";

        cell.textContent =
          day.label;

        header.appendChild(cell);

      }
    );


    scheduleGrid.appendChild(header);


    // 06:00～22:00。
    // 22:00 是最晚結束邊界，不建立 22:00～23:00 格位。
    const body =
      document.createElement("div");

    body.className =
      "schedule-grid-body";


    for (
      let hour = 6;
      hour < 22;
      hour++
    ) {

      const timeCell =
        document.createElement("div");

      timeCell.className =
        "schedule-time-cell";

      timeCell.textContent =
        `${String(hour).padStart(2, "0")}:00`;

      body.appendChild(timeCell);


      for (
        let dayIndex = 0;
        dayIndex < 7;
        dayIndex++
      ) {

        const hourCell =
          document.createElement("div");

        hourCell.className =
          "schedule-hour-cell";


        const day =
          scheduleDays[dayIndex];

        const cellStart =
          hour * 60;

        const cellEnd =
          (hour + 1) * 60;


        const isOccupied =
          schedules.some(
            (schedule) => {

              if (
                String(
                  schedule.weekday || ""
                ) !== day.value
              ) {

                return false;

              }


              const scheduleStart =
                parseScheduleTime(
                  schedule.start_time
                );

              const scheduleEnd =
                parseScheduleTime(
                  schedule.end_time
                );


              if (
                scheduleStart === null ||
                scheduleEnd === null
              ) {

                return false;

              }


              return (
                scheduleStart < cellEnd &&
                scheduleEnd > cellStart
              );

            }
          );


        if (isOccupied) {

          hourCell.classList.add(
            "is-occupied"
          );

          hourCell.title =
            "此時段已有課程";

        } else {

          hourCell.classList.add(
            "is-empty"
          );

          hourCell.title =
            `新增 ${day.label} ${String(hour).padStart(2, "0")}:00 課程`;

          hourCell.addEventListener(
            "click",
            () => {

              openAddCourseModal(
                dayIndex,
                hour
              );

            }
          );

        }


        body.appendChild(hourCell);

      }

    }


    const courseLayer =
      document.createElement("div");

    courseLayer.className =
      "schedule-course-layer";


    const classMap =
      new Map(
        classes.map(
          (item) => [
            String(item.class_id || ""),
            item
          ]
        )
      );


    const userMap =
      new Map(
        users.map(
          (item) => [
            String(item.user_id || ""),
            item
          ]
        )
      );


    schedules.forEach(
      (schedule) => {

        const dayIndex =
          scheduleDays.findIndex(
            (day) =>
              day.value ===
              String(
                schedule.weekday || ""
              )
          );


        const startMinutes =
          parseScheduleTime(
            schedule.start_time
          );

        const endMinutes =
          parseScheduleTime(
            schedule.end_time
          );


        if (
          dayIndex < 0 ||
          startMinutes === null ||
          endMinutes === null ||
          startMinutes < 360 ||
          endMinutes > 1320 ||
          endMinutes <= startMinutes
        ) {

          return;

        }


        const card =
          document.createElement("div");

        card.className =
          "schedule-course-card";


        // 一小時 64px；課程依真正分鐘數比例定位。
        const top =
          (
            startMinutes - 360
          ) /
          60 *
          64;

        const height =
          (
            endMinutes -
            startMinutes
          ) /
          60 *
          64;

        const dayWidth =
          100 / 7;


        card.style.top =
          `${top + 4}px`;

        card.style.height =
          `${Math.max(height - 8, 12)}px`;

        card.style.left =
          `calc(${dayIndex * dayWidth}% + 4px)`;

        card.style.width =
          `calc(${dayWidth}% - 8px)`;


        const courseName =
          document.createElement("strong");

        courseName.textContent =
          schedule.course_name ||
          "未命名課程";


        const classData =
          classMap.get(
            String(
              schedule.class_id || ""
            )
          );

        const classLine =
          document.createElement("span");

        classLine.textContent =
          classData &&
          classData.class_name
            ? classData.class_name
            : (
                schedule.class_id ||
                "未指定班級"
              );


        const teacher =
          userMap.get(
            String(
              schedule.teacher_id || ""
            )
          );

        const teacherLine =
          document.createElement("span");

        teacherLine.textContent =
          teacher &&
          teacher.name
            ? teacher.name
            : (
                schedule.teacher_id ||
                "未指定老師"
              );


        const timeLine =
          document.createElement("span");

        timeLine.className =
          "schedule-course-time";

        timeLine.textContent =
          `${formatScheduleTime(schedule.start_time)}－${formatScheduleTime(schedule.end_time)}`;


        card.appendChild(courseName);
        card.appendChild(classLine);
        card.appendChild(teacherLine);
        card.appendChild(timeLine);

        courseLayer.appendChild(card);

      }
    );


    body.appendChild(courseLayer);

    scheduleGrid.appendChild(body);


    // 22:00 只顯示為最下面的結束邊界。
    const footer =
      document.createElement("div");

    footer.className =
      "schedule-grid-footer";


    const footerTime =
      document.createElement("div");

    footerTime.className =
      "schedule-grid-footer-time";

    footerTime.textContent =
      "22:00";


    const footerLine =
      document.createElement("div");

    footerLine.className =
      "schedule-grid-footer-line";


    footer.appendChild(footerTime);
    footer.appendChild(footerLine);

    scheduleGrid.appendChild(footer);

  }


  async function loadClassroomOneSchedule() {

    if (scheduleLoadState) {

      scheduleLoadState.classList.remove(
        "success",
        "error"
      );

      scheduleLoadState.textContent =
        "正在讀取課表資料...";

    }


    if (classroomName) {

      classroomName.textContent =
        "讀取中...";

    }


    try {

      const [
        schedules,
        classrooms,
        classes,
        users
      ] =
        await Promise.all([
          fetchDatabaseCollection(
            "schedules",
            "schedules"
          ),
          fetchDatabaseCollection(
            "classrooms",
            "classrooms"
          ),
          fetchDatabaseCollection(
            "classes",
            "classes"
          ),
          fetchDatabaseCollection(
            "users",
            "users"
          )
        ]);


      // API 回來前如果已切去其他教室，就不覆蓋畫面。
      if (
        activeClassroomNumber !== "1"
      ) {

        return;

      }


      const classroom =
        classrooms.find(
          (item) =>
            String(
              item.classroom_id || ""
            ).toUpperCase() ===
            "R01"
        );


      if (classroomName) {

        classroomName.textContent =
          classroom &&
          classroom.classroom_name
            ? classroom.classroom_name
            : "教室1";

      }


      const classroomSchedules =
        schedules
          .filter(
            (item) =>
              String(
                item.classroom_id || ""
              ).toUpperCase() ===
                "R01" &&
              isRecordEnabled(
                item.enabled
              )
          )
          .sort(
            (a, b) => {

              const dayA =
                scheduleDays.findIndex(
                  (day) =>
                    day.value ===
                    String(
                      a.weekday || ""
                    )
                );

              const dayB =
                scheduleDays.findIndex(
                  (day) =>
                    day.value ===
                    String(
                      b.weekday || ""
                    )
                );


              if (dayA !== dayB) {
                return dayA - dayB;
              }


              return (
                (
                  parseScheduleTime(
                    a.start_time
                  ) || 0
                ) -
                (
                  parseScheduleTime(
                    b.start_time
                  ) || 0
                )
              );

            }
          );


      buildScheduleGrid(
        classroomSchedules,
        classes,
        users
      );


      if (scheduleLoadState) {

        scheduleLoadState.classList.add(
          "success"
        );

        scheduleLoadState.textContent =
          classroomSchedules.length > 0
            ? `已載入 ${classroomSchedules.length} 筆課程`
            : "目前沒有課程";

      }

    } catch (error) {

      console.error(
        "Schedule Load Error:",
        error
      );


      if (
        activeClassroomNumber !== "1"
      ) {

        return;

      }


      if (scheduleGrid) {

        scheduleGrid.innerHTML = "";

      }


      if (classroomName) {

        classroomName.textContent =
          "讀取失敗";

      }


      if (scheduleLoadState) {

        scheduleLoadState.classList.add(
          "error"
        );

        scheduleLoadState.textContent =
          `課表讀取失敗：${error.message}`;

      }

    }

  }


  // =========================================
  // 教室
  // =========================================

  function showClassroom(number) {

    activeClassroomNumber =
      String(number);


    hideAllContentPages();

    if (classroomPage) {
      classroomPage.hidden = false;
    }


    const isClassroomOne =
      activeClassroomNumber === "1";


    if (classroomSchedulePanel) {

      classroomSchedulePanel.hidden =
        !isClassroomOne;

    }


    if (classroomPlaceholder) {

      classroomPlaceholder.hidden =
        isClassroomOne;

    }


    if (
      classroomPlaceholderTitle &&
      !isClassroomOne
    ) {

      classroomPlaceholderTitle.textContent =
        `教室 ${number}`;

    }


    if (classroomTitle) {

      classroomTitle.textContent =
        `教室 ${number}`;

    }


    if (classroomCode) {

      classroomCode.textContent =
        `R${String(number).padStart(2, "0")}`;

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


    if (isClassroomOne) {

      loadClassroomOneSchedule();

    }

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
  // 新增課程視窗（第三階段：只確認介面）
  // =========================================

  if (addCourseCloseButton) {

    addCourseCloseButton.addEventListener(
      "click",
      closeAddCourseModal
    );

  }


  if (addCourseCancelButton) {

    addCourseCancelButton.addEventListener(
      "click",
      closeAddCourseModal
    );

  }


  document
    .querySelectorAll(
      "[data-close-add-course]"
    )
    .forEach(
      (element) => {

        element.addEventListener(
          "click",
          closeAddCourseModal
        );

      }
    );


  if (addCourseConfirmButton) {

    addCourseConfirmButton.addEventListener(
      "click",
      () => {

        // 第三階段故意不呼叫 POST /api/database/schedules。
        if (addCourseNotice) {

          addCourseNotice.hidden = false;

        }

      }
    );

  }


  document.addEventListener(
    "keydown",
    (event) => {

      if (
        event.key === "Escape" &&
        addCourseModal &&
        !addCourseModal.hidden
      ) {

        closeAddCourseModal();

      }

    }
  );


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
