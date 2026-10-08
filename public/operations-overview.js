"use strict";

/**
 * iKey operations overview. Read-only against existing /api/database routes.
 * This view is NOT an authorization boundary and never issues device commands.
 */
(function () {
  const collections = Object.freeze([
    { endpoint: "users", key: "users", label: "使用者" },
    { endpoint: "classrooms", key: "classrooms", label: "教室" },
    { endpoint: "devices", key: "devices", label: "登錄設備" },
    { endpoint: "borrow-records", key: "borrow_records", label: "借還紀錄" },
  ]);

  function el(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
  }

  function extractRows(payload, key) {
    if (!payload || payload.success !== true) {
      throw new Error(payload?.message || "資料來源回報失敗");
    }
    const database = payload.database || payload;
    const rows = database[key] || database.data?.[key] || payload[key];
    if (!Array.isArray(rows)) throw new Error("資料格式不符合預期");
    return rows;
  }

  async function loadOne(item) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch("/api/database/" + item.endpoint, {
        cache: "no-store",
        signal: controller.signal,
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      return extractRows(await response.json(), item.key);
    } finally {
      clearTimeout(timeout);
    }
  }

  function init() {
    const button = document.getElementById("ikeyOverviewRefresh");
    const grid = document.getElementById("ikeyOverviewStats");
    const message = document.getElementById("ikeyOverviewMessage");
    if (!button || !grid || !message) return;
    let busy = false;

    async function refresh() {
      if (busy) return;
      busy = true;
      button.disabled = true;
      message.textContent = "正在讀取既有 iKey 資料…";
      grid.replaceChildren();
      try {
        const outcomes = await Promise.allSettled(collections.map(loadOne));
        let failures = 0;
        outcomes.forEach((result, index) => {
          const item = collections[index];
          const card = el("article", "ikey-overview-stat");
          card.append(el("p", "ikey-project-muted", item.label));
          if (result.status === "fulfilled") {
            card.append(el("strong", "", String(result.value.length)));
            card.append(el("span", "ikey-overview-success", "已取得資料"));
          } else {
            failures++;
            card.append(el("strong", "", "—"));
            card.append(el("span", "ikey-overview-error", "讀取失敗"));
          }
          grid.append(card);
        });
        message.textContent = failures
          ? "部分資料暫時無法讀取（" + failures + " 項）。請檢查資料來源設定；未顯示的數量不代表零。"
          : "資料已更新。這裡顯示既有系統資料，並非新專案的即時設備授權狀態。";
      } catch {
        message.textContent = "目前無法讀取資料，請稍後重試。";
      } finally {
        busy = false;
        button.disabled = false;
      }
    }

    button.addEventListener("click", refresh);
    // Load on first visit only; don't add traffic before login.
    const observer = new MutationObserver(() => {
      const section = document.getElementById("ikeyOverviewPage");
      if (section && !section.hidden && !section.closest("[hidden]")) {
        if (!section.dataset.loaded) {
          section.dataset.loaded = "true";
          refresh();
        }
      }
    });
    observer.observe(document.getElementById("homePage"), {
      attributes: true, subtree: true, attributeFilter: ["hidden"],
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
