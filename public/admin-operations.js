"use strict";
document.addEventListener("DOMContentLoaded", () => {
  const terminal = document.querySelector('[data-page="terminal"]');
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
        row.textContent = "[" + time + "] " + entry.type.toUpperCase() + " · " + entry.message;
        terminalOutput.prepend(row);
      }
      eventCursor = Math.max(eventCursor, Number(data.latestId) || 0);
      while (terminalOutput.children.length > 180) terminalOutput.lastElementChild.remove();
      if ((data.events || []).length) terminalOutput.scrollTop = 0;
    } catch {
      // Transient network failures must not fabricate terminal events.
    } finally { terminalBusy = false; }
  }
  const monitorTab = document.getElementById("ikeyTerminalMonitorTab");
  const commandTab = document.getElementById("ikeyTerminalCommandTab");
  const monitorView = document.getElementById("ikeyTerminalMonitorView");
  const commandView = document.getElementById("ikeyTerminalCommandView");
  function switchTerminalTab(command) {
    if (monitorView) monitorView.hidden = command;
    if (commandView) commandView.hidden = !command;
    monitorTab?.setAttribute("aria-pressed", String(!command));
    commandTab?.setAttribute("aria-pressed", String(command));
  }
  monitorTab?.addEventListener("click", () => switchTerminalTab(false));
  commandTab?.addEventListener("click", () => switchTerminalTab(true));
  document.getElementById("ikeyTerminalCommandForm")?.addEventListener("submit", e => e.preventDefault());
  let allowed = false;
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
    const terminalGroup = document.getElementById("ikeyTerminalNavGroup");
    const superadminGroup = document.getElementById("ikeySuperadminNavGroup");
    if (terminalGroup) terminalGroup.hidden = !allowed;
    if (superadminGroup) superadminGroup.hidden = !allowed;
    return allowed;
  }
  terminal?.addEventListener("click", async event => {
    if (!(await checkAdmin())) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  });
  setInterval(() => { if (terminalPage && !terminalPage.hidden) updateTerminalEvents(); }, 2000);
  document.getElementById("loginForm")?.addEventListener("submit", () => {
    setTimeout(checkAdmin, 800);
  });
  document.getElementById("logoutButton")?.addEventListener("click", () => {
    allowed = false;
    if (terminal) terminal.hidden = true;
  });
  checkAdmin();
});
