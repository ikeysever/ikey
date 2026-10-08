"use strict";

(function () {
  function node(tag, cls, content) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (content !== undefined) n.textContent = content;
    return n;
  }
  function init() {
    const panel = document.getElementById("ikeyAdminPanel");
    const status = document.getElementById("ikeyAdminStatus");
    const refresh = document.getElementById("ikeyAdminRefresh");
    if (!panel || !status || !refresh) return;

    async function update() {
      panel.replaceChildren();
      status.textContent = "正在由伺服器驗證管理員身分…";
      refresh.disabled = true;
      try {
        const response = await fetch("/api/login/admin/summary", {
          credentials: "same-origin", cache: "no-store",
        });
        if (!response.ok) {
          status.textContent = response.status === 403
            ? "未取得 Super Admin 工作階段。請確認 Render 的 IKEY_SESSION_SECRET 設定並重新登入。"
            : "管理員身分驗證暫時無法使用。";
          return;
        }
        const data = await response.json();
        if (data.globalRole !== "superadmin" || data.account !== "ikey") {
          status.textContent = "伺服器未確認管理員身分。";
          return;
        }
        status.textContent = "已由伺服器驗證：ikey · 全域 Super Admin";
        panel.append(node("h3", "", "管理員工作區"));
        panel.append(node("p", "ikey-project-muted", "可管理範圍：專案審核、成員管理、專案設定（權限基礎已建立，操作尚未啟用）。"));
        panel.append(node("p", "ikey-project-note", data.message || "請等待後端管理功能整合。"));
      } catch {
        status.textContent = "無法連線至管理員驗證服務。";
      } finally {
        refresh.disabled = false;
      }
    }

    refresh.addEventListener("click", update);
    const observer = new MutationObserver(() => {
      const page = document.getElementById("ikeyAdminPage");
      if (page && !page.hidden && !page.closest("[hidden]")) update();
    });
    observer.observe(document.getElementById("homePage"), {
      subtree: true, attributes: true, attributeFilter: ["hidden"],
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
