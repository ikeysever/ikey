"use strict";
document.addEventListener("DOMContentLoaded", () => {
  const dialog = document.getElementById("ikeyAccountDialog");
  const title = document.getElementById("ikeyAccountTitle");
  const body = document.getElementById("ikeyAccountBody");
  const close = document.getElementById("ikeyAccountClose");
  const register = document.getElementById("ikeyRegisterOpen");
  const forgot = document.getElementById("ikeyForgotOpen");
  if (!dialog || !title || !body || !close) return;
  let previousFocus = null;
  function hide() {
    dialog.hidden = true;
    body.replaceChildren();
    previousFocus?.focus();
  }
  function show(heading) {
    previousFocus = document.activeElement;
    title.textContent = heading;
    body.replaceChildren();
    dialog.hidden = false;
    close.focus();
  }
  function add(tag, content, className) {
    const el = document.createElement(tag);
    el.textContent = content;
    if (className) el.className = className;
    body.append(el);
    return el;
  }
  forgot?.addEventListener("click", () => {
    show("忘記密碼");
    add("p", "如需重設密碼，請聯繫 iKey 系統管理員：");
    const link = add("a", "ikeydaandaogong@gmail.com", "ikey-account-email");
    link.href = "mailto:ikeydaandaogong@gmail.com?subject=iKey%20%E5%AF%86%E7%A2%BC%E9%87%8D%E8%A8%AD%E7%94%B3%E8%AB%8B";
    add("p", "請勿在郵件中寄送你的原密碼。管理員將協助確認身分與後續處理。");
  });
  register?.addEventListener("click", () => {
    show("註冊 iKey 帳號");
    add("p", "一般使用者註冊功能正在建置，帳號資料保存與驗證尚未啟用。");
    add("p", "註冊完成後，將由你選擇「申請加入現有專案」或「申請建立新專案」。");
    add("p", "加入與建立專案都需依照專案管理員／Super Admin 的審核規則處理；未通過前不授予設備權限。");
    add("p", "目前請先聯繫系統管理員申請帳號，不會在此收集或儲存你的密碼。");
    const link = add("a", "聯繫管理員", "ikey-account-email");
    link.href = "mailto:ikeydaandaogong@gmail.com?subject=iKey%20%E5%B8%B3%E8%99%9F%E8%A8%BB%E5%86%8A%E7%94%B3%E8%AB%8B";
  });
  close.addEventListener("click", hide);
  dialog.addEventListener("click", event => { if (event.target === dialog) hide(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && !dialog.hidden) hide(); });
});
