// iKey navigation placeholders: presentation only, never grant server permissions.
document.addEventListener("DOMContentLoaded", () => {
  const placeholderPages = Array.from(document.querySelectorAll("[data-ikey-placeholder]"));
  const sidebar = document.getElementById("ikeySidebar");
  const backdrop = document.getElementById("sidebarBackdrop");
  const menuButton = document.getElementById("sidebarMenuButton");
  const nav = document.querySelector(".sidebar-nav");
  if (!nav) return;
  // Collapsible headings match the appearance of ordinary sidebar items.
  nav.addEventListener("click", event => {
    const toggle = event.target.closest("button[data-sidebar-toggle]");
    if (!toggle || !nav.contains(toggle) || toggle.closest("[hidden]")) return;
    const children = document.getElementById(toggle.getAttribute("aria-controls"));
    if (!children) return;
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(open));
    children.inert = !open;
  });
  // Keep the active page visible when the existing page controller navigates.
  nav.addEventListener("click", event => {
    const item = event.target.closest("button[data-page]");
    if (!item || !nav.contains(item) || item.closest("[hidden]")) return;
    const children = item.closest(".ikey-nav-children");
    if (!children) return;
    children.inert = false;
    const toggle = nav.querySelector('[aria-controls="' + children.id + '"]');
    if (toggle) toggle.setAttribute("aria-expanded", "true");
  });

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
    // On phones, close the drawer after navigation; on desktop preserve
    // the user's chosen expanded/collapsed sidebar state.
    if (window.matchMedia("(max-width: 700px)").matches &&
        sidebar?.classList.contains("is-open") && menuButton) {
      menuButton.click();
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
