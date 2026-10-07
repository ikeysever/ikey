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

  const addCourseName =
    document.getElementById("addCourseName");

  const addCourseStartTime =
    document.getElementById("addCourseStartTime");

  const addCourseEndTime =
    document.getElementById("addCourseEndTime");

  const addCourseClassCreatePanel =
    document.getElementById("addCourseClassCreatePanel");

  const addCourseNewClassName =
    document.getElementById("addCourseNewClassName");

  const addCourseNewClassDepartment =
    document.getElementById("addCourseNewClassDepartment");

  const addCourseNewClassGrade =
    document.getElementById("addCourseNewClassGrade");

  const addCourseSaveClassButton =
    document.getElementById("addCourseSaveClassButton");

  const addCourseCancelClassButton =
    document.getElementById("addCourseCancelClassButton");

  const addCourseTeacher =
    document.getElementById("addCourseTeacher");

  const addCourseTeacherOptions =
    document.getElementById("addCourseTeacherOptions");

  const addCourseClass =
    document.getElementById("addCourseClass");

  const addCourseClassOptions =
    document.getElementById("addCourseClassOptions");

  let activeClassroomNumber = null;

  let scheduleTeacherOptions = [];
  let scheduleClassOptions = [];

  let selectedScheduleTeacherId = "";
  let selectedScheduleClassId = "";

  let activeScheduleDayIndex = null;
  let allScheduleRecords = [];
  let scheduleWriteInProgress = false;


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
    return window.iKeyWelcome.play(animationRoot, async () => {
      showDashboard();
      await fetchDeviceStatus(true);
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


  async function fetchTimedDatabaseCollection(
    endpoint,
    key
  ) {

    const startedAt =
      performance.now();


    try {

      const collection =
        await fetchDatabaseCollection(
          endpoint,
          key
        );

      const elapsedMs =
        performance.now() -
        startedAt;


      console.log(
        `[Schedule API] ${endpoint}: ${elapsedMs.toFixed(0)} ms`
      );


      return {
        endpoint,
        collection,
        elapsedMs
      };

    } catch (error) {

      const elapsedMs =
        performance.now() -
        startedAt;


      console.error(
        `[Schedule API] ${endpoint}: failed after ${elapsedMs.toFixed(0)} ms`,
        error
      );


      throw error;

    }

  }


  function renderScheduleSearchOptions(
    type,
    query = ""
  ) {

    const isTeacher =
      type === "teacher";

    const container =
      isTeacher
        ? addCourseTeacherOptions
        : addCourseClassOptions;

    const source =
      isTeacher
        ? scheduleTeacherOptions
        : scheduleClassOptions;


    if (!container) {
      return;
    }


    const keyword =
      String(query)
        .trim()
        .toLowerCase();


    const filtered =
      source.filter(
        (item) => {

          const searchText =
            isTeacher
              ? [
                  item.name,
                  item.user_id,
                  item.department
                ]
              : [
                  item.class_name,
                  item.class_id,
                  item.department,
                  item.grade
                ];


          return (
            keyword === "" ||
            searchText
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(keyword)
          );

        }
      );


    container.innerHTML = "";


    if (filtered.length === 0) {

      if (
        !isTeacher &&
        keyword
      ) {

        const addButton =
          document.createElement("button");

        addButton.type = "button";
        addButton.className =
          "schedule-search-add";

        addButton.textContent =
          `＋ 新增班級「${query.trim()}」`;

        addButton.addEventListener(
          "click",
          () => {

            openScheduleClassCreatePanel(
              query.trim()
            );

          }
        );

        container.appendChild(
          addButton
        );

      } else {

        const empty =
          document.createElement("div");

        empty.className =
          "schedule-search-empty";

        empty.textContent =
          keyword
            ? "找不到符合的資料"
            : "目前沒有可選資料";

        container.appendChild(empty);

      }


      container.hidden = false;

      return;

    }


    filtered.forEach(
      (item) => {

        const option =
          document.createElement("button");

        option.type = "button";
        option.className =
          "schedule-search-option";

        option.setAttribute(
          "role",
          "option"
        );


        const main =
          document.createElement("span");

        main.className =
          "schedule-search-option-main";

        main.textContent =
          isTeacher
            ? (
                item.name ||
                item.user_id ||
                "未命名老師"
              )
            : (
                item.class_name ||
                item.class_id ||
                "未命名班級"
              );


        const meta =
          document.createElement("span");

        meta.className =
          "schedule-search-option-meta";

        meta.textContent =
          isTeacher
            ? String(
                item.user_id || ""
              )
            : String(
                item.class_id || ""
              );


        option.appendChild(main);
        option.appendChild(meta);


        option.addEventListener(
          "click",
          () => {

            if (isTeacher) {

              selectedScheduleTeacherId =
                String(
                  item.user_id || ""
                );

              if (addCourseTeacher) {

                addCourseTeacher.value =
                  item.name ||
                  item.user_id ||
                  "";

              }

            } else {

              selectedScheduleClassId =
                String(
                  item.class_id || ""
                );

              if (addCourseClass) {

                addCourseClass.value =
                  item.class_name ||
                  item.class_id ||
                  "";

              }

            }


            container.hidden = true;


            if (addCourseNotice) {

              addCourseNotice.hidden = true;

            }

          }
        );


        if (isTeacher) {

          container.appendChild(option);

        } else {

          const row =
            document.createElement("div");

          row.className =
            "schedule-search-option-row";


          const removeButton =
            document.createElement("button");

          removeButton.type = "button";
          removeButton.className =
            "schedule-class-delete";
          removeButton.textContent = "×";
          removeButton.title =
            "刪除這個班級";
          removeButton.setAttribute(
            "aria-label",
            `刪除班級 ${item.class_name || item.class_id || ""}`
          );

          removeButton.addEventListener(
            "click",
            async (event) => {

              event.preventDefault();
              event.stopPropagation();

              await removeScheduleClass(
                item
              );

            }
          );


          row.appendChild(option);
          row.appendChild(removeButton);
          container.appendChild(row);

        }

      }
    );


    container.hidden = false;

  }


  function closeScheduleSearchOptions() {

    if (addCourseTeacherOptions) {
      addCourseTeacherOptions.hidden = true;
    }

    if (addCourseClassOptions) {
      addCourseClassOptions.hidden = true;
    }

  }


  function setAddCourseNotice(
    message
  ) {

    if (!addCourseNotice) {
      return;
    }

    addCourseNotice.hidden = false;
    addCourseNotice.textContent =
      message;

  }


  function openScheduleClassCreatePanel(
    className = ""
  ) {

    closeScheduleSearchOptions();

    if (!addCourseClassCreatePanel) {
      return;
    }

    addCourseClassCreatePanel.hidden =
      false;

    if (addCourseNewClassName) {
      addCourseNewClassName.value =
        className;
      addCourseNewClassName.focus();
    }

    if (addCourseNewClassDepartment) {
      addCourseNewClassDepartment.value =
        "";
    }

    if (addCourseNewClassGrade) {
      addCourseNewClassGrade.value =
        "";
    }

  }


  function closeScheduleClassCreatePanel() {

    if (addCourseClassCreatePanel) {
      addCourseClassCreatePanel.hidden =
        true;
    }

  }


  function sortScheduleClasses(
    classes
  ) {

    return classes
      .filter(
        (item) =>
          isRecordEnabled(
            item.enabled
          )
      )
      .sort(
        (a, b) =>
          String(
            a.class_name ||
            a.class_id ||
            ""
          ).localeCompare(
            String(
              b.class_name ||
              b.class_id ||
              ""
            ),
            "zh-Hant"
          )
      );

  }


  async function refreshScheduleClasses() {

    const classes =
      await fetchDatabaseCollection(
        "classes",
        "classes"
      );

    scheduleClassOptions =
      sortScheduleClasses(
        classes
      );

    return scheduleClassOptions;

  }


  async function createScheduleClass() {

    if (scheduleWriteInProgress) {
      return;
    }


    const className =
      String(
        addCourseNewClassName &&
        addCourseNewClassName.value ||
        ""
      ).trim();

    const department =
      String(
        addCourseNewClassDepartment &&
        addCourseNewClassDepartment.value ||
        ""
      ).trim();

    const grade =
      Number(
        addCourseNewClassGrade &&
        addCourseNewClassGrade.value
      );


    if (
      !className ||
      !department ||
      !Number.isInteger(grade) ||
      grade < 1 ||
      grade > 3
    ) {

      setAddCourseNotice(
        "新增班級需要班級名稱、科別與 1～3 年級。"
      );

      return;

    }


    const duplicate =
      scheduleClassOptions.find(
        (item) =>
          String(
            item.class_name || ""
          ).trim().toLowerCase() ===
          className.toLowerCase()
      );


    if (duplicate) {

      selectedScheduleClassId =
        String(
          duplicate.class_id || ""
        );

      if (addCourseClass) {
        addCourseClass.value =
          duplicate.class_name ||
          duplicate.class_id ||
          "";
      }

      closeScheduleClassCreatePanel();
      setAddCourseNotice(
        "這個班級已存在，已直接選取。"
      );

      return;

    }


    scheduleWriteInProgress = true;

    if (addCourseSaveClassButton) {
      addCourseSaveClassButton.disabled =
        true;
    }


    try {

      const response =
        await fetch(
          "/api/database/classes",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json"
            },
            body: JSON.stringify({
              class_name:
                className,
              department:
                department,
              grade:
                grade,
              enabled:
                true
            })
          }
        );

      const data =
        await response.json()
          .catch(
            () => null
          );


      if (
        !response.ok ||
        !data ||
        data.success !== true
      ) {

        throw new Error(
          data &&
          data.message ||
          "班級新增失敗"
        );

      }


      const classes =
        await refreshScheduleClasses();

      const created =
        classes.find(
          (item) =>
            String(
              item.class_name || ""
            ).trim().toLowerCase() ===
            className.toLowerCase()
        );


      if (!created) {

        throw new Error(
          "班級已寫入，但重新讀取後找不到該班級"
        );

      }


      selectedScheduleClassId =
        String(
          created.class_id || ""
        );

      if (addCourseClass) {
        addCourseClass.value =
          created.class_name ||
          created.class_id ||
          "";
      }

      closeScheduleClassCreatePanel();

      setAddCourseNotice(
        `班級「${created.class_name || className}」已建立並選取。`
      );

    } catch (error) {

      console.error(
        "Create Class Error:",
        error
      );

      setAddCourseNotice(
        `新增班級失敗：${error.message}`
      );

    } finally {

      scheduleWriteInProgress = false;

      if (addCourseSaveClassButton) {
        addCourseSaveClassButton.disabled =
          false;
      }

    }

  }


  async function removeScheduleClass(
    classData
  ) {

    const classId =
      String(
        classData.class_id || ""
      );

    const className =
      classData.class_name ||
      classId ||
      "這個班級";


    if (!classId) {
      return;
    }


    const isUsed =
      allScheduleRecords.some(
        (schedule) =>
          isRecordEnabled(
            schedule.enabled
          ) &&
          String(
            schedule.class_id || ""
          ) === classId
      );


    if (isUsed) {

      setAddCourseNotice(
        `「${className}」已有課表使用，不能刪除。`
      );

      closeScheduleSearchOptions();
      return;

    }


    if (
      !window.confirm(
        `確定刪除班級「${className}」嗎？`
      )
    ) {

      return;

    }


    try {

      const response =
        await fetch(
          `/api/database/classes/${encodeURIComponent(classId)}`,
          {
            method: "PUT",
            headers: {
              "Content-Type":
                "application/json"
            },
            body: JSON.stringify({
              ...classData,
              enabled:
                false
            })
          }
        );

      const data =
        await response.json()
          .catch(
            () => null
          );


      if (
        !response.ok ||
        !data ||
        data.success !== true
      ) {

        throw new Error(
          data &&
          data.message ||
          "班級刪除失敗"
        );

      }


      scheduleClassOptions =
        scheduleClassOptions.filter(
          (item) =>
            String(
              item.class_id || ""
            ) !== classId
        );


      if (
        selectedScheduleClassId ===
        classId
      ) {

        selectedScheduleClassId = "";

        if (addCourseClass) {
          addCourseClass.value = "";
        }

      }


      closeScheduleSearchOptions();

      setAddCourseNotice(
        `已刪除班級「${className}」。`
      );

    } catch (error) {

      console.error(
        "Delete Class Error:",
        error
      );

      setAddCourseNotice(
        `刪除班級失敗：${error.message}`
      );

    }

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


    activeScheduleDayIndex =
      dayIndex;

    const start =
      `${String(hour).padStart(2, "0")}:00`;

    const end =
      `${String(hour + 1).padStart(2, "0")}:00`;


    if (addCourseStartTime) {
      addCourseStartTime.value =
        start;
    }

    if (addCourseEndTime) {
      addCourseEndTime.value =
        end;
    }


    selectedScheduleTeacherId = "";
    selectedScheduleClassId = "";


    if (addCourseName) {
      addCourseName.value = "";
    }

    if (addCourseTeacher) {
      addCourseTeacher.value = "";
    }

    if (addCourseClass) {
      addCourseClass.value = "";
    }


    closeScheduleSearchOptions();
    closeScheduleClassCreatePanel();


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

    closeScheduleSearchOptions();

  }


  function buildScheduleGrid(
    schedules,
    classes,
    users,
    allowInteraction = true
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

        } else if (allowInteraction) {

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

        } else {

          hourCell.title =
            "課表資料背景載入中";

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

    const totalStartedAt =
      performance.now();


    // 先立即畫出課表骨架，不等 Google Sheet / Apps Script。
    // 資料完成前先鎖住空白格互動，避免把尚未載入的
    // 已有課程誤判成可新增時段。
    buildScheduleGrid(
      [],
      [],
      [],
      false
    );


    if (scheduleLoadState) {

      scheduleLoadState.classList.remove(
        "success",
        "error"
      );

      scheduleLoadState.classList.add(
        "loading"
      );

      scheduleLoadState.textContent =
        "同步資料中...";

    }


    if (classroomName) {

      classroomName.textContent =
        "教室1";

    }


    try {

      const [
        schedulesResult,
        classroomsResult,
        classesResult,
        usersResult
      ] =
        await Promise.all([
          fetchTimedDatabaseCollection(
            "schedules",
            "schedules"
          ),
          fetchTimedDatabaseCollection(
            "classrooms",
            "classrooms"
          ),
          fetchTimedDatabaseCollection(
            "classes",
            "classes"
          ),
          fetchTimedDatabaseCollection(
            "users",
            "users"
          )
        ]);


      const schedules =
        schedulesResult.collection;

      const classrooms =
        classroomsResult.collection;

      const classes =
        classesResult.collection;

      const users =
        usersResult.collection;


      scheduleTeacherOptions =
        users
          .filter(
            (item) =>
              String(
                item.identity || ""
              ).toLowerCase() ===
                "teacher" &&
              isRecordEnabled(
                item.enabled
              )
          )
          .sort(
            (a, b) =>
              String(
                a.name ||
                a.user_id ||
                ""
              ).localeCompare(
                String(
                  b.name ||
                  b.user_id ||
                  ""
                ),
                "zh-Hant"
              )
          );


      scheduleClassOptions =
        sortScheduleClasses(
          classes
        );

      allScheduleRecords =
        schedules;


      const timings = [
        schedulesResult,
        classroomsResult,
        classesResult,
        usersResult
      ];


      const totalElapsedMs =
        performance.now() -
        totalStartedAt;


      console.table(
        timings.map(
          (item) => ({
            api: item.endpoint,
            milliseconds:
              Math.round(
                item.elapsedMs
              )
          })
        )
      );

      console.log(
        `[Schedule API] total: ${totalElapsedMs.toFixed(0)} ms`
      );


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
        users,
        true
      );


      if (scheduleLoadState) {

        scheduleLoadState.classList.remove(
          "loading"
        );

        scheduleLoadState.classList.add(
          "success"
        );

        const resultText =
          classroomSchedules.length > 0
            ? `已載入 ${classroomSchedules.length} 筆課程`
            : "目前沒有課程";


        scheduleLoadState.textContent =
          resultText;

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


      // 保留已經立即顯示的空課表骨架，不讓整頁消失。
      if (classroomName) {

        classroomName.textContent =
          "教室1";

      }


      if (scheduleLoadState) {

        scheduleLoadState.classList.remove(
          "loading"
        );

        scheduleLoadState.classList.add(
          "error"
        );

        scheduleLoadState.textContent =
          `背景資料讀取失敗：${error.message}`;

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
  // 新增課程視窗（真正寫入課表）
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


  function bindScheduleSearchInput(
    input,
    type
  ) {

    if (!input) {
      return;
    }


    input.addEventListener(
      "focus",
      () => {

        renderScheduleSearchOptions(
          type,
          input.value
        );

      }
    );


    input.addEventListener(
      "input",
      () => {

        if (type === "teacher") {

          selectedScheduleTeacherId = "";

        } else {

          selectedScheduleClassId = "";

        }


        if (addCourseNotice) {

          addCourseNotice.hidden = true;

        }


        renderScheduleSearchOptions(
          type,
          input.value
        );

      }
    );

  }


  bindScheduleSearchInput(
    addCourseTeacher,
    "teacher"
  );

  bindScheduleSearchInput(
    addCourseClass,
    "class"
  );


  if (addCourseSaveClassButton) {

    addCourseSaveClassButton.addEventListener(
      "click",
      createScheduleClass
    );

  }


  if (addCourseCancelClassButton) {

    addCourseCancelClassButton.addEventListener(
      "click",
      closeScheduleClassCreatePanel
    );

  }


  document.addEventListener(
    "click",
    (event) => {

      const target =
        event.target;


      if (
        target instanceof Element &&
        !target.closest(
          ".schedule-search-wrapper"
        )
      ) {

        closeScheduleSearchOptions();

      }

    }
  );


  if (addCourseConfirmButton) {

    addCourseConfirmButton.addEventListener(
      "click",
      async () => {

        if (scheduleWriteInProgress) {
          return;
        }


        const courseName =
          String(
            addCourseName &&
            addCourseName.value ||
            ""
          ).trim();

        const startTime =
          String(
            addCourseStartTime &&
            addCourseStartTime.value ||
            ""
          );

        const endTime =
          String(
            addCourseEndTime &&
            addCourseEndTime.value ||
            ""
          );

        const startMinutes =
          parseScheduleTime(
            startTime
          );

        const endMinutes =
          parseScheduleTime(
            endTime
          );


        if (!courseName) {

          setAddCourseNotice(
            "請輸入課程名稱。"
          );

          return;

        }


        if (
          !selectedScheduleTeacherId ||
          !selectedScheduleClassId
        ) {

          setAddCourseNotice(
            "請先從下拉選單選擇老師與班級。"
          );

          return;

        }


        if (
          activeScheduleDayIndex === null ||
          !scheduleDays[
            activeScheduleDayIndex
          ]
        ) {

          setAddCourseNotice(
            "找不到要新增的星期，請重新開啟視窗。"
          );

          return;

        }


        if (
          startMinutes === null ||
          endMinutes === null ||
          startMinutes < 360 ||
          endMinutes > 1320 ||
          endMinutes <= startMinutes
        ) {

          setAddCourseNotice(
            "時間需介於 06:00～22:00，且結束時間必須晚於開始時間。"
          );

          return;

        }


        scheduleWriteInProgress = true;
        addCourseConfirmButton.disabled =
          true;

        setAddCourseNotice(
          "正在新增課程..."
        );


        try {

          const response =
            await fetch(
              "/api/database/schedules",
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json"
                },
                body: JSON.stringify({
                  classroom_id:
                    "R01",
                  weekday:
                    scheduleDays[
                      activeScheduleDayIndex
                    ].value,
                  start_time:
                    startTime,
                  end_time:
                    endTime,
                  teacher_id:
                    selectedScheduleTeacherId,
                  class_id:
                    selectedScheduleClassId,
                  course_name:
                    courseName,
                  enabled:
                    true
                })
              }
            );

          const data =
            await response.json()
              .catch(
                () => null
              );


          if (
            !response.ok ||
            !data ||
            data.success !== true
          ) {

            throw new Error(
              data &&
              data.message ||
              "課程新增失敗"
            );

          }


          closeAddCourseModal();

          await loadClassroomOneSchedule();

          addSystemLog(
            `課表新增成功：${courseName} ${startTime}～${endTime}`
          );

        } catch (error) {

          console.error(
            "Create Schedule Error:",
            error
          );

          setAddCourseNotice(
            `新增課程失敗：${error.message}`
          );

        } finally {

          scheduleWriteInProgress = false;
          addCourseConfirmButton.disabled =
            false;

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

  async function fetchDeviceStatus(required = false) {

    try {

      const response =
        await fetch(
          "/api/device/status",
          {
            cache: "no-store",
            signal: AbortSignal.timeout(15000)
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

      if (required) throw error;
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
        window.iKeyWelcome.unlockAudio();


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


          // Hide login immediately after successful authentication.
          if (loginPage) loginPage.hidden = true;
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
          if (loginPage) loginPage.hidden = false;
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
