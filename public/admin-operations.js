"use strict";
document.addEventListener("DOMContentLoaded", () => {
  const terminal = document.querySelector('[data-page="terminal"]');
  const connections = document.querySelector('[data-page="connections"]');
  const monitor = document.getElementById("connectionMonitorPage");
  const output = document.getElementById("ikeyConnectionDevices");
  const notice = document.getElementById("ikeyConnectionNotice");
  const refresh = document.getElementById("ikeyConnectionRefresh");
  let allowed = false;
  let running = false;
  function textLine(message) {
    const row = document.createElement("div");
    row.textContent = message;
    output.append(row);
  }
  async function checkAdmin() {
    try {
      const response = await fetch("/api/login/admin/summary", { credentials: "same-origin", cache: "no-store" });
      allowed = response.ok && (await response.json()).globalRole === "superadmin";
    } catch { allowed = false; }
    if (terminal) terminal.hidden = !allowed;
    if (connections) connections.hidden = !allowed;
    if (!allowed && monitor) monitor.hidden = true;
    return allowed;
  }
  async function updateConnections() {
    if (running || !monitor || monitor.hidden) return;
    running = true;
    if (refresh) refresh.disabled = true;
    try {
      const response = await fetch("/api/login/admin/connections", { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) {
        notice.textContent = "沒有檢視連線監測的權限，請重新登入。";
        output.replaceChildren();
        await checkAdmin();
        return;
      }
      const data = await response.json();
      notice.textContent = "Render 心跳監測 · 逾 30 秒未收到回報即標示離線；此狀態不代表實體鎖的實際狀態。";
      output.replaceChildren();
      for (const [id, device] of Object.entries(data.devices || {})) {
        const seen = device.lastSeen ? new Date(device.lastSeen).toLocaleString("zh-TW") : "尚無回報";
        textLine(device.name + " (" + id + ")：" + (device.online ? "連線中" : "離線／未回報") + " · 最後心跳 " + seen);
      }
      textLine(data.warning || "");
    } catch {
      notice.textContent = "監測服務暫時無法使用。";
    } finally {
      running = false;
      if (refresh) refresh.disabled = false;
    }
  }
  connections?.addEventListener("click", async () => {
    if (!(await checkAdmin())) return;
    document.querySelectorAll(".content-page").forEach(page => { page.hidden = true; });
    monitor.hidden = false;
    document.querySelectorAll(".sidebar-item.active").forEach(item => item.classList.remove("active"));
    connections.classList.add("active");
    const title = document.getElementById("pageTitle");
    if (title) title.textContent = "連線監測";
    await updateConnections();
  });
  terminal?.addEventListener("click", async event => {
    if (!(await checkAdmin())) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  });
  refresh?.addEventListener("click", updateConnections);
  document.getElementById("loginForm")?.addEventListener("submit", () => {
    setTimeout(checkAdmin, 800);
  });
  document.getElementById("logoutButton")?.addEventListener("click", () => {
    allowed = false;
    if (terminal) terminal.hidden = true;
    if (connections) connections.hidden = true;
    if (monitor) monitor.hidden = true;
  });
  setInterval(() => { if (monitor && !monitor.hidden) updateConnections(); }, 5000);
  checkAdmin();
});
