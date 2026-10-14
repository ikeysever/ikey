"use strict";
// iKey Generation 3 homepage: render only verified account data.
// Gen3 and administrator login sessions use independent server endpoints.
(() => {
  const el = id => document.getElementById(id);
  const fieldIds = ["ikeyV3Username","ikeyV3DisplayName","ikeyV3Role",
    "ikeyV3AccountStatus","ikeyV3AdminUsername","ikeyV3AdminRole"];
  let requestId = 0;
  let currentKind = null;

  function reset() {
    fieldIds.forEach(id => { if (el(id)) el(id).textContent = "—"; });
    if (el("ikeyV3Gen3Fields")) el("ikeyV3Gen3Fields").hidden = true;
    if (el("ikeyV3AdminFields")) el("ikeyV3AdminFields").hidden = true;
  }

  function clear() {
    requestId++;
    currentKind = null;
    reset();
    if (el("ikeyV3Greeting")) el("ikeyV3Greeting").textContent = "正在確認登入帳號…";
    if (el("ikeyV3AccountMessage")) el("ikeyV3AccountMessage").textContent = "登入後載入帳號資訊。";
    if (el("ikeyV3AccountRefresh")) el("ikeyV3AccountRefresh").disabled = false;
    if (el("ikeyV3AccountHelp")) el("ikeyV3AccountHelp").hidden = false;
  }

  async function load(kind) {
    if (kind !== "gen3" && kind !== "legacy") return;
    const generation = ++requestId;
    currentKind = kind;
    const greeting = el("ikeyV3Greeting");
    const message = el("ikeyV3AccountMessage");
    const refresh = el("ikeyV3AccountRefresh");
    const help = el("ikeyV3AccountHelp");
    if (!greeting || !message || !refresh) return;
    reset();
    greeting.textContent = "正在確認登入帳號…";
    message.textContent = "正在讀取帳號資料…";
    refresh.disabled = true;
    if (help) help.hidden = kind === "legacy";

    try {
      const endpoint = kind === "gen3" ? "/api/auth/me" : "/api/login/session";
      const response = await fetch(endpoint, {credentials:"same-origin",cache:"no-store"});
      if (!response.ok) throw Error(response.status === 401 ? "SESSION_EXPIRED" : "PROFILE_UNAVAILABLE");
      const data = await response.json();
      if (generation !== requestId) return;

      if (kind === "legacy") {
        if (!data || data.authenticated !== true || typeof data.account !== "string" || !data.account.trim()) {
          throw Error("SESSION_EXPIRED");
        }
        const account = data.account.trim();
        const roles = {superadmin:"超級管理員",admin:"管理員"};
        el("ikeyV3AdminUsername").textContent = account;
        el("ikeyV3AdminRole").textContent = roles[data.globalRole] || "權限未確認";
        el("ikeyV3AdminFields").hidden = false;
        greeting.textContent = "歡迎回來，" + account;
      } else {
        if (!data || data.authenticated !== true || !data.user) throw Error("SESSION_EXPIRED");
        const user = data.user;
        const username = String(user.username || "").trim();
        const displayName = String(user.display_name || "").trim();
        const roles = {user:"一般使用者",admin:"管理員",superadmin:"超級管理員"};
        const statuses = {active:"已啟用",pending_verification:"待驗證",disabled:"已停用",
          temporarily_locked:"暫時鎖定",pending_deletion:"待刪除"};
        el("ikeyV3Username").textContent = username || "未設定";
        el("ikeyV3DisplayName").textContent = displayName || "未設定";
        el("ikeyV3Role").textContent = roles[user.global_role] || "權限未確認";
        el("ikeyV3AccountStatus").textContent = statuses[user.account_status] || "狀態未確認";
        el("ikeyV3Gen3Fields").hidden = false;
        greeting.textContent = "歡迎回來，" + (displayName || username || "iKey 使用者");
      }
      message.textContent = "帳號資料已更新";
    } catch (error) {
      if (generation !== requestId) return;
      reset();
      greeting.textContent = "歡迎使用 iKey";
      message.textContent = error.message === "SESSION_EXPIRED"
        ? "登入狀態已失效，請登出後重新登入。"
        : "帳號資料暫時無法取得，請稍後重新整理。";
    } finally {
      if (generation === requestId) refresh.disabled = false;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const refresh = el("ikeyV3AccountRefresh");
    if (refresh) refresh.addEventListener("click", () => {
      if (currentKind) void load(currentKind);
    });
  });
  window.iKeyHomeDashboard = {load,clear};
})();
