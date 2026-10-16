"use strict";
// Gen3 project hub, presentation-only prototype.
// No network calls, persistence, permissions, or physical device commands.
(() => {
  function init() {
    const pages = ["project-center-home", "project-apply", "my-projects"];
    if (!pages.every(id => document.getElementById("ikeyPage-" + id))) return;

    document.querySelectorAll("[data-ikey-hub-go]").forEach(button => {
      button.addEventListener("click", () => {
        const target = button.getAttribute("data-ikey-hub-go");
        if (!pages.includes(target)) return;
        const nav = document.querySelector('.sidebar-nav button[data-page="' + target + '"]');
        if (nav) nav.click();
      });
    });

    function bindTabs(root) {
      const tabs = Array.from(root.querySelectorAll("[data-ikey-hub-tab]"));
      const panels = Array.from(root.querySelectorAll("[data-ikey-hub-panel]"));
      function select(tab, focus) {
        const id = tab.dataset.ikeyHubTab;
        tabs.forEach(button => {
          const active = button === tab;
          button.setAttribute("aria-selected", String(active));
          button.tabIndex = active ? 0 : -1;
          button.classList.toggle("is-active", active);
        });
        panels.forEach(panel => { panel.hidden = panel.dataset.ikeyHubPanel !== id; });
        if (focus) tab.focus();
      }
      tabs.forEach((tab, index) => {
        tab.addEventListener("click", () => select(tab, false));
        tab.addEventListener("keydown", event => {
          let next = -1;
          if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
          if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
          if (event.key === "Home") next = 0;
          if (event.key === "End") next = tabs.length - 1;
          if (next < 0) return;
          event.preventDefault();
          select(tabs[next], true);
        });
      });
      const first = tabs.find(tab => tab.getAttribute("aria-selected") === "true") || tabs[0];
      if (first) select(first, false);
    }

    document.querySelectorAll("[data-ikey-hub-tabs]").forEach(bindTabs);
    const openPreview = document.getElementById("ikeyHubOpenCreatePreview");
    const previewPanel = document.getElementById("ikeyHubCreatePreview");
    if (openPreview && previewPanel) {
      openPreview.addEventListener("click", () => {
        const opening = previewPanel.hidden;
        previewPanel.hidden = !opening;
        openPreview.setAttribute("aria-expanded", String(opening));
        openPreview.textContent = opening ? "收起建立專案預覽 ↑" : "開始建立專案 · 互動預覽 →";
        if (opening) previewPanel.scrollIntoView({behavior:"smooth",block:"nearest"});
      });
    }


    const select = document.getElementById("ikeyHubProjectSelect");
    const workspace = document.getElementById("ikeyHubWorkspace");
    const empty = document.getElementById("ikeyHubProjectEmpty");
    const name = document.getElementById("ikeyHubSelectedProject");
    if (select && workspace && empty && name) {
      const update = () => {
        // This option is explicitly a mock. Never imply a real project was loaded.
        const preview = select.value === "preview";
        workspace.hidden = !preview;
        empty.hidden = preview;
        if (preview) name.textContent = "示範專案（介面預覽）";
      };
      select.addEventListener("change", update);
      update();
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
