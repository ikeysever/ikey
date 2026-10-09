// iKey navigation placeholders: presentation only, never grant server permissions.
document.addEventListener("DOMContentLoaded", () => {
  const placeholderPages = Array.from(document.querySelectorAll("[data-ikey-placeholder]"));
  const sidebar = document.getElementById("ikeySidebar");
  const backdrop = document.getElementById("sidebarBackdrop");
  const menuButton = document.getElementById("sidebarMenuButton");
  const nav = document.querySelector(".sidebar-nav");
  if (!nav) return;
  nav.addEventListener("click", event => {
    const button = event.target.closest("button[data-page]");
    if (!button || !nav.contains(button)) return;
    const page = document.getElementById("ikeyPage-" + button.dataset.page);
    if (!page) return;
    // Hidden administrator sections are never navigable without verified role.
    if (button.closest("[hidden]")) return;
    document.querySelectorAll(".content-page").forEach(section => { section.hidden = true; });
    page.hidden = false;
    document.querySelectorAll(".sidebar-item.active").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    const heading = page.querySelector("h2");
    const title = document.getElementById("pageTitle");
    const description = document.getElementById("pageDescription");
    if (title && heading) title.textContent = heading.textContent;
    if (description) description.textContent = "iKey · 介面規劃階段";
    if (sidebar) sidebar.classList.remove("is-open");
    if (backdrop) backdrop.hidden = true;
    if (menuButton) {
      menuButton.textContent = "☰";
      menuButton.setAttribute("aria-expanded", "false");
    }
  });
  // Existing page controller handles other navigation. Placeholders are hidden
  // whenever a different page is selected by the existing controller.
  document.querySelectorAll(".sidebar-item[data-page]").forEach(button => {
    if (document.getElementById("ikeyPage-" + button.dataset.page)) return;
    button.addEventListener("click", () => {
      placeholderPages.forEach(page => { page.hidden = true; });
    });
  });
});
