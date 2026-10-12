"use strict";
// iKey Gen3 account overview: only render data returned by the verified /api/auth/me endpoint.
// Legacy administrator sessions are separate and must never be presented as Gen3 identities.
(() => {
  const get = id => document.getElementById(id);
  let requestId = 0;
  let currentKind = null;

  function resetFields() {
    for (const id of ["ikeyHomeUsername","ikeyHomeDisplayName","ikeyHomeEmail","ikeyHomeStatus","ikeyHomeRole"]) {
      const element = get(id);
      if (element) element.textContent = "—";
    }
  }

  function clear() {
    requestId += 1; // Prevent a pending response from restoring private data after logout.
    currentKind = null;
    resetFields();
    if (get("ikeyHomeAccount")) get("ikeyHomeAccount").hidden = true;
    if (get("ikeyHomeAccountProfile")) get("ikeyHomeAccountProfile").hidden = true;
    if (get("ikeyHomeAccountLegacy")) get("ikeyHomeAccountLegacy").hidden = true;
    if (get("ikeyHomeAccountMessage")) get("ikeyHomeAccountMessage").textContent = "";
    if (get("ikeyHomeGreeting")) get("ikeyHomeGreeting").textContent = "";
  }

  async function load(kind) {
    if (kind !== "gen3" && kind !== "legacy") return;
    const generation = ++requestId;
    currentKind = kind;
    const panel = get("ikeyHomeAccount");
    const profile = get("ikeyHomeAccountProfile");
    const legacy = get("ikeyHomeAccountLegacy");
    const greeting = get("ikeyHomeGreeting");
    const message = get("ikeyHomeAccountMessage");
    const refresh = get("ikeyHomeAccountRefresh");
    const help = get("ikeyHomeAccountHelp");
    if (!panel || !profile || !legacy || !greeting || !message || !refresh) return;
    panel.hidden = false;
    profile.hidden = true;
    legacy.hidden = true;
    refresh.hidden = kind === "legacy";
    refresh.disabled = kind === "gen3";
    if (help) help.hidden = kind === "legacy";
    resetFields();

    if (kind === "legacy") {
      greeting.textContent = "管理員工作階段";
      message.textContent = "舊版管理員入口";
      legacy.hidden = false;
      return;
    }

    greeting.textContent = "正在取得帳號資料…";
    message.textContent = "";
    try {
      const response = await fetch("/api/auth/me", {credentials:"same-origin",cache:"no-store"});
      if (!response.ok) throw Error(response.status === 401 ? "SESSION_EXPIRED" : "PROFILE_UNAVAILABLE");
      const data = await response.json();
      if (!data || data.authenticated !== true || !data.user) throw Error("SESSION_EXPIRED");
      if (generation !== requestId) return;

      const user = data.user;
      const name = String(user.display_name || "").trim();
      const username = String(user.username || "").trim();
      const email = String(user.email || "").trim();
      const roles = {user:"一般使用者",admin:"管理員",superadmin:"超級管理員"};
      const statuses = {active:"已啟用（電子郵件已驗證）",pending_verification:"待驗證",disabled:"已停用",temporarily_locked:"暫時鎖定",pending_deletion:"待刪除"};
      get("ikeyHomeUsername").textContent = username || "未設定";
      get("ikeyHomeDisplayName").textContent = name || "未設定";
      get("ikeyHomeEmail").textContent = email || "未設定";
      get("ikeyHomeStatus").textContent = statuses[user.account_status] || "狀態未確認";
      get("ikeyHomeRole").textContent = roles[user.global_role] || "權限未確認";
      greeting.textContent = "歡迎回來，" + (name || username || "iKey 使用者");
      message.textContent = "帳號資料已更新";
      profile.hidden = false;
    } catch (error) {
      if (generation !== requestId) return;
      greeting.textContent = "帳號資料暫時無法顯示";
      message.textContent = error.message === "SESSION_EXPIRED"
        ? "登入狀態已失效，請登出後重新登入。"
        : "無法取得帳號資料，請稍後重新整理。";
    } finally {
      if (generation === requestId) refresh.disabled = false;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const refresh = get("ikeyHomeAccountRefresh");
    if (refresh) refresh.addEventListener("click", () => {
      if (currentKind === "gen3") void load("gen3");
    });
  });

  window.iKeyHomeAccount = {load,clear};
})();
