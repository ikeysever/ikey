"use strict";
document.addEventListener("DOMContentLoaded", () => {
  const terminal = document.querySelector('[data-page="terminal"]');
  const connections = null; // Connection monitoring is now on the homepage.
  const monitor = document.getElementById("connectionMonitorPage");
  const output = document.getElementById("ikeyConnectionDevices");
  const notice = document.getElementById("ikeyConnectionNotice");
  const refresh = document.getElementById("ikeyConnectionRefresh");
  const terminalPage = document.getElementById("terminalPage");
  const terminalOutput = document.getElementById("terminalOutput");
  let eventCursor = 0;
  let terminalBusy = false;
  async function updateTerminalEvents() {
    if (!allowed || !terminalPage || terminalPage.hidden || terminalBusy) return;
    terminalBusy = true;
    try {
      const response = await fetch("/api/login/admin/events?after=" + eventCursor, {
        credentials: "same-origin", cache: "no-store",
      });
      if (!response.ok) {
        if (response.status === 403) await checkAdmin();
        return;
      }
      const data = await response.json();
      for (const entry of data.events || []) {
        const row = document.createElement("div");
        const time = new Date(entry.time).toLocaleTimeString("zh-TW", { hour12: false });
        const detail = entry.details?.deviceId ? " [" + entry.details.deviceId + "]" : "";
        row.textContent = "[" + time + "] " + entry.type.toUpperCase() + " · " + entry.message + detail;
        terminalOutput.prepend(row);
      }
      eventCursor = Math.max(eventCursor, Number(data.latestId) || 0);
      while (terminalOutput.children.length > 180) terminalOutput.lastElementChild.remove();
      if ((data.events || []).length) terminalOutput.scrollTop = 0;
    } catch {
      // Transient network failures must not fabricate terminal events.
    } finally { terminalBusy = false; }
  }
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
    const projectGroup = document.getElementById("ikeyProjectAdminGroup");
    const adminGroup = document.getElementById("ikeyAdminNavGroup");
    if (projectGroup) projectGroup.hidden = !allowed;
    if (adminGroup) adminGroup.hidden = !allowed;
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
  setInterval(() => { if (terminalPage && !terminalPage.hidden) updateTerminalEvents(); }, 2000);
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
