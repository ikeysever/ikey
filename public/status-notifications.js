/* iKey reusable notification resources. Actual events are supplied by the app. */
(() => {
  const states = new Map();
  const dismissed = new Set();

  let host;
  let audio;
  let sequence = 0;
  let openTerminal = () => {};

  const icons = {
    uploading: '<path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/>',
    success: '<path class="ikey-notice-check" d="M4 12l5 5L20 5"/>',
    error: '<path d="m6 6 12 12M18 6 6 18"/>',
    warning: '<path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5m0 3v.1"/>'
  };

  function unlockAudio() {
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      audio.resume().catch(() => {});
    } catch {}
  }

  function tone(type) {
    if (!audio || audio.state !== "running") return;

    const notes = {
      uploading: [440],
      success: [523.25, 659.25],
      error: [330, 261.63],
      warning: [392, 392]
    }[type];

    notes.forEach((frequency, index) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const at = audio.currentTime + index * 0.12;

      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.018, at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);

      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.18);
    });
  }

  function ensureHost() {
    if (host) return;

    host = document.createElement("div");
    host.className = "ikey-notice-stack";
    host.setAttribute("aria-label", "系統通知");
    document.body.append(host);
  }

  function dismiss(id) {
    const state = states.get(id);
    if (!state) return;

    clearTimeout(state.timer);
    state.closed = true;
    dismissed.add(id);
    state.element.classList.add("ikey-notice-leaving");

    setTimeout(() => {
      state.element.remove();
      states.delete(id);
    }, 200);
  }

  function render(state) {
    const { element, content, close, type, title, detail, logId } = state;

    element.dataset.state = type;

    close.replaceChildren();
    close.innerHTML =
      `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[type]}</svg>`;
    close.setAttribute("aria-label", `關閉通知：${title}`);

    content.replaceChildren();

    const text = document.createElement("span");
    text.className = "ikey-notice-text";

    const heading = document.createElement("strong");
    const description = document.createElement("small");

    heading.textContent = title;
    description.textContent = detail;

    text.append(heading, description);
    content.append(text);

    content.disabled = !logId;
    content.onclick = () => {
      if (logId) openTerminal(logId);
    };

    content.setAttribute(
      "aria-label",
      logId ? `${title}，前往終端機查看詳細資料` : title
    );

    const progress = element.querySelector("progress");
    progress.hidden = type !== "uploading";

    if (state.progress == null) {
      progress.removeAttribute("value");
    } else {
      progress.value = Math.max(0, Math.min(100, state.progress));
    }
  }

  function show({
    id = `ikey-notice-${++sequence}`,
    type = "uploading",
    title,
    detail = "",
    logId = null,
    progress = null
  }) {
    if (!icons[type]) throw new Error("未知的通知狀態");
    if (dismissed.has(id)) return id;

    ensureHost();

    let state = states.get(id);
    if (state && state.closed) return id;

    const changed = !state || state.type !== type;

    if (!state) {
      const element = document.createElement("div");
      element.className = "ikey-notice";
      element.setAttribute("role", "status");
      element.setAttribute("aria-live", "polite");

      const close = document.createElement("button");
      close.type = "button";
      close.className = "ikey-notice-close";
      close.onclick = () => dismiss(id);

      const content = document.createElement("button");
      content.type = "button";
      content.className = "ikey-notice-content";

      const bar = document.createElement("progress");
      bar.max = 100;
      bar.setAttribute("aria-label", "上傳進度");

      element.append(close, content, bar);
      host.prepend(element);

      state = { id, element, close, content, closed: false };
      states.set(id, state);
    }

    clearTimeout(state.timer);

    Object.assign(state, { type, title, detail, logId, progress });
    render(state);

    if (changed) tone(type);

    // 所有狀態保留到使用者主動關閉。
    // 成功也保留，讓使用者能進 Terminal 查看真實紀錄。
    return id;
  }

  function highlightLog(row) {
    if (!row) return;

    row.scrollIntoView({ behavior: "smooth", block: "center" });
    row.classList.remove("ikey-log-highlight");
    void row.offsetWidth;
    row.classList.add("ikey-log-highlight");

    setTimeout(
      () => row.classList.remove("ikey-log-highlight"),
      900
    );
  }

  function applyApprovedBrand() {
    document
      .querySelectorAll('img[src$="ikey-logo.png"]')
      .forEach((img) => {
        img.src = "./assets/brand/ikey-approved.png";
      });

    let favicon = document.querySelector('link[rel="icon"]');

    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      document.head.append(favicon);
    }

    favicon.type = "image/png";
    favicon.href = "./assets/brand/favicon.png";
  }

  window.iKeyNotices = {
    show,
    dismiss,
    unlockAudio,
    highlightLog,
    applyApprovedBrand,

    configure(options = {}) {
      openTerminal = options.openTerminal || (() => {});
    }
  };
})();
