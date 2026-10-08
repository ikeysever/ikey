"use strict";

// iKey project templates are design previews, not enrolled projects.
// No permission, device command, or database write is performed here.
(function () {
  const templates = Object.freeze([
    {
      id: "tool-cabinet",
      title: "工具櫃管理",
      subtitle: "借用、預約、歸還與庫存",
      category: "設備與借還",
      icon: "🧰",
      capabilities: ["工具借還", "庫存查詢", "預約與領取", "設備狀態"],
      note: "借還與庫存資料須接入專案授權及正式資料來源後才會啟用。"
    },
    {
      id: "chemical-lab",
      title: "化學實驗室",
      subtitle: "門禁排程、物品與環境監測",
      category: "門禁與安全",
      icon: "🧪",
      capabilities: ["時段門禁", "環境監測", "物品管理", "安全紀錄"],
      note: "門禁操作必須完成實體安全驗證；此預覽不會發送開鎖指令。"
    }
  ]);

  function create(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function init() {
    const host = document.getElementById("ikeyProjectCards");
    const detail = document.getElementById("ikeyProjectDetail");
    const search = document.getElementById("ikeyProjectSearch");
    if (!host || !detail || !search) return;

    let selected = templates[0].id;
    function renderDetail() {
      const project = templates.find(p => p.id === selected);
      detail.replaceChildren();
      if (!project) return;
      detail.append(
        create("p", "ikey-project-kicker", "專案範本預覽 · 尚未啟用"),
        create("h3", "", project.icon + " " + project.title),
        create("p", "ikey-project-muted", project.subtitle)
      );
      const tags = create("div", "ikey-project-tags");
      project.capabilities.forEach(label => tags.append(create("span", "", label)));
      detail.append(tags, create("p", "ikey-project-note", project.note));
    }

    function renderCards() {
      const term = search.value.trim().toLocaleLowerCase();
      host.replaceChildren();
      let count = 0;
      for (const project of templates) {
        if (![project.title, project.subtitle, project.category, ...project.capabilities]
          .join(" ").toLocaleLowerCase().includes(term)) continue;
        count++;
        const button = create("button", "ikey-project-card" + (selected === project.id ? " is-selected" : ""));
        button.type = "button";
        button.setAttribute("aria-pressed", String(selected === project.id));
        button.append(
          create("span", "ikey-project-card-icon", project.icon),
          create("span", "ikey-project-card-title", project.title),
          create("span", "ikey-project-muted", project.subtitle),
          create("span", "ikey-project-card-category", project.category)
        );
        button.addEventListener("click", () => {
          selected = project.id;
          renderCards();
          renderDetail();
        });
        host.append(button);
      }
      if (!count) host.append(create("p", "ikey-project-muted", "沒有符合搜尋條件的專案範本。"));
    }

    search.addEventListener("input", renderCards);
    renderCards();
    renderDetail();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
