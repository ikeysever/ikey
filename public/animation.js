(function (window, document) {
  "use strict";

  const DEFAULT_DURATION = 1500;
  const LOGO_SRC = "./assets/ikey-logo.png";

  const root = document.getElementById("animationRoot");

  const loginPage = document.getElementById("loginPage");
  const homePage = document.getElementById("homePage");

  const loginForm = document.getElementById("loginForm");
  const loginMessage = document.getElementById("loginMessage");

  const logoutButton = document.getElementById("logoutButton");


  // =========================
  // 基本工具
  // =========================

  function wait(milliseconds) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, milliseconds);
    });
  }


  function removeAfter(element, milliseconds) {
    return wait(milliseconds).then(() => {
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
  }


  // =========================
  // Gamma iKey 歡迎動畫
  // =========================

  function createWelcomeOverlay() {
    const overlay = document.createElement("div");

    overlay.className = "welcome-overlay";

    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "登入成功");

    overlay.innerHTML = `
      <div class="welcome-content">

        <div class="welcome-brand">
          <img
            class="brand-logo"
            src="${LOGO_SRC}"
            alt="iKey"
          >
        </div>

        <div class="welcome-line"></div>

        <p class="welcome-title">
          歡迎使用 iKey
        </p>

      </div>
    `;

    return overlay;
  }


  function showWelcomeAnimation(options = {}) {
    const duration = Math.max(
      0,
      Number(options.duration ?? DEFAULT_DURATION)
    );

    const overlay = createWelcomeOverlay();

    root.replaceChildren(overlay);

    window.requestAnimationFrame(() => {
      overlay.classList.add("is-running");
    });

    return wait(duration)
      .then(() => {
        overlay.classList.remove("is-running");
        overlay.classList.add("is-leaving");

        return removeAfter(overlay, 380);
      });
  }


  // =========================
  // 成功 / 錯誤提示
  // =========================

  function showToast(
    message,
    type = "success",
    duration = 1800
  ) {
    const toast = document.createElement("div");

    toast.className = `ikey-toast ikey-toast-${type}`;

    toast.setAttribute("role", "status");

    toast.textContent = message;

    root.appendChild(toast);

    window.requestAnimationFrame(() => {
      toast.classList.add("is-visible");
    });

    return wait(duration).then(() => {
      toast.classList.remove("is-visible");

      return removeAfter(toast, 220);
    });
  }


  function showSuccessAnimation(message = "操作成功") {
    return showToast(message, "success");
  }


  function showErrorAnimation(
    message = "操作失敗，請稍後再試"
  ) {
    return showToast(message, "error");
  }


  // =========================
  // 登入
  // =========================

  loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const submitButton =
      loginForm.querySelector('button[type="submit"]');

    const account =
      document.getElementById("account").value.trim();

    const password =
      document.getElementById("password").value;

    loginMessage.textContent = "";

    submitButton.disabled = true;

    try {
      const response = await fetch("/api/login", {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          account,
          password
        })
      });


      const result = await response.json();


      // 登入失敗
      if (!response.ok || !result.success) {
        loginMessage.textContent =
          result.message || "帳號或密碼錯誤";

        await showErrorAnimation(
          "帳號或密碼錯誤"
        );

        submitButton.disabled = false;

        return;
      }


      // 登入成功
      await showSuccessAnimation("登入成功");


      // Gamma 歡迎動畫
      await showWelcomeAnimation({
        duration: 1500
      });


      // 進入首頁
      loginPage.hidden = true;
      homePage.hidden = false;

      loginForm.reset();
      loginMessage.textContent = "";


    } catch (error) {

      console.error("Login error:", error);

      loginMessage.textContent =
        "系統連線失敗，請稍後再試";

      await showErrorAnimation(
        "系統連線失敗"
      );

    } finally {

      submitButton.disabled = false;

    }
  });


  // =========================
  // 登出
  // =========================

  logoutButton.addEventListener("click", function () {

    homePage.hidden = true;
    loginPage.hidden = false;

    loginForm.reset();
    loginMessage.textContent = "";

  });


  // =========================
  // 提供給其他程式使用
  // =========================

  window.iKeyAnimations = {
    showWelcomeAnimation,
    showSuccessAnimation,
    showErrorAnimation
  };

  window.showWelcomeAnimation = showWelcomeAnimation;
  window.showSuccessAnimation = showSuccessAnimation;
  window.showErrorAnimation = showErrorAnimation;


})(window, document);
